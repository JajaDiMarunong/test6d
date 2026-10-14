import React from 'react';
import {
  Compass,
  Footprints,
  Activity,
  Flame,
  Volume2,
  VolumeX,
  Camera,
  Sliders,
  Sparkles,
  Zap,
  Smartphone,
} from 'lucide-react';
import { MotionState, Collectible, UserSettings } from '../types';

interface WalkHUDProps {
  motion: MotionState;
  settings: UserSettings;
  collectibles: Collectible[];
  lastFoundRelic: Collectible | null;
  isStepPulse: boolean;
  onOpenSettings: () => void;
  onOpenPhoneConnect: () => void;
  onToggleSafetyCamera: () => void;
  onToggleMute: () => void;
  onZeroHeading: () => void;
  onCycleSensitivity: () => void;
  onManualStep: () => void;
}

export const WalkHUD: React.FC<WalkHUDProps> = ({
  motion,
  settings,
  collectibles,
  lastFoundRelic,
  isStepPulse,
  onOpenSettings,
  onOpenPhoneConnect,
  onToggleSafetyCamera,
  onToggleMute,
  onZeroHeading,
  onCycleSensitivity,
  onManualStep,
}) => {
  const collectedCount = collectibles.filter((c) => c.collected).length;
  const totalCount = collectibles.length;

  // Approximate calories: ~0.04 kcal per step for average adult
  const caloriesBurned = Math.round(motion.stepCount * 0.04);

  // Compass cardinal direction
  const getCardinal = (deg: number) => {
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const index = Math.round(((deg % 360) / 45)) % 8;
    return directions[index];
  };

  const currentCardinal = getCardinal(motion.heading);

  const getSensitivityLabel = () => {
    if (settings.stepSensitivity <= 0.7) return 'High';
    if (settings.stepSensitivity <= 1.1) return 'Balanced';
    return 'Firm';
  };

  return (
    <div className="absolute inset-0 pointer-events-none select-none flex flex-col justify-between p-3 sm:p-5 z-20">
      {/* Top Header Floating Bar */}
      <div className="flex items-center justify-between w-full max-w-5xl mx-auto gap-2 pointer-events-auto">
        {/* Left: Compass & Heading */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-2xl bg-slate-900/80 backdrop-blur-md border border-white/10 shadow-lg text-white">
          <button
            onClick={onZeroHeading}
            title="Tap to zero heading forward"
            className="flex items-center gap-2 hover:text-cyan-400 transition cursor-pointer min-h-[36px]"
          >
            <Compass className="w-5 h-5 text-cyan-400 shrink-0" />
            <div className="flex flex-col text-left">
              <span className="font-mono text-xs font-bold leading-tight">
                {Math.round(motion.heading)}° {currentCardinal}
              </span>
              <span className="text-[9px] text-slate-400 uppercase tracking-wider">
                Heading
              </span>
            </div>
          </button>
        </div>

        {/* Center: Tracking Engine Badge */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/80 backdrop-blur-md border border-white/10 text-xs">
          <span
            className={`w-2 h-2 rounded-full transition-colors ${
              isStepPulse
                ? 'bg-emerald-400 scale-125'
                : motion.isMoving
                ? 'bg-emerald-400 animate-ping'
                : 'bg-cyan-400'
            }`}
          />
          <span className="font-medium text-slate-200">
            {motion.trackingMode === 'webxr'
              ? 'WebXR 6DoF SLAM'
              : motion.trackingMode === 'sensors'
              ? '3D Gyro & Adaptive Pedometer'
              : 'Desktop Dev Simulator'}
          </span>
          <span className="text-slate-500" aria-hidden="true">·</span>
          <span className="text-slate-400 font-mono text-[11px]">
            {motion.isMoving ? `${motion.currentSpeed.toFixed(1)} m/s` : 'Standing'}
          </span>
        </div>

        {/* Right: Quick Action Controls */}
        <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-2xl bg-slate-900/80 backdrop-blur-md border border-white/10 shadow-lg">
          <button
            onClick={onOpenPhoneConnect}
            aria-label="Open on Phone QR Code"
            title="Open on phone / scan QR"
            className="flex items-center gap-1.5 px-2.5 h-10 rounded-xl bg-cyan-500/20 border border-cyan-400/40 text-cyan-300 hover:bg-cyan-500/30 transition cursor-pointer text-xs font-medium"
          >
            <Smartphone className="w-4 h-4 text-cyan-400" />
            <span className="hidden md:inline">Open on Phone</span>
          </button>

          <button
            onClick={onToggleSafetyCamera}
            aria-label="Toggle Safety PiP Camera"
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition cursor-pointer ${
              settings.safetyPipEnabled
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                : 'text-slate-300 hover:text-white hover:bg-white/10'
            }`}
          >
            <Camera className="w-4 h-4" />
          </button>

          <button
            onClick={onToggleMute}
            aria-label="Toggle Audio"
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition cursor-pointer ${
              settings.audioEnabled
                ? 'text-cyan-400 hover:bg-white/10'
                : 'text-slate-500 hover:bg-white/10'
            }`}
          >
            {settings.audioEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          <button
            onClick={onOpenSettings}
            aria-label="Open Settings and Calibration"
            className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/10 transition cursor-pointer"
          >
            <Sliders className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Relic Found Notification Banner */}
      {lastFoundRelic && (
        <div className="pointer-events-none mx-auto transform animate-bounce">
          <div className="px-5 py-3 rounded-2xl bg-slate-950/90 border border-cyan-400/50 backdrop-blur-lg shadow-2xl flex items-center gap-3 text-white">
            <div
              style={{ backgroundColor: lastFoundRelic.color }}
              className="w-9 h-9 rounded-xl flex items-center justify-center shadow-lg shadow-cyan-500/30"
            >
              <Sparkles className="w-5 h-5 text-slate-950" />
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold tracking-wider text-cyan-400">
                Relic Discovered!
              </p>
              <p className="text-sm font-semibold text-white">
                {lastFoundRelic.name} — {lastFoundRelic.title}
              </p>
              <p className="text-[11px] text-slate-300 italic">{lastFoundRelic.lore}</p>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Floating Tactical Metrics Dock */}
      <div className="w-full max-w-xl mx-auto pointer-events-auto">
        <div className="rounded-3xl bg-slate-900/85 backdrop-blur-lg border border-white/10 p-3.5 shadow-2xl text-white">
          {/* Upper Metrics Grid */}
          <div className="grid grid-cols-4 gap-2 text-center pb-2.5 border-b border-white/10">
            {/* Steps with live visual pulse */}
            <div
              className={`flex flex-col items-center justify-center p-1.5 rounded-2xl transition-all duration-150 ${
                isStepPulse
                  ? 'bg-emerald-500/30 ring-2 ring-emerald-400 scale-105'
                  : 'bg-transparent'
              }`}
            >
              <div className="flex items-center gap-1 text-cyan-400 mb-0.5">
                <Footprints className="w-3.5 h-3.5" />
                <span className="text-[10px] font-bold uppercase tracking-wider">
                  {isStepPulse ? 'STEP!' : 'Steps'}
                </span>
              </div>
              <span className="font-mono text-xl sm:text-2xl font-black text-white tracking-tight">
                {motion.stepCount.toLocaleString()}
              </span>
            </div>

            {/* Distance */}
            <div className="flex flex-col items-center justify-center p-1.5">
              <div className="flex items-center gap-1 text-emerald-400 mb-0.5">
                <Activity className="w-3.5 h-3.5" />
                <span className="text-[10px] font-bold uppercase tracking-wider">Distance</span>
              </div>
              <span className="font-mono text-xl sm:text-2xl font-black text-white tracking-tight">
                {motion.distanceMeters >= 1000
                  ? `${(motion.distanceMeters / 1000).toFixed(2)} km`
                  : `${Math.round(motion.distanceMeters)} m`}
              </span>
            </div>

            {/* Cadence */}
            <div className="flex flex-col items-center justify-center p-1.5">
              <div className="flex items-center gap-1 text-amber-400 mb-0.5">
                <Zap className="w-3.5 h-3.5" />
                <span className="text-[10px] font-bold uppercase tracking-wider">Cadence</span>
              </div>
              <span className="font-mono text-xl sm:text-2xl font-black text-white tracking-tight">
                {motion.cadence}{' '}
                <span className="text-[10px] font-normal text-slate-400">spm</span>
              </span>
            </div>

            {/* Energy */}
            <div className="flex flex-col items-center justify-center p-1.5">
              <div className="flex items-center gap-1 text-rose-400 mb-0.5">
                <Flame className="w-3.5 h-3.5" />
                <span className="text-[10px] font-bold uppercase tracking-wider">Energy</span>
              </div>
              <span className="font-mono text-xl sm:text-2xl font-black text-white tracking-tight">
                {caloriesBurned}{' '}
                <span className="text-[10px] font-normal text-slate-400">kcal</span>
              </span>
            </div>
          </div>

          {/* Bottom Row: Relics Progress & Quick Sensitivity Controller */}
          <div className="flex items-center justify-between pt-2 px-1 text-xs">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                {collectibles.map((r) => (
                  <div
                    key={r.id}
                    style={{
                      backgroundColor: r.collected ? r.color : 'rgba(255,255,255,0.15)',
                    }}
                    title={`${r.name}: ${r.collected ? 'Found' : 'Hidden on trail'}`}
                    className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                      r.collected ? 'ring-2 ring-white/50 scale-110' : ''
                    }`}
                  />
                ))}
              </div>
              <span className="text-[11px] font-medium text-slate-300">
                {collectedCount} / {totalCount} Relics
              </span>
            </div>

            {/* Quick Step Sensitivity & Manual Step Button */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={onManualStep}
                className="px-2 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-400/40 text-[10px] font-semibold transition active:scale-95 cursor-pointer"
                title="Tap to trigger a step forward"
              >
                + Step
              </button>
              <button
                onClick={onCycleSensitivity}
                className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-300 border border-slate-700 transition cursor-pointer"
                title="Tap to adjust pedometer step sensitivity"
              >
                Sens: {getSensitivityLabel()}
              </button>
              <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">
                {settings.strideLength}m
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
