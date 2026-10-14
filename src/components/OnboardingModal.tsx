import React from 'react';
import { Footprints, Smartphone, Compass, ArrowRight, ShieldCheck, Monitor } from 'lucide-react';

interface OnboardingModalProps {
  isOpen: boolean;
  onStartWalking: () => void;
  onStartSimulator: () => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  isOpen,
  onStartWalking,
  onStartSimulator,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md pointer-events-auto">
      <div className="w-full max-w-md bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden text-slate-100 flex flex-col">
        {/* Banner with island motif */}
        <div className="p-6 bg-gradient-to-br from-cyan-950 via-slate-900 to-emerald-950 border-b border-slate-800 relative">
          <div className="w-12 h-12 rounded-2xl bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center mb-3">
            <Footprints className="w-6 h-6 text-cyan-400" />
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">
            WebAR 6DoF Walking Explorer
          </h1>
          <p className="text-xs text-slate-300 mt-1 leading-relaxed">
            Walk in the real physical world to move inside the 3D low-poly floating archipelago.
          </p>
        </div>

        {/* Feature Highlights */}
        <div className="p-6 space-y-4 text-xs text-slate-300">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center shrink-0 text-cyan-400">
              <Footprints className="w-4 h-4" />
            </div>
            <div>
              <p className="font-semibold text-white">Physical Step Synchronization</p>
              <p className="text-slate-400 text-[11px] mt-0.5">
                Every physical stride in your room, garden, or sidewalk translates 1:1 into forward motion along the ancient island trail.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center shrink-0 text-emerald-400">
              <Compass className="w-4 h-4" />
            </div>
            <div>
              <p className="font-semibold text-white">360° Gyro & SLAM Orientation</p>
              <p className="text-slate-400 text-[11px] mt-0.5">
                Turning your body in real life steers your view in the virtual world without manual touch panning.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center shrink-0 text-amber-400">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <p className="font-semibold text-white">Safety Camera Glance</p>
              <p className="text-slate-400 text-[11px] mt-0.5">
                Includes an on-screen live rear camera window so you can watch your real-world path while walking.
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="p-6 pt-0 space-y-2.5">
          <button
            onClick={onStartWalking}
            className="w-full min-h-[48px] py-3 px-4 rounded-2xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-sm transition active:scale-98 flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20 cursor-pointer"
          >
            <Smartphone className="w-4 h-4" />
            <span>Enable Sensors & Start Physical Walk</span>
            <ArrowRight className="w-4 h-4 ml-1" />
          </button>

          <button
            onClick={onStartSimulator}
            className="w-full min-h-[44px] py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-medium text-xs transition active:scale-98 flex items-center justify-center gap-2 border border-slate-700 cursor-pointer"
          >
            <Monitor className="w-3.5 h-3.5" />
            <span>Desktop / Simulator Mode (Keys & Joystick)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
