import React, { useState, useEffect } from 'react';
import { Copy, Check, Users, Radio, X } from 'lucide-react';

export interface ShareSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  isLive: boolean;
  roomCode: string | null;
  viewerCount: number;
  onStartLive: () => void;
  onStopLive: () => void;
}

export const ShareSessionModal: React.FC<ShareSessionModalProps> = ({
  isOpen,
  onClose,
  isLive,
  roomCode,
  viewerCount,
  onStartLive,
  onStopLive
}) => {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const shareUrl = roomCode ? `http://localhost:5173/join/${roomCode}` : '';

  const copyToClipboard = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard
        .writeText(shareUrl)
        .then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        })
        .catch((err) => {
          console.error('Failed to copy to clipboard:', err);
        });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 w-full max-w-sm shadow-2xl relative text-zinc-200">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-zinc-400 hover:text-white"
          aria-label="Close"
        >
          <X size={18} />
        </button>
        <h2 className="text-base font-semibold text-white flex items-center gap-2 mb-4">
          <Radio className={isLive ? 'text-green-400 animate-pulse' : 'text-zinc-500'} size={18} />
          Live Session Sharing
        </h2>

        {!isLive ? (
          <div>
            <p className="text-xs text-zinc-400 mb-4">
              Open a live session so remote viewers can watch your countdown in real time. Viewers cannot reset or change the timer.
            </p>
            <button
              onClick={onStartLive}
              className="w-full py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-semibold transition"
            >
              Start Live Room
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-zinc-800/80 p-3 rounded-lg border border-zinc-700">
              <div className="flex justify-between items-center text-xs text-zinc-400 mb-1">
                <span>Room Code</span>
                <span className="flex items-center gap-1 text-green-400">
                  <Users size={12} /> {viewerCount} {viewerCount === 1 ? 'viewer' : 'viewers'}
                </span>
              </div>
              <div className="text-2xl font-mono font-bold tracking-wider text-white">
                {roomCode}
              </div>
            </div>

            <div className="flex gap-2">
              <input
                readOnly
                value={shareUrl}
                className="bg-zinc-950 border border-zinc-800 text-xs px-2.5 py-1.5 rounded flex-1 text-zinc-300 select-all"
              />
              <button
                onClick={copyToClipboard}
                className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded text-xs flex items-center gap-1 text-zinc-300 hover:text-white"
              >
                {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>

            <button
              onClick={onStopLive}
              className="w-full py-1.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/30 rounded text-xs font-medium transition"
            >
              Stop Live Session
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
