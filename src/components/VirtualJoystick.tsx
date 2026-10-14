import React, { useRef, useState, useCallback, useEffect } from 'react';

interface VirtualJoystickProps {
  onMove: (x: number, y: number) => void;
  visible?: boolean;
}

export const VirtualJoystick: React.FC<VirtualJoystickProps> = ({ onMove, visible = true }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [stickPos, setStickPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [touchActive, setTouchActive] = useState<boolean>(false);
  const activeTouchId = useRef<number | null>(null);

  const maxRadius = 38; // pixel max deflection

  const handleTouch = useCallback(
    (clientX: number, clientY: number) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      let dx = clientX - centerX;
      let dy = clientY - centerY;
      const dist = Math.hypot(dx, dy);

      if (dist > maxRadius) {
        dx = (dx / dist) * maxRadius;
        dy = (dy / dist) * maxRadius;
      }

      setStickPos({ x: dx, y: dy });
      // Normalized output (-1 to 1)
      onMove(dx / maxRadius, dy / maxRadius);
    },
    [maxRadius, onMove]
  );

  const onTouchStart = (e: React.TouchEvent) => {
    if (activeTouchId.current !== null) return;
    const touch = e.changedTouches[0];
    activeTouchId.current = touch.identifier;
    setTouchActive(true);
    handleTouch(touch.clientX, touch.clientY);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (activeTouchId.current === null) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === activeTouchId.current) {
        handleTouch(e.changedTouches[i].clientX, e.changedTouches[i].clientY);
        break;
      }
    }
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === activeTouchId.current) {
        activeTouchId.current = null;
        setTouchActive(false);
        setStickPos({ x: 0, y: 0 });
        onMove(0, 0);
        break;
      }
    }
  };

  // Mouse fallback for desktop testing
  const onMouseDown = (e: React.MouseEvent) => {
    setTouchActive(true);
    handleTouch(e.clientX, e.clientY);

    const onMouseMove = (ev: MouseEvent) => {
      handleTouch(ev.clientX, ev.clientY);
    };

    const onMouseUp = () => {
      setTouchActive(false);
      setStickPos({ x: 0, y: 0 });
      onMove(0, 0);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  if (!visible) return null;

  return (
    <div
      ref={containerRef}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}
      onMouseDown={onMouseDown}
      className="fixed bottom-24 left-4 w-28 h-28 rounded-full border border-white/20 bg-slate-900/60 backdrop-blur-md flex items-center justify-center pointer-events-auto touch-none select-none z-20 shadow-lg"
    >
      {/* Outer subtle boundary */}
      <div className="w-20 h-20 rounded-full border border-white/10 flex items-center justify-center">
        {/* Inner Knob */}
        <div
          style={{
            transform: `translate3d(${stickPos.x}px, ${stickPos.y}px, 0)`,
            transition: touchActive ? 'none' : 'transform 0.15s ease-out',
          }}
          className={`w-11 h-11 rounded-full shadow-md flex items-center justify-center ${
            touchActive ? 'bg-cyan-500/90 text-white shadow-cyan-500/50' : 'bg-white/30 text-slate-200'
          }`}
        >
          <div className="w-2.5 h-2.5 rounded-full bg-white/70" />
        </div>
      </div>
    </div>
  );
};
