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

  const getStatusBadgeClass = () => {
    switch (status.toLowerCase()) {
      case 'running':
      case 'live':
        return 'tibia-btn-green text-[#ffffff] px-4 py-1 text-xs uppercase';
      case 'paused':
        return 'tibia-btn text-[#ffcc00] px-4 py-1 text-xs uppercase';
      case 'finished':
        return 'tibia-btn-red text-[#ffffff] px-4 py-1 text-xs uppercase';
      default:
        return 'tibia-btn text-[#c0c0c0] px-4 py-1 text-xs uppercase';
    }
  };

  return (
    <div
      data-testid="hourglass-display"
      className="relative w-full h-full min-h-[300px] flex items-center justify-center overflow-hidden font-tibia select-none"
      style={{
        background: "url('/tibia/background-regular.png')",
        borderWidth: '4px',
        borderImage: "url('/tibia/4-frame.png') 4 / 4px / 0 repeat",
        imageRendering: 'pixelated'
      }}
    >
      {/* Background fluid / mana sand drain */}
      <div
        data-testid="drain-background"
        className={`absolute bottom-0 left-0 right-0 transition-all duration-150 pointer-events-none opacity-20 ${
          isFinished
            ? 'bg-red-600'
            : isPaused
            ? 'bg-amber-600'
            : 'bg-blue-600'
        }`}
        style={{ height: `${progressPercent}%` }}
      />

      {/* Digital countdown digits in authentic sunken Tibia stone slab */}
      <div className="relative z-10 flex flex-col items-center w-full max-w-lg px-4">
        <div className="w-full tibia-panel p-6 md:p-8 flex flex-col items-center shadow-xl">
          <span
            data-testid="digital-time"
            className={`w-full text-center block text-7xl md:text-9xl font-tibia font-bold leading-none select-none ${
              isFinished ? 'text-[#ff5454]' : 'text-[#ffffff]'
            }`}
            style={{ textShadow: '2px 2px 0 #000000' }}
          >
            {formattedTime}
          </span>


          {/* Authentic Tibia Health / Progress Bar */}
          <div className="w-full tibia-bar-bg mt-4 rounded-xs overflow-hidden">
            <div
              className={`h-full transition-all duration-100 ${
                isFinished
                  ? 'tibia-bar-fill-red'
                  : isPaused
                  ? 'bg-[#eab308]'
                  : 'tibia-bar-fill-green'
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        <span
          data-testid="status-badge"
          className={`mt-4 rounded-xs ${getStatusBadgeClass()}`}
        >
          {status}
        </span>
        {children}
      </div>
    </div>
  );
};
