/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { IslandWorld } from './world/IslandWorld';
import { MotionTracker } from './engine/MotionTracker';
import { WalkHUD } from './components/WalkHUD';
import { SafetyCameraPiP } from './components/SafetyCameraPiP';
import { CalibrationModal } from './components/CalibrationModal';
import { OnboardingModal } from './components/OnboardingModal';
import { PhoneConnectModal } from './components/PhoneConnectModal';
import { VirtualJoystick } from './components/VirtualJoystick';
import { MotionState, UserSettings, Collectible } from './types';
import { sound } from './audio/SoundEffects';

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<IslandWorld | null>(null);
  const trackerRef = useRef<MotionTracker | null>(null);
  const [isPhoneConnectOpen, setIsPhoneConnectOpen] = useState<boolean>(false);
  const [isStepPulse, setIsStepPulse] = useState<boolean>(false);

  // Drag-to-rotate touch tracking
  const dragStartRef = useRef<{ x: number } | null>(null);

  // User Settings with default values
  const [settings, setSettings] = useState<UserSettings>(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const saved = window.localStorage.getItem('webar_walking_settings');
        if (saved) {
          return JSON.parse(saved);
        }
      }
    } catch {
      // Ignore private browsing or cross-origin localStorage errors
    }
    return {
      strideLength: 0.74,
      stepSensitivity: 0.9, // Responsive default
      audioEnabled: true,
      safetyPipEnabled: false,
      headBobbing: true,
      showDiagnostics: false,
      showJoystick: true,
    };
  });

  // Motion Tracking State
  const [motion, setMotion] = useState<MotionState>({
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
    stepThreshold: 0.8,
    statusMessage: 'Ready to walk',
  });

  // Collectibles State
  const [collectibles, setCollectibles] = useState<Collectible[]>([]);
  const [lastFoundRelic, setLastFoundRelic] = useState<Collectible | null>(null);

  // Modals & Drawers
  const [isOnboardingOpen, setIsOnboardingOpen] = useState<boolean>(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [notification, setNotification] = useState<string | null>(null);

  // Save settings on change
  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem('webar_walking_settings', JSON.stringify(settings));
      }
    } catch {
      // Ignore private browsing storage errors
    }
    sound.setMuted(!settings.audioEnabled);
    if (trackerRef.current) {
      trackerRef.current.updateSettings(settings);
    }
  }, [settings]);

  // Show transient toast notification
  const showToast = useCallback((msg: string) => {
    setNotification(msg);
    setTimeout(() => {
      setNotification((curr) => (curr === msg ? null : curr));
    }, 3500);
  }, []);

  // Initialize Motion Tracker and 3D Scene
  useEffect(() => {
    if (!containerRef.current) return;

    // 1. Initialize Motion Tracker
    const tracker = new MotionTracker(settings, (newState) => {
      setMotion(newState);
    });
    trackerRef.current = tracker;

    // Step flash callback
    tracker.onStepDetected = () => {
      setIsStepPulse(true);
      setTimeout(() => setIsStepPulse(false), 200);
    };

    // 2. Initialize Three.js Island World
    const world = new IslandWorld(containerRef.current);
    worldRef.current = world;
    setCollectibles([...world.collectibles]);

    // Handle relic collection
    world.onCollectibleFound = (relic) => {
      setCollectibles([...world.collectibles]);
      setLastFoundRelic(relic);
      showToast(`✨ Found: ${relic.name}!`);
      setTimeout(() => {
        setLastFoundRelic(null);
      }, 4500);
    };

    // 3. Render and Simulation Loop
    let lastTime = performance.now();
    let animId: number;

    const loop = (currentTime: number) => {
      const deltaSec = Math.min(0.1, (currentTime - lastTime) / 1000);
      lastTime = currentTime;

      // Update keyboard / joystick simulation
      tracker.updateSimulation(deltaSec);

      // Update 3D World visuals & camera
      world.update(tracker.getState(), tracker, deltaSec, currentTime / 1000);

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animId);
      tracker.cleanup();
      world.dispose();
      trackerRef.current = null;
      worldRef.current = null;
    };
  }, []);

  // Handlers
  const handleStartWalking = async () => {
    if (!trackerRef.current) return;
    const res = await trackerRef.current.enableSensors();
    setIsOnboardingOpen(false);
    if (res.success) {
      showToast('3D Gyro & Pedometer connected! Walk forward.');
    } else {
      showToast(res.message);
    }
  };

  const handleStartSimulator = () => {
    setIsOnboardingOpen(false);
    showToast('Simulator Active. Use W/S/A/D or the on-screen joystick.');
  };

  const handleStartWebXR = async () => {
    if (!trackerRef.current) return;
    const res = await trackerRef.current.startWebXRSession();
    showToast(res.message);
  };

  const handleZeroHeading = () => {
    if (!trackerRef.current) return;
    trackerRef.current.calibrateForwardHeading();
    showToast('Compass heading zeroed to current direction.');
  };

  const handleResetOdometer = () => {
    if (!trackerRef.current) return;
    trackerRef.current.resetOdometry();
    showToast('Session odometer reset.');
  };

  const handleToggleSafetyCamera = () => {
    setSettings((prev) => ({
      ...prev,
      safetyPipEnabled: !prev.safetyPipEnabled,
    }));
  };

  const handleToggleMute = () => {
    setSettings((prev) => ({
      ...prev,
      audioEnabled: !prev.audioEnabled,
    }));
  };

  const handleCycleSensitivity = () => {
    setSettings((prev) => {
      let nextSens = 0.9;
      if (prev.stepSensitivity > 1.2) nextSens = 0.65; // High
      else if (prev.stepSensitivity <= 0.7) nextSens = 0.9; // Balanced
      else nextSens = 1.4; // Firm
      showToast(`Step Sensitivity: ${nextSens <= 0.7 ? 'High' : nextSens <= 1.0 ? 'Balanced' : 'Firm'}`);
      return { ...prev, stepSensitivity: nextSens };
    });
  };

  // Touch drag to look around
  const handlePointerDown = (e: React.PointerEvent) => {
    dragStartRef.current = { x: e.clientX };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragStartRef.current || !trackerRef.current) return;
    const dx = e.clientX - dragStartRef.current.x;
    dragStartRef.current = { x: e.clientX };
    trackerRef.current.addManualYaw(-dx * 0.35);
  };

  const handlePointerUp = () => {
    dragStartRef.current = null;
  };

  return (
    <div className="relative w-full h-full overflow-hidden bg-slate-950 font-sans select-none">
      {/* 3D WebGL Canvas Container with Drag-to-Look */}
      <div
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className="absolute inset-0 w-full h-full z-0 cursor-grab active:cursor-grabbing touch-none"
      />

      {/* Real-to-Virtual Walking Tactical HUD */}
      <WalkHUD
        motion={motion}
        settings={settings}
        collectibles={collectibles}
        lastFoundRelic={lastFoundRelic}
        isStepPulse={isStepPulse}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenPhoneConnect={() => setIsPhoneConnectOpen(true)}
        onToggleSafetyCamera={handleToggleSafetyCamera}
        onToggleMute={handleToggleMute}
        onZeroHeading={handleZeroHeading}
        onCycleSensitivity={handleCycleSensitivity}
        onManualStep={() => trackerRef.current?.registerStep()}
      />

      {/* Safety Rear Camera Picture-in-Picture */}
      <SafetyCameraPiP
        enabled={settings.safetyPipEnabled}
        onToggle={handleToggleSafetyCamera}
        startCameraStream={() =>
          trackerRef.current
            ? trackerRef.current.startCameraPreview()
            : Promise.resolve(null)
        }
        stopCameraStream={() => trackerRef.current?.stopCameraPreview()}
      />

      {/* On-Screen Virtual Touch Joystick */}
      <VirtualJoystick
        visible={settings.showJoystick}
        onMove={(x, y) => trackerRef.current?.setJoystickInput(x, y)}
      />

      {/* First-Time Onboarding Modal */}
      <OnboardingModal
        isOpen={isOnboardingOpen}
        onStartWalking={handleStartWalking}
        onStartSimulator={handleStartSimulator}
      />

      {/* Phone Connect & QR Code Modal */}
      <PhoneConnectModal
        isOpen={isPhoneConnectOpen}
        onClose={() => setIsPhoneConnectOpen(false)}
      />

      {/* Calibration & Settings Drawer */}
      <CalibrationModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onUpdateSettings={setSettings}
        onCalibrateHeading={handleZeroHeading}
        onResetOdometer={handleResetOdometer}
        currentMode={motion.trackingMode}
        onStartWebXR={handleStartWebXR}
        onEnableSensors={handleStartWalking}
      />

      {/* Transient Notification Toast */}
      {notification && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-40 pointer-events-none transition-all">
          <div className="px-4 py-2 rounded-full bg-slate-900/90 border border-cyan-500/40 text-cyan-200 text-xs font-medium shadow-xl backdrop-blur-md">
            {notification}
          </div>
        </div>
      )}
    </div>
  );
}
