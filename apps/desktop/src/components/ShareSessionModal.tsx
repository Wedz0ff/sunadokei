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
  webViewerBaseUrl?: string;
}

export const ShareSessionModal: React.FC<ShareSessionModalProps> = ({
  isOpen,
  onClose,
  isLive,
  roomCode,
  viewerCount,
  onStartLive,
  onStopLive,
  webViewerBaseUrl
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

  const getShareUrl = () => {
    if (!roomCode) return '';
    if (webViewerBaseUrl) {
      if (webViewerBaseUrl.includes('${roomCode}')) {
        return webViewerBaseUrl.replace('${roomCode}', roomCode);
      }
      if (webViewerBaseUrl.includes(':roomCode')) {
        return webViewerBaseUrl.replace(':roomCode', roomCode);
      }
      const base = webViewerBaseUrl.replace(/\/+$/, '');
      const joinPath = base.endsWith('/join') ? '' : '/join';
      return `${base}${joinPath}/${roomCode}`;
    }
    const host =
      typeof window !== 'undefined' && window.location?.hostname
        ? window.location.hostname
        : 'localhost';
    return `http://${host}:5173/join/${roomCode}`;
  };

  const shareUrl = getShareUrl();

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 select-none">
      <div className="tibia-window bg-[#1b1c22] border-2 border-[#090a0c] rounded-xl p-6 w-full max-w-sm shadow-2xl relative text-[#dfd7c2]">
        <button
          onClick={onClose}
          className="tibia-btn absolute top-3.5 right-3.5 p-1 rounded text-[#9e9785] hover:text-[#dfd7c2]"
          aria-label="Close"
        >
          <X size={15} />
        </button>
        <h2 className="text-xs font-pixel uppercase tracking-wide text-[#fef08a] flex items-center gap-2 mb-4 tibia-text-shadow">
          <Radio className={isLive ? 'text-[#34d399] animate-pulse' : 'text-[#9e9785]'} size={15} />
          Live Session Sharing
        </h2>

        {!isLive ? (
          <div>
            <p className="text-[11px] font-pixel text-[#9e9785] leading-relaxed mb-5">
              Open a live session so remote viewers can watch your countdown in real time. Viewers cannot reset or change the timer.
            </p>
            <button
              onClick={onStartLive}
              className="w-full py-2.5 tibia-btn-gold rounded-lg font-pixel text-[11px] uppercase transition active:scale-95 shadow"
            >
              Start Live Room
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="tibia-inset p-3 rounded-lg border border-[#3c3e4c]">
              <div className="flex justify-between items-center text-[10px] font-pixel text-[#cca34c] mb-1">
                <span>Room Code</span>
                <span className="flex items-center gap-1 text-[#6ee7b7]">
                  <Users size={11} /> {viewerCount} {viewerCount === 1 ? 'viewer' : 'viewers'}
                </span>
              </div>
              <div className="text-3xl font-digits font-bold tracking-widest text-[#fef08a] tibia-text-shadow">
                {roomCode}
              </div>
            </div>

            <div className="flex gap-2">
              <input
                readOnly
                value={shareUrl}
                className="tibia-inset font-digits text-base px-3 py-1.5 rounded flex-1 text-[#dfd7c2] border border-[#3c3e4c] select-all outline-none"
              />
              <button
                onClick={copyToClipboard}
                className="tibia-btn px-3 py-1.5 rounded text-[10px] font-pixel uppercase flex items-center gap-1.5 text-[#dfd7c2] active:scale-95"
              >
                {copied ? <Check size={12} className="text-[#34d399]" /> : <Copy size={12} />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>

            <button
              onClick={onStopLive}
              className="w-full py-2 tibia-btn-ruby rounded-lg font-pixel text-[10px] uppercase transition active:scale-95 shadow"
            >
              Stop Live Session
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
