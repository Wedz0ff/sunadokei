import React from 'react';

export interface HourglassDisplayProps {
  formattedTime: string;
  progressPercent: number; // 100 down to 0
  status: string;
  children?: React.ReactNode;
}

export const HourglassDisplay: React.FC<HourglassDisplayProps> = ({
  formattedTime,
  progressPercent,
  status,
  children
}) => {
  const isFinished = status.toLowerCase() === 'finished';
  const isPaused = status.toLowerCase() === 'paused';

  // Determine accent color or indicator based on status
  const getStatusBadgeClass = () => {
    switch (status.toLowerCase()) {
      case 'running':
      case 'live':
        return 'bg-[#0f2357]/90 text-[#93c5fd] border border-[#3b82f6] shadow-[0_0_10px_rgba(37,99,235,0.3)]';
      case 'paused':
        return 'bg-[#451a03]/90 text-[#fcd34d] border border-[#f59e0b] shadow-[0_0_10px_rgba(217,119,6,0.3)]';
      case 'finished':
        return 'bg-[#450a0a]/90 text-[#fca5a5] border border-[#ef4444] animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.5)]';
      default:
        return 'bg-[#1b1c22]/90 text-[#dfd7c2] border border-[#3c3e4c]';
    }
  };

  const getDrainGradient = () => {
    if (isFinished) {
      return 'bg-gradient-to-t from-[#5a0c0c]/85 to-[#991b1b]/55 border-t-2 border-[#ef4444] shadow-[0_0_20px_rgba(239,68,68,0.4)]';
    }
    if (isPaused) {
      return 'bg-gradient-to-t from-[#572704]/85 to-[#b45309]/45 border-t-2 border-[#f59e0b] shadow-[0_0_15px_rgba(245,158,11,0.3)]';
    }
    return 'bg-gradient-to-t from-[#0f2357]/90 to-[#1d4ed8]/50 border-t-2 border-[#60a5fa] shadow-[0_0_20px_rgba(59,130,246,0.4)]';
  };

  return (
    <div
      data-testid="hourglass-display"
      className="relative w-full h-full min-h-[300px] flex items-center justify-center overflow-hidden bg-[#1b1c22] text-[#dfd7c2] select-none tibia-window"
    >
      {/* Hourglass fluid drain background (Tibia mana sand / dragon blood) */}
      <div
        data-testid="drain-background"
        className={`absolute bottom-0 left-0 right-0 transition-all duration-150 ease-linear pointer-events-none ${getDrainGradient()}`}
        style={{ height: `${progressPercent}%` }}
      />

      {/* Digital countdown digits in carved stone slab */}
      <div className="relative z-10 flex flex-col items-center">
        <div className="tibia-inset px-8 py-3 md:px-12 md:py-6 rounded-xl border-2 border-[#07080a] flex items-center justify-center shadow-2xl">
          <span
            data-testid="digital-time"
            className={`text-8xl md:text-9xl font-digits tracking-wider leading-none select-none tibia-text-shadow ${
              isFinished ? 'text-[#fca5a5] animate-pulse' : 'text-[#fef08a]'
            }`}
          >
            {formattedTime}
          </span>
        </div>
        <span
          data-testid="status-badge"
          className={`mt-5 px-4 py-1.5 rounded-md font-pixel text-[10px] uppercase tracking-wider ${getStatusBadgeClass()}`}
        >
          {status}
        </span>
        {children}
      </div>
    </div>
  );
};
