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
    stepThreshold: 11.2,
    statusMessage: 'Ready to track',
  };

  private settings: UserSettings;
  private onStateChange: (state: MotionState) => void;

  // Sensor processing internals
  private lastAccelMag: number = 9.8;
  private accelFilter: number = 9.8;
  private lastStepTimestamp: number = 0;
  private stepIntervals: number[] = [];
  private headingOffset: number = 0; // Calibration offset
  private isCalibrated: boolean = false;

  // WebXR session internals
  private xrSession: any = null;
  private xrRefSpace: any = null;
  private prevXrPosition: { x: number; y: number; z: number } | null = null;

  // Keyboard simulator internals
  private keysPressed: { [key: string]: boolean } = {};
  private joystickVector: { x: number; y: number } = { x: 0, y: 0 };
  private simStepAccumulator: number = 0;

  // Camera video element for safety PiP
  private videoStream: MediaStream | null = null;
  private videoElement: HTMLVideoElement | null = null;

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
    // Adapt step threshold based on user sensitivity
    this.state.stepThreshold = 10.0 + this.settings.stepSensitivity * 1.2;
    this.broadcastState();
  }

  public getState(): MotionState {
    return { ...this.state, position: { ...this.state.position } };
  }

  private broadcastState() {
    this.onStateChange(this.getState());
  }

  /**
   * Request device sensors (iOS 13+ requires explicit permission from user gesture)
   */
  public async enableSensors(): Promise<{ success: boolean; message: string }> {
    try {
      this.state.sensorHealth = 'calibrating';
      this.state.statusMessage = 'Requesting motion sensors...';
      this.broadcastState();

      // Check for iOS Permission API
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
          this.state.statusMessage = 'Motion sensor permission denied';
          this.broadcastState();
          return { success: false, message: 'Motion permission denied by user' };
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
      this.state.statusMessage = 'Sensor Pedometer & Gyro Active';
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

  private handleDeviceMotion = (event: DeviceMotionEvent) => {
    if (this.state.trackingMode === 'webxr') return;

    // Use acceleration with gravity if available, or pure acceleration
    const acc = event.accelerationIncludingGravity || event.acceleration;
    if (!acc || acc.x === null || acc.y === null || acc.z === null) return;

    const x = acc.x || 0;
    const y = acc.y || 0;
    const z = acc.z || 0;

    // Magnitude of 3D acceleration vector
    const rawMag = Math.hypot(x, y, z);
    this.state.rawAcceleration = rawMag;

    // Low-pass filter to capture gravity baseline, high-pass for dynamic step impulse
    const alpha = 0.85;
    this.accelFilter = alpha * this.accelFilter + (1 - alpha) * rawMag;
    const dynamicDelta = rawMag - this.accelFilter;

    const now = performance.now();
    const minStepIntervalMs = 320; // Human biomechanical limit: max ~3.1 steps/sec

    // Detect step peak
    const threshold = this.settings.stepSensitivity * 1.4;
    if (dynamicDelta > threshold && (now - this.lastStepTimestamp) > minStepIntervalMs) {
      this.registerStep(now);
    }

    // Decay speed if user stopped walking
    if (now - this.lastStepTimestamp > 1400) {
      this.state.isMoving = false;
      this.state.currentSpeed = Math.max(0, this.state.currentSpeed * 0.92);
      this.state.cadence = 0;
      this.broadcastState();
    }
  };

  private handleDeviceOrientation = (event: DeviceOrientationEvent) => {
    let rawHeading = 0;

    // iOS Safari provides webkitCompassHeading directly relative to magnetic north
    const iosEvent = event as DeviceOrientationEvent & { webkitCompassHeading?: number };
    if (typeof iosEvent.webkitCompassHeading === 'number') {
      rawHeading = iosEvent.webkitCompassHeading;
    } else if (typeof event.alpha === 'number') {
      // Android: alpha is angle around z-axis [0, 360)
      rawHeading = (360 - event.alpha) % 360;
    }

    // Apply user zeroing offset
    const calibratedHeading = (rawHeading - this.headingOffset + 360) % 360;
    this.state.heading = calibratedHeading;
    this.state.pitch = event.beta || 0;
    this.state.roll = event.gamma || 0;

    this.broadcastState();
  };

  /**
   * Registers a single physical step, translating into forward motion along current heading
   */
  public registerStep(timestamp: number = performance.now()) {
    const dt = this.lastStepTimestamp > 0 ? (timestamp - this.lastStepTimestamp) / 1000 : 0.6;
    this.lastStepTimestamp = timestamp;

    this.state.stepCount += 1;
    const stride = this.settings.strideLength;
    this.state.distanceMeters += stride;

    // Keep rolling window of last 4 step intervals for cadence calculation
    this.stepIntervals.push(dt);
    if (this.stepIntervals.length > 5) this.stepIntervals.shift();
    const avgDt = this.stepIntervals.reduce((a, b) => a + b, 0) / this.stepIntervals.length;

    this.state.cadence = Math.round(60 / Math.max(0.3, avgDt));
    this.state.currentSpeed = Number((stride / Math.max(0.3, avgDt)).toFixed(2));
    this.state.isMoving = true;

    // Move forward along heading angle
    const headingRad = (this.state.heading * Math.PI) / 180;
    this.state.position.x += Math.sin(headingRad) * stride;
    this.state.position.z -= Math.cos(headingRad) * stride;

    if (this.settings.audioEnabled) {
      sound.playFootstep();
    }

    this.broadcastState();
  }

  /**
   * Calibrate heading: sets current real-world phone orientation to 0° forward
   */
  public calibrateForwardHeading() {
    this.headingOffset = (this.headingOffset + this.state.heading) % 360;
    this.state.heading = 0;
    this.isCalibrated = true;
    sound.playCalibrateBeep();
    this.state.statusMessage = 'Compass zeroed to forward direction';
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
    this.state.statusMessage = 'Odometer & position reset';
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
      return { success: false, message: 'WebXR immersive-ar not supported on this browser/device.' };
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
      this.state.statusMessage = 'WebXR 6DoF SLAM Session Active';
      this.broadcastState();

      session.addEventListener('end', () => {
        this.xrSession = null;
        this.xrRefSpace = null;
        this.state.trackingMode = 'sensors';
        this.state.statusMessage = 'WebXR session ended, switched to Sensors';
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
   * Called by Three.js render loop when WebXR frame is available
   */
  public processXRFrame(frame: any) {
    if (!frame || !this.xrRefSpace) return;
    const pose = frame.getViewerPose(this.xrRefSpace);
    if (!pose) return;

    const { position, orientation } = pose.transform;
    const x = position.x;
    const y = position.y;
    const z = position.z;

    // Compute real-world walking displacement
    if (this.prevXrPosition) {
      const dx = x - this.prevXrPosition.x;
      const dz = z - this.prevXrPosition.z;
      const dist = Math.hypot(dx, dz);

      if (dist > 0.005) {
        this.state.distanceMeters += dist;
        this.state.position.x = x;
        this.state.position.y = y;
        this.state.position.z = z;
        this.state.isMoving = true;

        // Approximate steps from SLAM displacement
        const stride = this.settings.strideLength;
        const estimatedSteps = Math.floor(this.state.distanceMeters / stride);
        if (estimatedSteps > this.state.stepCount) {
          this.state.stepCount = estimatedSteps;
          if (this.settings.audioEnabled) sound.playFootstep();
        }
      } else {
        this.state.isMoving = false;
      }
    } else {
      this.prevXrPosition = { x, y, z };
    }

    // Extract yaw from quaternion [x, y, z, w]
    const qy = orientation.y;
    const qw = orientation.w;
    const yaw = Math.atan2(2 * (qw * qy + orientation.x * orientation.z), 1 - 2 * (qy * qy + orientation.z * orientation.z));
    this.state.heading = ((yaw * 180) / Math.PI + 360) % 360;

    this.broadcastState();
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
   * Tick simulation called from requestAnimationFrame loop
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
      const walkSpeed = 1.35 * forward; // ~1.35 m/s casual walking speed
      const moveDist = Math.abs(walkSpeed * deltaSec);
      this.state.distanceMeters += moveDist;
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
