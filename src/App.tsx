/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef, useState, useCallback } from 'react';
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

  // User Settings with default values
  const [settings, setSettings] = useState<UserSettings>(() => {
    const saved = localStorage.getItem('webar_walking_settings');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // fallback
      }
    }
    return {
      strideLength: 0.74,
      stepSensitivity: 1.0,
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
    stepThreshold: 11.2,
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
    localStorage.setItem('webar_walking_settings', JSON.stringify(settings));
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
      world.update(tracker.getState(), deltaSec, currentTime / 1000);

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
      showToast('Sensors connected! Hold phone upright and walk.');
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
    showToast('Compass heading zeroed to front direction.');
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

  return (
    <div className="relative w-full h-full overflow-hidden bg-slate-950 font-sans select-none">
      {/* 3D WebGL Canvas Container */}
      <div ref={containerRef} className="absolute inset-0 w-full h-full z-0 cursor-grab" />

      {/* Real-to-Virtual Walking Tactical HUD */}
      <WalkHUD
        motion={motion}
        settings={settings}
        collectibles={collectibles}
        lastFoundRelic={lastFoundRelic}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenPhoneConnect={() => setIsPhoneConnectOpen(true)}
        onToggleSafetyCamera={handleToggleSafetyCamera}
        onToggleMute={handleToggleMute}
        onZeroHeading={handleZeroHeading}
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
