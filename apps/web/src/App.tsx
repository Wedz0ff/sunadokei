import React, { useState, useEffect, useRef } from 'react';
import { useViewerTimer } from './hooks/useViewerTimer';
import { HourglassDisplay } from './components/HourglassDisplay';
import { playAlarmSound } from './utils/audio';
import {
  Volume2,
  VolumeX,
  Users,
  Wifi,
  WifiOff,
  Hourglass,
  ArrowRight,
  Share2,
  Check,
  AlertCircle
} from 'lucide-react';

function parseRoomCodeFromLocation(): string {
  if (typeof window === 'undefined') return '';

  // 1. Path: /join/:roomCode
  const pathMatch = window.location.pathname.match(/^\/join\/([A-Za-z0-9_-]+)/i);
  if (pathMatch && pathMatch[1]) {
    return pathMatch[1].toUpperCase();
  }

  // 2. Query param: ?room= or ?code= or ?roomCode=
  const searchParams = new URLSearchParams(window.location.search);
  const queryParam = searchParams.get('room') || searchParams.get('code') || searchParams.get('roomCode');
  if (queryParam) {
    return queryParam.trim().toUpperCase();
  }

  // 3. Hash: #/join/:roomCode or #roomCode
  const hash = window.location.hash.replace(/^#\/?/, '');
  const hashMatch = hash.match(/^(?:join\/)?([A-Za-z0-9_-]+)/i);
  if (hashMatch && hashMatch[1]) {
    return hashMatch[1].toUpperCase();
  }

  return '';
}

export const App: React.FC = () => {
  const [roomCode, setRoomCode] = useState<string>(() => parseRoomCodeFromLocation());
  const [inputCode, setInputCode] = useState<string>('');
  const [isAudioMuted, setIsAudioMuted] = useState<boolean>(true);
  const [copied, setCopied] = useState<boolean>(false);

  // Sync state when browser back/forward buttons are used
  useEffect(() => {
    const handlePopState = () => {
      setRoomCode(parseRoomCodeFromLocation());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const {
    snapshot,
    displayRemainingMs,
    progressPercent,
    formattedTime,
    viewerCount,
    hostOnline,
    isConnected,
    error
  } = useViewerTimer(roomCode);

  // Sound alert on timer completion
  const prevStatusRef = useRef<string | null>(null);
  const hasAlertedRef = useRef<boolean>(false);

  useEffect(() => {
    if (!snapshot) return;

    const currentStatus = snapshot.status;
    const isFinished = currentStatus === 'finished' || (currentStatus === 'running' && displayRemainingMs <= 0);

    // Reset alert gate when timer runs again with positive time
    if (currentStatus === 'running' && displayRemainingMs > 1000) {
      hasAlertedRef.current = false;
    }

    // Trigger alert sound once if unmuted
    if (isFinished && !hasAlertedRef.current) {
      if (prevStatusRef.current === 'running' || currentStatus === 'finished') {
        hasAlertedRef.current = true;
        if (!isAudioMuted) {
          playAlarmSound();
        }
      }
    }

    prevStatusRef.current = currentStatus;
  }, [snapshot, displayRemainingMs, isAudioMuted]);

  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = inputCode.trim().toUpperCase();
    if (clean) {
      window.history.pushState({}, '', `/join/${clean}`);
      setRoomCode(clean);
    }
  };

  const handleLeaveRoom = () => {
    window.history.pushState({}, '', '/');
    setRoomCode('');
    setInputCode('');
  };

  const handleCopyLink = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const toggleAudio = () => {
    const newMuted = !isAudioMuted;
    setIsAudioMuted(newMuted);
    // If unmuting, briefly test audio context permission
    if (newMuted === false) {
      try {
        const AudioContextClass =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (AudioContextClass) {
          const ctx = new AudioContextClass();
          if (ctx.state === 'suspended') {
            ctx.resume();
          }
        }
      } catch {
        // Ignore initialization error
      }
    }
  };

  // Determine display status label
  const getStatusLabel = () => {
    if (!hostOnline) return 'Host Offline';
    if (!snapshot) return isConnected ? 'Waiting for host...' : 'Connecting...';
    switch (snapshot.status) {
      case 'running':
        return 'Live';
      case 'paused':
        return 'Paused';
      case 'finished':
        return 'Finished';
      case 'idle':
        return 'Ready';
      default:
        return snapshot.status;
    }
  };

  // If no room code is selected, render the Join Room landing page
  if (!roomCode) {
    return (
      <div
        className="flex min-h-screen w-full flex-col items-center justify-center p-4 font-tibia text-[#c0c0c0] select-none"
        style={{
          background: "url('/tibia/background-regular.png')",
          imageRendering: 'pixelated'
        }}
      >
        <div className="w-full max-w-sm shadow-2xl">
          <div className="tibia-widget-top px-3 py-1.5 flex items-center gap-2">
            <span>🐲</span>
            <span className="tibia-widget-top-text text-xs text-[#c0c0c0]">Sunadokei 砂時計 Live Viewer</span>
          </div>

          <div className="tibia-panel p-6 space-y-5">
            <div className="flex flex-col items-center text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-xs bg-[#242424] text-[#ffcc00] border border-[#5a5a5a] mb-3 shadow-inner">
                <Hourglass className="h-7 w-7 animate-pulse" />
              </div>
              <h1 className="text-sm font-tibia text-[#ffffff]" style={{ textShadow: '1px 1px #000' }}>
                Sunadokei 砂時計
              </h1>
              <p className="mt-1.5 text-xs text-[#909090]">
                Enter a room code to join an active synchronized countdown.
              </p>
            </div>

            <form onSubmit={handleJoinSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="room-code-input"
                  className="block text-xs uppercase text-[#c0c0c0] mb-1.5"
                >
                  Room Code
                </label>
                <input
                  id="room-code-input"
                  type="text"
                  value={inputCode}
                  onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                  placeholder="e.g. TRK-892"
                  maxLength={10}
                  autoFocus
                  className="tibia-slot w-full px-3 py-2 text-center text-xl font-tibia text-[#ffffff] outline-none shadow-inner"
                  style={{ textShadow: '1px 1px #000' }}
                />
              </div>

              <button
                type="submit"
                disabled={!inputCode.trim()}
                className="tibia-btn-green w-full py-2.5 text-xs uppercase flex items-center justify-center gap-2 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span>Join Live Viewer</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative flex h-screen w-screen flex-col overflow-hidden text-[#c0c0c0] font-tibia select-none"
      style={{
        background: "url('/tibia/background-regular.png')",
        imageRendering: 'pixelated'
      }}
    >
      {/* Top Navigation Bar - Tibia Client Top Widget */}
      <header className="relative z-20 w-full tibia-widget-top flex items-center justify-between px-3 py-1">
        {/* Left: Room details */}
        <div className="flex items-center gap-2">
          <div className="tibia-slot px-2.5 py-0.5 text-xs text-[#ffffff] flex items-center gap-1.5">
            <span className="text-[#909090]">ROOM:</span>
            <span>{roomCode}</span>
          </div>

          <button
            onClick={handleCopyLink}
            title="Copy share link"
            className="tibia-btn px-2 py-0.5 text-xs flex items-center gap-1"
          >
            {copied ? (
              <>
                <Check className="h-3 w-3 text-[#54e054]" />
                <span className="text-[#54e054]">Copied</span>
              </>
            ) : (
              <>
                <Share2 className="h-3 w-3" />
                <span>Share</span>
              </>
            )}
          </button>
        </div>

        {/* Right: Controls & Badges */}
        <div className="flex items-center gap-2">
          {/* Host Online / Offline status */}
          <div
            className={`px-2 py-0.5 text-[11px] border rounded-xs flex items-center gap-1 ${
              hostOnline
                ? 'border-[#10b981]/40 bg-[#064e3b]/80 text-[#54e054]'
                : 'border-[#f59e0b]/40 bg-[#451a03]/80 text-[#ffcc00]'
            }`}
          >
            {hostOnline ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
            <span>{hostOnline ? 'Host Connected' : 'Host Offline'}</span>
          </div>

          {/* Viewer count badge */}
          <div className="tibia-slot px-2 py-0.5 text-[11px] text-[#5bc0de] flex items-center gap-1">
            <Users className="h-3 w-3" />
            <span>
              {viewerCount} {viewerCount === 1 ? 'viewer' : 'viewers'}
            </span>
          </div>

          {/* Audio toggle button */}
          <button
            onClick={toggleAudio}
            aria-label={isAudioMuted ? 'Unmute alerts' : 'Mute alerts'}
            title={isAudioMuted ? 'Click to enable sound alerts' : 'Click to mute sound alerts'}
            className={`px-2 py-0.5 text-xs flex items-center gap-1 ${
              isAudioMuted ? 'tibia-btn text-[#909090]' : 'tibia-btn-green text-[#ffffff]'
            }`}
          >
            {isAudioMuted ? (
              <>
                <VolumeX className="h-3 w-3" />
                <span>Muted</span>
              </>
            ) : (
              <>
                <Volume2 className="h-3 w-3 text-[#ffffff] animate-pulse" />
                <span>Audio On</span>
              </>
            )}
          </button>

          {/* Leave room button */}
          <button
            onClick={handleLeaveRoom}
            className="tibia-btn px-2 py-0.5 text-xs text-[#909090] hover:text-[#ffffff]"
          >
            Change Room
          </button>
        </div>
      </header>

      {/* Main Countdown Display */}
      <main className="flex-1 w-full h-full">
        {error ? (
          <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-zinc-950 px-4 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-500 border border-rose-500/20">
              <AlertCircle className="h-8 w-8" />
            </div>
            <h2 className="text-xl font-bold text-white">Unable to Connect</h2>
            <p className="max-w-sm text-sm text-zinc-400">{error}</p>
            <button
              onClick={handleLeaveRoom}
              className="mt-2 rounded-xl bg-zinc-800 px-4 py-2 text-sm font-semibold text-zinc-200 hover:bg-zinc-700 transition"
            >
              Enter Another Room Code
            </button>
          </div>
        ) : (
          <HourglassDisplay
            formattedTime={formattedTime}
            progressPercent={progressPercent}
            status={getStatusLabel()}
          />
        )}
      </main>
    </div>
  );
};

export default App;
