import * as THREE from 'three';
import { MotionState, TrackingMode, SensorHealth, UserSettings } from '../types';
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
    rawAcceleration: 0,
    stepThreshold: 0.85,
    statusMessage: 'Ready to walk',
  };

  private settings: UserSettings;
  private onStateChange: (state: MotionState) => void;

  // 3D Quaternion Device Orientation
  public deviceOrientationQuat: THREE.Quaternion = new THREE.Quaternion();
  public hasOrientation: boolean = false;
  private headingOffset: number = 0;
  private manualYawOffset: number = 0; // touch drag adjust
  private euler = new THREE.Euler();
  private q0 = new THREE.Quaternion();
  private q1 = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5)); // -PI/2 around X
  private zee = new THREE.Vector3(0, 0, 1);

  // Dynamic Pedometer internals
  private gravVector = { x: 0, y: 9.81, z: 0 };
  private lastFastTiltTimestamp: number = 0;
  private lastStepTimestamp: number = 0;
  private stepIntervals: number[] = [];
  private wasRising: boolean = false;
  private prevSample: number = 0;

  // WebXR session internals
  private xrSession: any = null;
  private xrRefSpace: any = null;

  // Desktop simulator & touch joystick
  private keysPressed: { [key: string]: boolean } = {};
  private joystickVector: { x: number; y: number } = { x: 0, y: 0 };
  private simStepAccumulator: number = 0;

  // Camera video element for safety PiP
  private videoStream: MediaStream | null = null;

  // Step callback for UI flash pulse
  public onStepDetected?: () => void;

  constructor(
    initialSettings: UserSettings,
    onStateChange: (state: MotionState) => void
  ) {
    this.settings = initialSettings;
    this.onStateChange = onStateChange;

    this.setupKeyboardListeners();
  }

  public updateSettings(newSettings: UserSettings) {
    this.settings = newSettings;
    this.broadcastState();
  }

  public getState(): MotionState {
    return { ...this.state, position: { ...this.state.position } };
  }

  public getHeadingOffset(): number {
    return this.headingOffset;
  }

  public getManualYawOffset(): number {
    return this.manualYawOffset;
  }

  private broadcastState() {
    this.onStateChange(this.getState());
  }

  /**
   * Request device sensors (iOS 13+ requires explicit user gesture permission)
   */
  public async enableSensors(): Promise<{ success: boolean; message: string }> {
    try {
      this.state.sensorHealth = 'calibrating';
      this.state.statusMessage = 'Requesting motion sensors...';
      this.broadcastState();

      // Check iOS 13+ permission prompts
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
          return { success: false, message: 'Motion sensor permission denied by user' };
        }
      }

      if (typeof DeviceOrientationEventAny?.requestPermission === 'function') {
        const orientPerm = await DeviceOrientationEventAny.requestPermission();
        if (orientPerm !== 'granted') {
          this.state.sensorHealth = 'denied';
          this.state.statusMessage = 'Orientation permission denied';
          this.broadcastState();
          return { success: false, message: 'Orientation permission denied by user' };
        }
      }

      this.bindSensorListeners();
      this.state.trackingMode = 'sensors';
      this.state.sensorHealth = 'good';
      this.state.statusMessage = '3D Quaternion Gyro & Pedometer Active';
      this.broadcastState();

      return { success: true, message: 'Sensors connected successfully' };
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

    window.addEventListener('devicemotion', this.handleDeviceMotion, { passive: true });
    window.addEventListener('deviceorientation', this.handleDeviceOrientation, { passive: true });
  }

  /**
   * Dynamic Step Detector: accurately captures human foot strikes while ignoring looking up/down
   */
  private handleDeviceMotion = (event: DeviceMotionEvent) => {
    if (this.state.trackingMode === 'webxr') return;

    // 1. Detect violent phone tilts: Only lock out if wrist flip is very fast (>95 deg/s)
    const rot = event.rotationRate;
    if (rot && Math.abs(rot.beta || 0) > 95) {
      this.lastFastTiltTimestamp = performance.now();
    }

    const now = performance.now();
    // 180ms brief suppression after a fast wrist tilt
    if (now - this.lastFastTiltTimestamp < 180) {
      this.state.rawAcceleration = 0;
      return;
    }

    // 2. Extract vertical bounce along Earth gravity
    const accWithG = event.accelerationIncludingGravity || { x: 0, y: 9.81, z: 0 };
    const rawX = accWithG.x || 0;
    const rawY = accWithG.y || 0;
    const rawZ = accWithG.z || 0;

    // Low-pass filter to follow gravity vector
    const gravAlpha = 0.88;
    this.gravVector.x = gravAlpha * this.gravVector.x + (1 - gravAlpha) * rawX;
    this.gravVector.y = gravAlpha * this.gravVector.y + (1 - gravAlpha) * rawY;
    this.gravVector.z = gravAlpha * this.gravVector.z + (1 - gravAlpha) * rawZ;

    const gLen = Math.hypot(this.gravVector.x, this.gravVector.y, this.gravVector.z);
    if (gLen < 1.0) return;

    // Dynamic linear acceleration
    const linX = rawX - this.gravVector.x;
    const linY = rawY - this.gravVector.y;
    const linZ = rawZ - this.gravVector.z;

    // Dot product with unit gravity: true vertical impact bounce
    const verticalBounce = (linX * this.gravVector.x + linY * this.gravVector.y + linZ * this.gravVector.z) / gLen;
    const bounceMagnitude = Math.max(0, verticalBounce);

    this.state.rawAcceleration = Number(bounceMagnitude.toFixed(2));

    // Dynamic threshold: 0.70m/s² base multiplied by user sensitivity
    const activeThreshold = Math.max(0.55, 0.85 * this.settings.stepSensitivity);
    this.state.stepThreshold = Number(activeThreshold.toFixed(2));

    const minStepIntervalMs = 260; // Max ~3.8 steps/sec

    // Zero-derivative peak detection
    const isRising = bounceMagnitude > this.prevSample;
    const isPeak = this.wasRising && !isRising && this.prevSample > activeThreshold;
    this.wasRising = isRising;
    this.prevSample = bounceMagnitude;

    if (isPeak && (now - this.lastStepTimestamp > minStepIntervalMs)) {
      this.registerStep(now);
    }

    // Decay speed if standing still
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
   * Full 3D Quaternion Device Orientation: ZERO gimbal lock or glitching when looking up/down!
   */
  private handleDeviceOrientation = (event: DeviceOrientationEvent) => {
    const alpha = event.alpha || 0;
    const beta = event.beta || 0;
    const gamma = event.gamma || 0;
    const screenAngle = (window.screen?.orientation?.angle || 0);

    const alphaRad = THREE.MathUtils.degToRad(alpha);
    const betaRad = THREE.MathUtils.degToRad(beta);
    const gammaRad = THREE.MathUtils.degToRad(gamma);
    const orientRad = THREE.MathUtils.degToRad(screenAngle);

    // Three.js Quaternion Tait-Bryan formulation
    this.euler.set(betaRad, alphaRad, -gammaRad, 'YXZ');
    this.deviceOrientationQuat.setFromEuler(this.euler);
    this.deviceOrientationQuat.multiply(this.q1); // Camera faces out device screen/back
    this.deviceOrientationQuat.multiply(this.q0.setFromAxisAngle(this.zee, -orientRad));
    this.hasOrientation = true;

    // Calculate smooth horizontal look forward vector for compass heading
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.deviceOrientationQuat);
    forward.y = 0;
    if (forward.lengthSq() > 0.008) {
      forward.normalize();
      let headingDeg = THREE.MathUtils.radToDeg(Math.atan2(forward.x, -forward.z));
      if (headingDeg < 0) headingDeg += 360;
      const finalHeading = (headingDeg - this.headingOffset + this.manualYawOffset + 720) % 360;
      this.state.heading = Number(finalHeading.toFixed(1));
    }

    this.state.pitch = Number(beta.toFixed(1));
    this.state.roll = Number(gamma.toFixed(1));
    this.broadcastState();
  };

  /**
   * Manual touch swipe to adjust horizontal heading
   */
  public addManualYaw(deltaDegrees: number) {
    this.manualYawOffset = (this.manualYawOffset + deltaDegrees + 360) % 360;
    this.state.heading = (this.state.heading + deltaDegrees + 360) % 360;
    this.broadcastState();
  }

  /**
   * Registers a single verified step, projecting avatar forward in virtual world
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

    // Project forward along 360° heading: North = -Z, East = +X, South = +Z, West = -X
    const headingRad = (this.state.heading * Math.PI) / 180;
    this.state.position.x += Math.sin(headingRad) * stride;
    this.state.position.z -= Math.cos(headingRad) * stride;

    if (this.settings.audioEnabled) {
      sound.playFootstep();
    }

    if (this.onStepDetected) {
      this.onStepDetected();
    }

    this.broadcastState();
  }

  /**
   * Zero forward heading: sets current look direction to 0° (North)
   */
  public calibrateForwardHeading() {
    this.headingOffset = (this.headingOffset + this.state.heading) % 360;
    this.manualYawOffset = 0;
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
   * Check if native WebXR 6DoF AR is supported
   */
  public async checkWebXRSupport(): Promise<boolean> {
    if (typeof navigator !== 'undefined' && 'xr' in navigator && (navigator as any).xr?.isSessionSupported) {
      try {
        return await (navigator as any).xr.isSessionSupported('immersive-ar');
      } catch {
        return false;
      }
    }
    return false;
  }

  /**
   * Start native WebXR Immersive AR 6DoF session
   */
  public async startWebXRSession(): Promise<{ success: boolean; message: string }> {
    const isSupported = await this.checkWebXRSupport();
    if (!isSupported) {
      return { success: false, message: 'WebXR immersive-ar not supported on this device/browser.' };
    }

    try {
      const xr = (navigator as any).xr;
      const session = await xr.requestSession('immersive-ar', {
        requiredFeatures: ['local-floor'],
        optionalFeatures: ['dom-overlay', 'unbounded', 'hit-test'],
      });

      this.xrSession = session;
      this.xrRefSpace = await session.requestReferenceSpace('local-floor');

      this.state.trackingMode = 'webxr';
      this.state.sensorHealth = 'good';
      this.state.statusMessage = 'WebXR 6DoF SLAM Active';
      this.broadcastState();

      session.addEventListener('end', () => {
        this.xrSession = null;
        this.xrRefSpace = null;
        this.state.trackingMode = 'sensors';
        this.state.statusMessage = 'WebXR session ended, active Sensors';
        this.broadcastState();
      });

      return { success: true, message: 'WebXR 6DoF session started' };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, message: `Could not start WebXR: ${msg}` };
    }
  }

  public endWebXRSession() {
    if (this.xrSession) {
      this.xrSession.end().catch(() => {});
      this.xrSession = null;
    }
  }

  /**
   * Camera preview for safety PiP
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
   * Keyboard & Virtual Joystick Simulation for desktop dev / preview testing
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

  /**
   * Simulation tick called from render loop
   */
  public updateSimulation(deltaSec: number) {
    let forward = 0;
    let turn = 0;

    // Keyboard inputs
    if (this.keysPressed['w'] || this.keysPressed['arrowup']) forward += 1;
    if (this.keysPressed['s'] || this.keysPressed['arrowdown']) forward -= 1;
    if (this.keysPressed['a'] || this.keysPressed['arrowleft']) turn -= 1;
    if (this.keysPressed['d'] || this.keysPressed['arrowright']) turn += 1;

    // Joystick inputs
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

      // Update position along heading
      const headingRad = (this.state.heading * Math.PI) / 180;
      this.state.position.x += Math.sin(headingRad) * walkSpeed * deltaSec;
      this.state.position.z -= Math.cos(headingRad) * walkSpeed * deltaSec;

      // Simulate steps accumulation
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
    this.endWebXRSession();
    this.stopCameraPreview();
  }
}
