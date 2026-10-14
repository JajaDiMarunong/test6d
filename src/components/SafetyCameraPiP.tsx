import React, { useEffect, useRef, useState } from 'react';
import { Camera, CameraOff, Maximize2, Minimize2, Eye } from 'lucide-react';

interface SafetyCameraPiPProps {
  enabled: boolean;
  onToggle: () => void;
  startCameraStream: () => Promise<MediaStream | null>;
  stopCameraStream: () => void;
}

export const SafetyCameraPiP: React.FC<SafetyCameraPiPProps> = ({
  enabled,
  onToggle,
  startCameraStream,
  stopCameraStream,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [streamActive, setStreamActive] = useState<boolean>(false);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    if (enabled) {
      setCameraError(null);
      startCameraStream().then((stream) => {
        if (!mounted) return;
        if (stream && videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
          setStreamActive(true);
        } else {
          setCameraError('Camera access required for Real-World Safety View');
          setStreamActive(false);
        }
      });
    } else {
      stopCameraStream();
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      setStreamActive(false);
    }

    return () => {
      mounted = false;
    };
  }, [enabled, startCameraStream, stopCameraStream]);

  if (!enabled) {
    return null;
  }

  return (
    <div
      className={`fixed transition-all duration-300 z-30 pointer-events-auto ${
        isExpanded
          ? 'inset-4 md:inset-10 rounded-2xl border border-emerald-400/30 bg-black/80 backdrop-blur-md shadow-2xl flex flex-col'
          : 'bottom-24 right-4 w-40 h-52 sm:w-48 sm:h-64 rounded-xl border border-white/20 bg-slate-900/90 shadow-xl overflow-hidden'
      }`}
    >
      {/* Header bar */}
      <div className="flex items-center justify-between px-2.5 py-1.5 bg-black/50 text-white text-xs border-b border-white/10">
        <div className="flex items-center gap-1.5 font-medium">
          <Eye className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
          <span className="text-[11px] tracking-wide uppercase text-slate-300">Safety Glance</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            aria-label={isExpanded ? 'Minimize safety feed' : 'Expand safety feed'}
            className="p-1 hover:bg-white/10 rounded transition text-slate-300 hover:text-white"
          >
            {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={onToggle}
            aria-label="Close safety camera"
            className="p-1 hover:bg-white/10 rounded transition text-slate-300 hover:text-white"
          >
            <CameraOff className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Video Viewport */}
      <div className="relative flex-1 bg-black flex items-center justify-center overflow-hidden">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`w-full h-full object-cover ${isExpanded ? 'opacity-85' : 'opacity-90'}`}
        />

        {/* Reticle / Crosshair */}
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          <div className="w-8 h-8 border border-white/20 rounded-full flex items-center justify-center">
            <div className="w-1.5 h-1.5 bg-emerald-400/80 rounded-full" />
          </div>
        </div>

        {/* Error or Loading state */}
        {!streamActive && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-3 text-center bg-slate-900/90 text-slate-300 text-xs">
            <Camera className="w-6 h-6 text-slate-500 mb-1" />
            <p className="text-[11px] leading-tight">
              {cameraError || 'Activating rear camera...'}
            </p>
          </div>
        )}
      </div>

      {/* Footer warning */}
      <div className="px-2 py-1 bg-black/60 text-center border-t border-white/5">
        <span className="text-[10px] text-amber-300/90 tracking-tight font-medium">
          Check real-world surroundings
        </span>
      </div>
    </div>
  );
};
