import React, { useState } from 'react';
import { X, Compass, RotateCcw, Volume2, VolumeX, Eye, ShieldCheck, GitFork, Sliders, Smartphone, HelpCircle } from 'lucide-react';
import { UserSettings, TrackingMode } from '../types';

interface CalibrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: UserSettings;
  onUpdateSettings: (newSettings: UserSettings) => void;
  onCalibrateHeading: () => void;
  onResetOdometer: () => void;
  currentMode: TrackingMode;
  onStartWebXR: () => void;
  onEnableSensors: () => void;
}

export const CalibrationModal: React.FC<CalibrationModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  onCalibrateHeading,
  onResetOdometer,
  currentMode,
  onStartWebXR,
  onEnableSensors,
}) => {
  const [activeTab, setActiveTab] = useState<'tune' | 'github' | 'about'>('tune');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md pointer-events-auto">
      <div className="w-full max-w-md max-h-[90vh] bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-100">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-cyan-400" />
            <h2 className="text-base font-semibold text-white">Walking Engine & Calibration</h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close settings"
            className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-800 bg-slate-950/30 px-3 pt-2">
          <button
            onClick={() => setActiveTab('tune')}
            className={`flex-1 py-2 text-xs font-medium border-b-2 transition ${
              activeTab === 'tune'
                ? 'border-cyan-400 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Tuning & Sensors
          </button>
          <button
            onClick={() => setActiveTab('github')}
            className={`flex-1 py-2 text-xs font-medium border-b-2 transition ${
              activeTab === 'github'
                ? 'border-cyan-400 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Deploy to GitHub
          </button>
          <button
            onClick={() => setActiveTab('about')}
            className={`flex-1 py-2 text-xs font-medium border-b-2 transition ${
              activeTab === 'about'
                ? 'border-cyan-400 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            How Tracking Works
          </button>
        </div>

        {/* Tab Contents */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 custom-scrollbar text-sm">
          {activeTab === 'tune' && (
            <>
              {/* Quick Calibration Actions */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={onCalibrateHeading}
                  className="flex flex-col items-center justify-center p-3.5 rounded-xl bg-slate-800/90 border border-slate-700 hover:border-cyan-400 text-white transition active:scale-95 min-h-[56px]"
                >
                  <Compass className="w-5 h-5 text-cyan-400 mb-1" />
                  <span className="text-xs font-medium">Zero Compass</span>
                  <span className="text-[10px] text-slate-400">Set front as forward</span>
                </button>

                <button
                  onClick={onResetOdometer}
                  className="flex flex-col items-center justify-center p-3.5 rounded-xl bg-slate-800/90 border border-slate-700 hover:border-amber-400 text-white transition active:scale-95 min-h-[56px]"
                >
                  <RotateCcw className="w-5 h-5 text-amber-400 mb-1" />
                  <span className="text-xs font-medium">Reset Odometer</span>
                  <span className="text-[10px] text-slate-400">Zero steps & distance</span>
                </button>
              </div>

              {/* Stride Length Calibration Slider */}
              <div className="bg-slate-950/60 rounded-xl p-4 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs font-medium">
                  <span className="text-slate-300">Physical Stride Length</span>
                  <span className="text-cyan-400 font-mono text-sm font-semibold">
                    {settings.strideLength.toFixed(2)} m
                  </span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="1.1"
                  step="0.02"
                  value={settings.strideLength}
                  onChange={(e) =>
                    onUpdateSettings({ ...settings, strideLength: parseFloat(e.target.value) })
                  }
                  className="w-full accent-cyan-400 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-500">
                  <span>0.50m (Short)</span>
                  <span>0.74m (Average)</span>
                  <span>1.10m (Long)</span>
                </div>
              </div>

              {/* Step Sensitivity */}
              <div className="bg-slate-950/60 rounded-xl p-4 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs font-medium">
                  <span className="text-slate-300">Pedometer Step Sensitivity</span>
                  <span className="text-slate-400 font-mono text-xs">
                    {settings.stepSensitivity <= 0.8
                      ? 'High (Light Steps)'
                      : settings.stepSensitivity <= 1.3
                      ? 'Balanced'
                      : 'Firm (Hard Steps)'}
                  </span>
                </div>
                <input
                  type="range"
                  min="0.6"
                  max="1.8"
                  step="0.1"
                  value={settings.stepSensitivity}
                  onChange={(e) =>
                    onUpdateSettings({ ...settings, stepSensitivity: parseFloat(e.target.value) })
                  }
                  className="w-full accent-cyan-400 cursor-pointer"
                />
                <p className="text-[11px] text-slate-400">
                  Adjust if steps are missing or counting too frequently when walking.
                </p>
              </div>

              {/* Toggles */}
              <div className="space-y-2">
                <label className="flex items-center justify-between p-3 rounded-xl bg-slate-950/40 border border-slate-800/80 cursor-pointer hover:bg-slate-800/40 transition">
                  <div className="flex items-center gap-2.5">
                    {settings.audioEnabled ? (
                      <Volume2 className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <VolumeX className="w-4 h-4 text-slate-500" />
                    )}
                    <span className="text-xs text-slate-200">Footstep & Relic Audio Chimes</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.audioEnabled}
                    onChange={(e) => onUpdateSettings({ ...settings, audioEnabled: e.target.checked })}
                    className="w-4 h-4 accent-cyan-400 rounded"
                  />
                </label>

                <label className="flex items-center justify-between p-3 rounded-xl bg-slate-950/40 border border-slate-800/80 cursor-pointer hover:bg-slate-800/40 transition">
                  <div className="flex items-center gap-2.5">
                    <Eye className="w-4 h-4 text-cyan-400" />
                    <span className="text-xs text-slate-200">Real-World Safety Camera PiP</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.safetyPipEnabled}
                    onChange={(e) =>
                      onUpdateSettings({ ...settings, safetyPipEnabled: e.target.checked })
                    }
                    className="w-4 h-4 accent-cyan-400 rounded"
                  />
                </label>

                <label className="flex items-center justify-between p-3 rounded-xl bg-slate-950/40 border border-slate-800/80 cursor-pointer hover:bg-slate-800/40 transition">
                  <div className="flex items-center gap-2.5">
                    <Smartphone className="w-4 h-4 text-purple-400" />
                    <span className="text-xs text-slate-200">On-Screen Virtual Touch Joystick</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.showJoystick}
                    onChange={(e) =>
                      onUpdateSettings({ ...settings, showJoystick: e.target.checked })
                    }
                    className="w-4 h-4 accent-cyan-400 rounded"
                  />
                </label>
              </div>

              {/* Tracking Mode Switcher */}
              <div className="pt-2">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-2">
                  Tracking Layer
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={onStartWebXR}
                    className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium border transition ${
                      currentMode === 'webxr'
                        ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                        : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
                    }`}
                  >
                    Launch WebXR 6DoF
                  </button>
                  <button
                    onClick={onEnableSensors}
                    className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium border transition ${
                      currentMode === 'sensors'
                        ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
                        : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
                    }`}
                  >
                    Sensor Pedometer
                  </button>
                </div>
              </div>
            </>
          )}

          {activeTab === 'github' && (
            <div className="space-y-4 text-xs text-slate-300">
              <div className="p-3 rounded-xl bg-cyan-950/30 border border-cyan-800/40 flex items-start gap-2.5">
                <GitFork className="w-4 h-4 text-cyan-400 mt-0.5 shrink-0" />
                <p>
                  This template is built as a pure client-side Vite SPA with zero external asset dependencies, ready to deploy to <strong>GitHub Pages</strong>.
                </p>
              </div>

              <div className="space-y-2">
                <h4 className="font-semibold text-white">How to deploy to your GitHub:</h4>
                <ol className="list-decimal list-inside space-y-1.5 text-slate-300 bg-slate-950/60 p-3 rounded-xl border border-slate-800 font-mono text-[11px]">
                  <li>git init</li>
                  <li>git add .</li>
                  <li>git commit -m &quot;Initial WebAR 6DoF template&quot;</li>
                  <li>gh repo create my-webar-walking --public --push</li>
                  <li>npm run build</li>
                </ol>
              </div>

              <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-800/40 space-y-1">
                <div className="flex items-center gap-1.5 text-amber-300 font-medium">
                  <ShieldCheck className="w-4 h-4" />
                  <span>HTTPS Requirement for Mobile Phones</span>
                </div>
                <p className="text-[11px] text-amber-200/80 leading-relaxed">
                  Both iOS Safari and Android Chrome require <strong>HTTPS</strong> to grant access to device accelerometers, gyroscopes, and camera feeds. GitHub Pages provides free automatic HTTPS out of the box!
                </p>
              </div>
            </div>
          )}

          {activeTab === 'about' && (
            <div className="space-y-3 text-xs text-slate-300">
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1.5">
                <h4 className="font-semibold text-white flex items-center gap-1.5">
                  <HelpCircle className="w-4 h-4 text-cyan-400" />
                  How 6DoF Real-to-Virtual Walking Works:
                </h4>
                <p className="text-slate-400 leading-relaxed text-[11px]">
                  1. <strong>Native WebXR (Android ARCore)</strong>: Tracks true 6-Degrees-of-Freedom (3 rotation axes + X/Y/Z physical displacement) using phone SLAM computer vision.
                </p>
                <p className="text-slate-400 leading-relaxed text-[11px]">
                  2. <strong>Universal Sensor Pedometer (iOS & all smartphones)</strong>: Measures vertical gravitational acceleration peaks when your foot strikes the ground. Each step projects your avatar forward by your calibrated stride length (default 0.74m) along your compass heading.
                </p>
                <p className="text-slate-400 leading-relaxed text-[11px]">
                  3. <strong>Desktop Dev Simulator</strong>: When running on a computer, use keys <strong>W / S / A / D</strong> or the touch joystick to simulate walking and turning.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-950/80 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs transition active:scale-95"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
