import * as THREE from 'three';
import { MotionState, UserSettings } from '../types';
import { sound } from '../audio/SoundEffects';

export class MotionTracker {
  private state: MotionState = {
    position: { x: 0, y: 1.6, z: 0 },
    heading: 0,
    pitch: 0,
    roll: 0,
    stepCount: 0,
    distanceMeters: 0,
    currentSpeed: 0,
    cadence: 0,
    isMoving: false,
    trackingMode: 'simulator',
    sensorHealth: 'idle',
    rawAcceleration: 9.81,
    stepThreshold: 1.15,
    statusMessage: 'Ready to walk',
  };

  private settings: UserSettings;
  private onStateChange: (state: MotionState) => void;

  // Canonical Three.js DeviceOrientation constants
  private zee = new THREE.Vector3(0, 0, 1);
  private euler = new THREE.Euler();
  private q0 = new THREE.Quaternion();
  private q1 = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5)); // -PI/2 around X
  public cameraQuaternion = new THREE.Quaternion();
  public hasOrientation: boolean = false;
  private alphaOffsetDeg: number = 0;
  private manualYawDeg: number = 0;
  private screenOrientationDeg: number = 0;

  // Invariant-norm Pedometer with Schmitt-trigger hysteresis
  private gravityBaseline: number = 9.81;
  private isStepArmed: boolean = true;
  private lastStepTimestamp: number = 0;
  private stepIntervals: number[] = [];

  // Desktop simulator & touch joystick
  private keysPressed: { [key: string]: boolean } = {};
  private joystickVector: { x: number; y: number } = { x: 0, y: 0 };
  private simStepAccumulator: number = 0;

  // Camera video stream for safety preview
  private videoStream: MediaStream | null = null;

  // Step event callback
  public onStepDetected?: () => void;

  constructor(
    initialSettings: UserSettings,
    onStateChange: (state: MotionState) => void
  ) {
    this.settings = initialSettings;
    this.onStateChange = onStateChange;

    this.setupKeyboardListeners();
    this.updateScreenOrientation();
  }

  private updateScreenOrientation = () => {
    if (typeof window !== 'undefined') {
      this.screenOrientationDeg = window.screen?.orientation?.angle || (window.orientation as number) || 0;
    }
  };

  public updateSettings(newSettings: UserSettings) {
    this.settings = newSettings;
    this.broadcastState();
  }

  public getState(): MotionState {
    return { ...this.state, position: { ...this.state.position } };
  }

  private broadcastState() {
    this.onStateChange(this.getState());
  }

  /**
   * Request motion and orientation sensors with explicit user gesture
   */
  public async enableSensors(): Promise<{ success: boolean; message: string }> {
    try {
      this.state.sensorHealth = 'calibrating';
      this.state.statusMessage = 'Requesting device sensors...';
      this.broadcastState();

      // iOS 13+ permission flow
      const DeviceOrientationEventAny = window.DeviceOrientationEvent as unknown as {
        requestPermission?: () => Promise<'granted' | 'denied'>;
      };
      const DeviceMotionEventAny = window.DeviceMotionEvent as unknown as {
        requestPermission?: () => Promise<'granted' | 'denied'>;
      };

      if (typeof DeviceMotionEventAny?.requestPermission === 'function') {
        const motionPerm = await DeviceMotionEventAny.requestPermission();
        if (motionPerm !== 'granted') {
          this.state.sensorHealth = 'denied';
          this.state.statusMessage = 'Motion permission denied';
          this.broadcastState();
          return { success: false, message: 'Motion sensor permission was denied' };
        }
      }

      if (typeof DeviceOrientationEventAny?.requestPermission === 'function') {
        const orientPerm = await DeviceOrientationEventAny.requestPermission();
        if (orientPerm !== 'granted') {
          this.state.sensorHealth = 'denied';
          this.state.statusMessage = 'Orientation permission denied';
          this.broadcastState();
          return { success: false, message: 'Orientation sensor permission was denied' };
        }
      }

      this.bindSensorListeners();
      this.state.trackingMode = 'sensors';
      this.state.sensorHealth = 'good';
      this.state.statusMessage = 'Sensors active: Walk in real life!';
      this.broadcastState();

      return { success: true, message: 'Sensors connected successfully!' };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.state.sensorHealth = 'unavailable';
      this.state.statusMessage = `Sensor error: ${errorMsg}`;
      this.broadcastState();
      return { success: false, message: errorMsg };
    }
  }

  private bindSensorListeners() {
    window.removeEventListener('devicemotion', this.handleDeviceMotion);
    window.removeEventListener('deviceorientation', this.handleDeviceOrientation);
    window.removeEventListener('deviceorientationabsolute' as any, this.handleDeviceOrientation as any);
    window.removeEventListener('orientationchange', this.updateScreenOrientation);

    window.addEventListener('devicemotion', this.handleDeviceMotion, { passive: true });
    window.addEventListener('deviceorientation', this.handleDeviceOrientation, { passive: true });
    window.addEventListener('orientationchange', this.updateScreenOrientation, { passive: true });
  }

  /**
   * INVARIANT-NORM SCHMITT TRIGGER PEDOMETER
   * Physics principle:
   * The vector norm |g| = sqrt(x² + y² + z²) of static gravity is strictly constant (9.81 m/s²)
   * across ANY 3D phone rotation (looking up, down, landscape, portrait).
   * Only physical heel-strike impacts produce an impulse > 11.5 m/s².
   */
  private handleDeviceMotion = (event: DeviceMotionEvent) => {
    const acc = event.accelerationIncludingGravity;
    if (!acc || acc.x === null || acc.y === null || acc.z === null) return;

    const x = acc.x || 0;
    const y = acc.y || 0;
    const z = acc.z || 0;

    // 1. Compute 3D acceleration magnitude (rotation-invariant)
    const currentMag = Math.hypot(x, y, z);
    this.state.rawAcceleration = Number(currentMag.toFixed(2));

    // 2. Slow baseline tracking to adapt to individual phone calibration offset
    this.gravityBaseline = 0.85 * this.gravityBaseline + 0.15 * currentMag;

    // 3. Dynamic impact delta above baseline
    const dynamicDelta = currentMag - this.gravityBaseline;

    // 4. Threshold tuning: standard walking impact delta is 1.2 to 2.8 m/s²
    // User sensitivity multiplier: 0.7 = sensitive, 1.0 = balanced, 1.4 = firm
    const triggerThreshold = Math.max(0.75, 1.15 * this.settings.stepSensitivity);
    const resetThreshold = triggerThreshold * 0.35;
    this.state.stepThreshold = Number(triggerThreshold.toFixed(2));

    const now = performance.now();
    const minStepIntervalMs = 280; // Up to 3.5 steps/sec

    // 5. Schmitt trigger: fires on sharp impulse, re-arms only after settling
    if (dynamicDelta > triggerThreshold && this.isStepArmed && (now - this.lastStepTimestamp > minStepIntervalMs)) {
      this.isStepArmed = false;
      this.lastStepTimestamp = now;
      this.registerStep(now);
    } else if (dynamicDelta < resetThreshold) {
      // Re-arm trigger when acceleration drops back down
      this.isStepArmed = true;
    }

    // Decay speed to 0 if standing still for >1.3s
    if (now - this.lastStepTimestamp > 1300) {
      if (this.state.isMoving) {
        this.state.isMoving = false;
        this.state.currentSpeed = 0;
        this.state.cadence = 0;
        this.broadcastState();
      }
    }
  };

  /**
   * CANONICAL THREE.JS DEVICE ORIENTATION MATH
   * Intrinsic Tait-Bryan Z-X'-Y'' formulation with screen orientation correction
   * NEVER suffers from gimbal lock, pole singularities, or erratic flips when looking up/down.
   */
  private handleDeviceOrientation = (event: DeviceOrientationEvent) => {
    let alpha = event.alpha || 0;
    const beta = event.beta || 0;
    const gamma = event.gamma || 0;

    // Use iOS webkitCompassHeading if provided for compass alignment
    const iosEvent = event as DeviceOrientationEvent & { webkitCompassHeading?: number };
    if (typeof iosEvent.webkitCompassHeading === 'number' && iosEvent.webkitCompassHeading >= 0) {
      alpha = 360 - iosEvent.webkitCompassHeading;
    }

    // Apply user compass zeroing and manual swipe offset
    const effectiveAlpha = alpha + this.alphaOffsetDeg + this.manualYawDeg;

    const alphaRad = THREE.MathUtils.degToRad(effectiveAlpha);
    const betaRad = THREE.MathUtils.degToRad(beta);
    const gammaRad = THREE.MathUtils.degToRad(gamma);
    const orientRad = THREE.MathUtils.degToRad(this.screenOrientationDeg);

    // Compute canonical 3D camera quaternion
    this.euler.set(betaRad, alphaRad, -gammaRad, 'YXZ');
    this.cameraQuaternion.setFromEuler(this.euler);
    this.cameraQuaternion.multiply(this.q1); // Camera faces out the back/screen
    this.cameraQuaternion.multiply(this.q0.setFromAxisAngle(this.zee, -orientRad));
    this.hasOrientation = true;

    // Extract smooth horizontal heading for compass HUD
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.cameraQuaternion);
    forward.y = 0;
    if (forward.lengthSq() > 0.005) {
      forward.normalize();
      let headingDeg = THREE.MathUtils.radToDeg(Math.atan2(forward.x, -forward.z));
      if (headingDeg < 0) headingDeg += 360;
      this.state.heading = Number(headingDeg.toFixed(1));
    }

    this.state.pitch = Number(beta.toFixed(1));
    this.state.roll = Number(gamma.toFixed(1));
    this.broadcastState();
  };

  /**
   * Manual touch swipe to adjust horizontal heading
   */
  public addManualYaw(deltaDegrees: number) {
    this.manualYawDeg = (this.manualYawDeg + deltaDegrees + 360) % 360;
    this.broadcastState();
  }

  /**
   * Registers a single step, projecting player forward along the camera's current horizontal view
   */
  public registerStep(timestamp: number = performance.now()) {
    const dt = this.lastStepTimestamp > 0 ? (timestamp - this.lastStepTimestamp) / 1000 : 0.55;
    this.lastStepTimestamp = timestamp;

    this.state.stepCount += 1;
    const stride = this.settings.strideLength;
    this.state.distanceMeters = Number((this.state.distanceMeters + stride).toFixed(2));

    // Rolling cadence calculation
    this.stepIntervals.push(dt);
    if (this.stepIntervals.length > 5) this.stepIntervals.shift();
    const avgDt = this.stepIntervals.reduce((a, b) => a + b, 0) / this.stepIntervals.length;

    this.state.cadence = Math.round(60 / Math.max(0.25, Math.min(1.8, avgDt)));
    this.state.currentSpeed = Number((stride / Math.max(0.25, avgDt)).toFixed(2));
    this.state.isMoving = true;

    // Calculate forward movement vector directly from camera horizontal look direction
    let forwardX = 0;
    let forwardZ = -1;

    if (this.hasOrientation) {
      const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.cameraQuaternion);
      forward.y = 0;
      if (forward.lengthSq() > 0.005) {
        forward.normalize();
        forwardX = forward.x;
        forwardZ = forward.z;
      }
    } else {
      const headingRad = (this.state.heading * Math.PI) / 180;
      forwardX = Math.sin(headingRad);
      forwardZ = -Math.cos(headingRad);
    }

    this.state.position.x += forwardX * stride;
    this.state.position.z += forwardZ * stride;

    if (this.settings.audioEnabled) {
      sound.playFootstep();
    }

    if (this.onStepDetected) {
      this.onStepDetected();
    }

    this.broadcastState();
  }

  /**
   * Zero forward heading: resets compass to current forward direction
   */
  public calibrateForwardHeading() {
    this.alphaOffsetDeg = (this.alphaOffsetDeg - this.state.heading + 720) % 360;
    this.manualYawDeg = 0;
    this.state.heading = 0;
    sound.playCalibrateBeep();
    this.state.statusMessage = 'Compass zeroed to current direction';
    this.broadcastState();
  }

  /**
   * Reset session odometer and position
   */
  public resetOdometry() {
    this.state.stepCount = 0;
    this.state.distanceMeters = 0;
    this.state.currentSpeed = 0;
    this.state.cadence = 0;
    this.state.position = { x: 0, y: 1.6, z: 0 };
    this.state.statusMessage = 'Odometer reset to start position';
    sound.playCalibrateBeep();
    this.broadcastState();
  }

  /**
   * Check and start WebXR session if supported
   */
  public async startWebXRSession(): Promise<{ success: boolean; message: string }> {
    if (typeof navigator !== 'undefined' && 'xr' in navigator && (navigator as any).xr?.isSessionSupported) {
      try {
        const supported = await (navigator as any).xr.isSessionSupported('immersive-ar');
        if (supported) {
          return { success: true, message: 'WebXR immersive-ar supported on this device' };
        }
      } catch {}
    }
    return { success: false, message: 'WebXR AR is not supported by your browser (Sensors active)' };
  }

  /**
   * Rear Camera Preview for Safety PiP
   */
  public async startCameraPreview(): Promise<MediaStream | null> {
    try {
      if (this.videoStream) return this.videoStream;
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      });
      this.videoStream = stream;
      return stream;
    } catch (err) {
      console.warn('Camera feed not accessible:', err);
      return null;
    }
  }

  public stopCameraPreview() {
    if (this.videoStream) {
      this.videoStream.getTracks().forEach((track) => track.stop());
      this.videoStream = null;
    }
  }

  /**
   * Keyboard & Virtual Joystick Simulator (for desktop testing & fallback)
   */
  private setupKeyboardListeners() {
    if (typeof window === 'undefined') return;

    window.addEventListener('keydown', (e) => {
      this.keysPressed[e.key.toLowerCase()] = true;
    });

    window.addEventListener('keyup', (e) => {
      this.keysPressed[e.key.toLowerCase()] = false;
    });
  }

  public setJoystickInput(x: number, y: number) {
    this.joystickVector = { x, y };
  }

  public updateSimulation(deltaSec: number) {
    let forward = 0;
    let turn = 0;

    if (this.keysPressed['w'] || this.keysPressed['arrowup']) forward += 1;
    if (this.keysPressed['s'] || this.keysPressed['arrowdown']) forward -= 1;
    if (this.keysPressed['a'] || this.keysPressed['arrowleft']) turn -= 1;
    if (this.keysPressed['d'] || this.keysPressed['arrowright']) turn += 1;

    if (Math.abs(this.joystickVector.y) > 0.05) {
      forward += -this.joystickVector.y;
    }
    if (Math.abs(this.joystickVector.x) > 0.05) {
      turn += this.joystickVector.x;
    }

    if (turn !== 0) {
      this.state.heading = (this.state.heading + turn * 90 * deltaSec + 360) % 360;
    }

    if (forward !== 0) {
      const walkSpeed = 1.35 * forward;
      const moveDist = Math.abs(walkSpeed * deltaSec);
      this.state.distanceMeters = Number((this.state.distanceMeters + moveDist).toFixed(2));
      this.state.currentSpeed = Math.abs(walkSpeed);
      this.state.isMoving = true;

      const headingRad = (this.state.heading * Math.PI) / 180;
      this.state.position.x += Math.sin(headingRad) * walkSpeed * deltaSec;
      this.state.position.z -= Math.cos(headingRad) * walkSpeed * deltaSec;

      this.simStepAccumulator += moveDist;
      if (this.simStepAccumulator >= this.settings.strideLength) {
        this.simStepAccumulator -= this.settings.strideLength;
        this.state.stepCount += 1;
        this.state.cadence = 105;
        if (this.settings.audioEnabled) sound.playFootstep();
        if (this.onStepDetected) this.onStepDetected();
      }

      this.broadcastState();
    } else if (this.state.trackingMode === 'simulator' && this.state.isMoving) {
      this.state.isMoving = false;
      this.state.currentSpeed = 0;
      this.state.cadence = 0;
      this.broadcastState();
    }
  }

  public cleanup() {
    window.removeEventListener('devicemotion', this.handleDeviceMotion);
    window.removeEventListener('deviceorientation', this.handleDeviceOrientation);
    window.removeEventListener('deviceorientationabsolute' as any, this.handleDeviceOrientation as any);
    window.removeEventListener('orientationchange', this.updateScreenOrientation);
    this.stopCameraPreview();
  }
}
