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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 select-none font-tibia">
      <div className="tibia-window-frame p-1 w-full max-w-sm shadow-2xl relative text-[#c0c0c0]">
        <div className="tibia-widget-top flex items-center justify-between px-2 py-1 mb-2">
          <h2 className="tibia-widget-top-text flex items-center gap-1.5">
            <Radio className={isLive ? 'text-[#54e054] animate-pulse' : 'text-[#888888]'} size={13} />
            Live Session Sharing
          </h2>
          <button
            onClick={onClose}
            className="tibia-btn px-1.5 py-0.5 text-[11px] leading-none"
            aria-label="Close"
          >
            <X size={12} />
          </button>
        </div>

        <div className="p-2 space-y-3">
          {!isLive ? (
            <div>
              <p className="text-xs text-[#c0c0c0] leading-relaxed mb-4">
                Open a live session so remote viewers can watch your countdown in real time. Viewers cannot reset or change the timer.
              </p>
              <button
                onClick={onStartLive}
                className="w-full py-1.5 tibia-btn-green text-xs uppercase font-bold tracking-wider shadow"
              >
                Start Live Room
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="tibia-panel p-2.5 space-y-1.5">
                <div className="flex justify-between items-center text-xs text-[#c0c0c0]">
                  <span>Room Code</span>
                  <span className="flex items-center gap-1 text-[#54e054]">
                    <Users size={12} /> {viewerCount} {viewerCount === 1 ? 'viewer' : 'viewers'}
                  </span>
                </div>
                <div className="tibia-slot py-2 text-center text-2xl font-bold tracking-widest text-[#ffffff] tibia-text">
                  {roomCode}
                </div>
              </div>

              <div className="flex gap-1.5">
                <input
                  readOnly
                  value={shareUrl}
                  className="tibia-slot text-xs px-2 py-1 flex-1 text-[#ffffff] font-tibia select-all outline-none"
                />
                <button
                  onClick={copyToClipboard}
                  className="tibia-btn px-2.5 py-1 text-xs uppercase flex items-center gap-1 text-[#c0c0c0] hover:text-[#ffffff]"
                >
                  {copied ? <Check size={12} className="text-[#54e054]" /> : <Copy size={12} />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>

              <button
                onClick={onStopLive}
                className="w-full py-1.5 tibia-btn-red text-xs uppercase font-bold tracking-wider shadow"
              >
                Stop Live Session
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
