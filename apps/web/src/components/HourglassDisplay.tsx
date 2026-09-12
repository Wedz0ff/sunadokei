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
  // Determine accent color or indicator based on status
  const getStatusBadgeClass = () => {
    switch (status.toLowerCase()) {
      case 'running':
      case 'live':
        return 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30';
      case 'paused':
        return 'bg-amber-500/20 text-amber-300 border border-amber-500/30';
      case 'finished':
        return 'bg-rose-500/20 text-rose-300 border border-rose-500/30 animate-pulse';
      default:
        return 'bg-zinc-800/80 text-zinc-300 border border-zinc-700/50';
    }
  };

  return (
    <div
      data-testid="hourglass-display"
      className="relative w-full h-full min-h-[300px] flex items-center justify-center overflow-hidden bg-zinc-950 text-white select-none"
    >
      {/* Hourglass fluid drain background */}
      <div
        data-testid="drain-background"
        className="absolute bottom-0 left-0 right-0 bg-blue-600/30 transition-all duration-100 ease-linear pointer-events-none"
        style={{ height: `${progressPercent}%` }}
      />

      {/* Digital countdown digits */}
      <div className="relative z-10 flex flex-col items-center">
        <span
          data-testid="digital-time"
          className="text-8xl md:text-9xl font-mono font-bold tracking-tight drop-shadow-md"
        >
          {formattedTime}
        </span>
        <span
          data-testid="status-badge"
          className={`mt-4 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider backdrop-blur-sm ${getStatusBadgeClass()}`}
        >
          {status}
        </span>
        {children}
      </div>
    </div>
  );
};
