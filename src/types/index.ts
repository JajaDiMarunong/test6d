export type TrackingMode = 'webxr' | 'sensors' | 'simulator';

export type SensorHealth = 'good' | 'calibrating' | 'unavailable' | 'denied' | 'idle';

export interface MotionState {
  position: { x: number; y: number; z: number };
  heading: number; // 0 - 360 degrees
  pitch: number;
  roll: number;
  stepCount: number;
  distanceMeters: number;
  currentSpeed: number; // m/s
  cadence: number; // steps per minute
  isMoving: boolean;
  trackingMode: TrackingMode;
  sensorHealth: SensorHealth;
  rawAcceleration: number;
  stepThreshold: number;
  statusMessage: string;
}

export interface Collectible {
  id: string;
  name: string;
  position: [number, number, number];
  collected: boolean;
  color: string;
  glowColor: string;
  title: string;
  lore: string;
}

export interface UserSettings {
  strideLength: number; // in meters, e.g. 0.74
  stepSensitivity: number; // multiplier, 0.6 (more sensitive) to 1.8 (less sensitive)
  audioEnabled: boolean;
  safetyPipEnabled: boolean;
  headBobbing: boolean;
  showDiagnostics: boolean;
  showJoystick: boolean;
}

export interface IslandWaypoint {
  name: string;
  position: [number, number, number];
  distanceToPlayer?: number;
}
