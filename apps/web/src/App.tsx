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
      <div className="flex min-h-screen w-full flex-col items-center justify-center bg-zinc-950 px-4 text-white">
        <div className="w-full max-w-md space-y-8 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-8 shadow-2xl backdrop-blur-xl">
          <div className="flex flex-col items-center text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-600/10 text-blue-500 border border-blue-500/20 mb-4 shadow-inner">
              <Hourglass className="h-8 w-8 animate-pulse" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-100">
              Brachio Hourglass Viewer
            </h1>
            <p className="mt-2 text-sm text-zinc-400">
              Enter a room code to join an active synchronized countdown.
            </p>
          </div>

          <form onSubmit={handleJoinSubmit} className="mt-6 space-y-4">
            <div>
              <label
                htmlFor="room-code-input"
                className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5"
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
                className="w-full rounded-xl border border-zinc-700 bg-zinc-800/80 px-4 py-3 text-center text-xl font-mono uppercase tracking-widest text-white placeholder-zinc-500 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <button
              type="submit"
              disabled={!inputCode.trim()}
              className="group flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white shadow-lg shadow-blue-600/20 transition duration-150 hover:bg-blue-500 active:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span>Join Live Viewer</span>
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex h-screen w-screen flex-col overflow-hidden bg-zinc-950 text-white">
      {/* Top Navigation Bar */}
      <header className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-6 py-4 bg-gradient-to-b from-zinc-950/80 to-transparent backdrop-blur-sm">
        {/* Left: Room details */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-lg bg-zinc-900/90 border border-zinc-800 px-3 py-1.5 font-mono text-sm font-semibold tracking-wider text-zinc-200 shadow-sm">
            <span className="text-zinc-500">ROOM:</span>
            <span>{roomCode}</span>
          </div>

          <button
            onClick={handleCopyLink}
            title="Copy share link"
            className="flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900/80 px-2.5 py-1.5 text-xs text-zinc-300 transition hover:bg-zinc-800 hover:text-white"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-400" />
                <span className="text-emerald-400">Copied</span>
              </>
            ) : (
              <>
                <Share2 className="h-3.5 w-3.5" />
                <span>Share</span>
              </>
            )}
          </button>
        </div>

        {/* Right: Controls & Badges */}
        <div className="flex items-center gap-3">
          {/* Host Online / Offline status */}
          <div
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium backdrop-blur-sm ${
              hostOnline
                ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
                : 'border-amber-500/20 bg-amber-500/10 text-amber-400'
            }`}
          >
            {hostOnline ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
            <span>{hostOnline ? 'Host Connected' : 'Host Offline'}</span>
          </div>

          {/* Viewer count badge */}
          <div className="flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900/80 px-3 py-1.5 text-xs text-zinc-300 shadow-sm">
            <Users className="h-3.5 w-3.5 text-blue-400" />
            <span>
              {viewerCount} {viewerCount === 1 ? 'viewer' : 'viewers'}
            </span>
          </div>

          {/* Audio toggle button */}
          <button
            onClick={toggleAudio}
            aria-label={isAudioMuted ? 'Unmute alerts' : 'Mute alerts'}
            title={isAudioMuted ? 'Click to enable sound alerts' : 'Click to mute sound alerts'}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition shadow-sm ${
              isAudioMuted
                ? 'border-zinc-800 bg-zinc-900/80 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                : 'border-blue-500/40 bg-blue-600/20 text-blue-300 hover:bg-blue-600/30'
            }`}
          >
            {isAudioMuted ? (
              <>
                <VolumeX className="h-3.5 w-3.5" />
                <span>Muted</span>
              </>
            ) : (
              <>
                <Volume2 className="h-3.5 w-3.5 text-blue-400 animate-pulse" />
                <span>Audio On</span>
              </>
            )}
          </button>

          {/* Leave room button */}
          <button
            onClick={handleLeaveRoom}
            className="rounded-lg border border-zinc-800 bg-zinc-900/80 px-3 py-1.5 text-xs text-zinc-400 transition hover:bg-zinc-800 hover:text-white"
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
