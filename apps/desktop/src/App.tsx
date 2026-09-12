import { useState, useEffect } from 'react';
import { useTimerEngine } from './hooks/useTimerEngine';
import { useGlobalShortcuts } from './hooks/useGlobalShortcuts';
import { useHostSync } from './hooks/useHostSync';
import { useWindowControls } from './hooks/useWindowControls';
import { TimerInput } from './components/TimerInput';
import { SettingsModal } from './components/SettingsModal';
import { ShareSessionModal } from './components/ShareSessionModal';
import { formatDuration } from '@brachio/shared';
import { SoundTone } from './utils/audio';
import {
  Play,
  Pause,
  RotateCcw,
  Settings,
  Share2,
  Radio,
  Pin,
  PinOff,
  Maximize2,
  Minimize2,
  Ghost
} from 'lucide-react';

const STORAGE_KEYS = {
  HOTKEYS: 'brachio_hotkeys',
  SOUND_TONE: 'brachio_sound_tone',
  SOUND_VOLUME: 'brachio_sound_volume',
  SERVER_URL: 'brachio_server_url',
  WEB_VIEWER_BASE_URL: 'brachio_web_viewer_base_url'
};

const DEFAULT_HOTKEYS = {
  resetAndRestart: 'CommandOrControl+Shift+R',
  resetAndPause: 'CommandOrControl+Shift+P',
  togglePause: 'CommandOrControl+Space',
  toggleClickThrough: 'CommandOrControl+Shift+C'
};

export default function App() {
  const [hotkeys, setHotkeys] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.HOTKEYS);
      return saved ? { ...DEFAULT_HOTKEYS, ...JSON.parse(saved) } : DEFAULT_HOTKEYS;
    } catch {
      return DEFAULT_HOTKEYS;
    }
  });

  const [soundTone, setSoundTone] = useState<SoundTone>(() => {
    try {
      return (localStorage.getItem(STORAGE_KEYS.SOUND_TONE) as SoundTone) || 'bell';
    } catch {
      return 'bell';
    }
  });

  const [soundVolume, setSoundVolume] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SOUND_VOLUME);
      return saved ? parseFloat(saved) : 0.8;
    } catch {
      return 0.8;
    }
  });

  const [serverUrl, setServerUrl] = useState<string>(() => {
    try {
      return localStorage.getItem(STORAGE_KEYS.SERVER_URL) || 'ws://localhost:8080';
    } catch {
      return 'ws://localhost:8080';
    }
  });

  const [webViewerBaseUrl, setWebViewerBaseUrl] = useState<string>(() => {
    try {
      return (
        localStorage.getItem(STORAGE_KEYS.WEB_VIEWER_BASE_URL) ||
        `http://${typeof window !== 'undefined' && window.location?.hostname ? window.location.hostname : 'localhost'}:5173`
      );
    } catch {
      return 'http://localhost:5173';
    }
  });

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);

  // Window Controls & Click-Through
  const {
    alwaysOnTop,
    decorations,
    compact,
    clickThrough,
    setAlwaysOnTop,
    toggleAlwaysOnTop,
    setDecorations,
    setCompact,
    toggleCompact,
    toggleClickThrough
  } = useWindowControls();

  // Persist settings
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.HOTKEYS, JSON.stringify(hotkeys));
    } catch {}
  }, [hotkeys]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.SOUND_TONE, soundTone);
    } catch {}
  }, [soundTone]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.SOUND_VOLUME, soundVolume.toString());
    } catch {}
  }, [soundVolume]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.SERVER_URL, serverUrl);
    } catch {}
  }, [serverUrl]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.WEB_VIEWER_BASE_URL, webViewerBaseUrl);
    } catch {}
  }, [webViewerBaseUrl]);

  const {
    inputString,
    setInputString,
    durationMs,
    remainingMs,
    status,
    targetEndTime,
    start,
    pause,
    resetAndRestart,
    resetAndPause,
    togglePause
  } = useTimerEngine('1min40s', {
    soundEnabled: soundTone !== 'none',
    soundTone,
    soundVolume
  });

  const {
    isLive,
    roomCode,
    viewerCount,
    openSession,
    closeSession
  } = useHostSync(serverUrl, {
    status,
    durationMs,
    remainingMs,
    targetEndTime,
    inputString
  });

  useGlobalShortcuts(hotkeys, {
    onResetAndRestart: resetAndRestart,
    onResetAndPause: resetAndPause,
    onTogglePause: togglePause,
    onToggleClickThrough: toggleClickThrough
  });

  const progressPercent = durationMs > 0 ? Math.min(100, Math.max(0, (remainingMs / durationMs) * 100)) : 0;

  return (
    <div
      className={`relative w-screen h-screen flex flex-col justify-between items-center bg-zinc-950 text-white overflow-hidden select-none transition-all ${
        clickThrough ? 'opacity-90 ring-2 ring-purple-500/60' : ''
      }`}
    >
      {/* Background visual drain (Hourglass style) */}
      <div
        className={`absolute bottom-0 left-0 right-0 transition-colors duration-200 pointer-events-none ${
          status === 'finished' ? 'bg-rose-600/30' : 'bg-blue-600/25'
        }`}
        style={{ height: `${progressPercent}%` }}
      />

      {/* Click-Through Ghost Mode Banner */}
      {clickThrough && (
        <div
          data-tauri-drag-region
          className="absolute top-0 left-0 right-0 z-30 bg-purple-900/90 text-purple-200 text-[10px] font-semibold py-0.5 px-2 flex items-center justify-between pointer-events-none backdrop-blur-xs"
        >
          <span className="flex items-center gap-1">
            <Ghost size={10} className="animate-pulse" /> Click-Through Active
          </span>
          <span>Press {hotkeys.toggleClickThrough.replace('CommandOrControl', '⌘/Ctrl')} to unlock</span>
        </div>
      )}

      {/* Header bar - with drag region for titlebarless/frameless dragging */}
      <header
        data-tauri-drag-region
        className={`relative z-10 w-full flex justify-between items-center ${
          compact ? 'p-1.5' : 'p-3'
        }`}
      >
        <div data-tauri-drag-region className="flex items-center gap-2">
          {!compact && (
            <TimerInput
              value={inputString}
              onChange={setInputString}
              onSubmit={resetAndRestart}
              placeholder="e.g. 1min40s"
            />
          )}
          {isLive && (
            <div className="flex items-center gap-1.5 px-1.5 py-0.5 bg-green-500/10 border border-green-500/20 rounded text-[11px] font-medium text-green-400">
              <Radio size={11} className="animate-pulse" />
              <span>LIVE</span>
              <span className="text-zinc-400">({viewerCount})</span>
            </div>
          )}
        </div>

        <div className="flex gap-1.5 items-center">
          {/* Always on Top Pin Button */}
          <button
            onClick={toggleAlwaysOnTop}
            title={alwaysOnTop ? 'Disable Always on Top' : 'Enable Always on Top'}
            aria-label="Toggle Always on Top"
            className={`p-1.5 rounded transition ${
              alwaysOnTop ? 'text-blue-400 bg-blue-500/10 hover:bg-blue-500/20' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
            }`}
          >
            {alwaysOnTop ? <Pin size={compact ? 13 : 15} /> : <PinOff size={compact ? 13 : 15} />}
          </button>

          {/* Compact Toggle Button */}
          <button
            onClick={toggleCompact}
            title={compact ? 'Expand to Full View' : 'Switch to Compact View'}
            aria-label="Toggle Compact Mode"
            className="p-1.5 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
          >
            {compact ? <Maximize2 size={13} /> : <Minimize2 size={15} />}
          </button>

          {/* Share Button */}
          <button
            onClick={() => setIsShareOpen(true)}
            title="Live Session Sharing"
            aria-label="Live Session Sharing"
            className={`relative p-1.5 hover:bg-zinc-800 rounded transition ${
              isLive ? 'text-green-400 hover:text-green-300' : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Share2 size={compact ? 13 : 15} />
            {isLive && (
              <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            )}
          </button>

          {/* Settings Button */}
          <button
            onClick={() => setIsSettingsOpen(true)}
            title="Settings"
            aria-label="Settings"
            className="p-1.5 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white transition"
          >
            <Settings size={compact ? 13 : 15} />
          </button>
        </div>
      </header>

      {/* Center time display - draggable in frameless mode */}
      <main
        data-tauri-drag-region
        className={`relative z-10 flex flex-col items-center cursor-default ${
          compact ? 'my-auto py-1' : ''
        }`}
      >
        <span
          data-tauri-drag-region
          className={`font-mono font-bold tracking-tight select-none ${
            compact ? 'text-4xl' : 'text-7xl'
          } ${
            status === 'finished' ? 'text-rose-400 animate-pulse' : 'text-white'
          }`}
        >
          {formatDuration(remainingMs)}
        </span>
        {!compact && (
          <span
            data-tauri-drag-region
            className={`text-xs mt-1 uppercase font-semibold tracking-wider ${
              status === 'running'
                ? 'text-blue-400'
                : status === 'finished'
                ? 'text-rose-400'
                : status === 'paused'
                ? 'text-amber-400'
                : 'text-zinc-400'
            }`}
          >
            {status}
          </span>
        )}
      </main>

      {/* Bottom controls */}
      <footer
        data-tauri-drag-region
        className={`relative z-10 flex items-center justify-center gap-2 ${
          compact ? 'p-1.5 pb-2' : 'p-4 gap-3'
        }`}
      >
        {status === 'running' ? (
          <button
            onClick={pause}
            className={`bg-zinc-800 hover:bg-zinc-700 rounded-lg flex items-center justify-center gap-1.5 font-medium transition active:scale-95 ${
              compact ? 'px-3 py-1 text-xs' : 'px-4 py-2 text-sm'
            }`}
          >
            <Pause size={compact ? 12 : 16} /> Pause
          </button>
        ) : (
          <button
            onClick={start}
            className={`bg-blue-600 hover:bg-blue-500 rounded-lg flex items-center justify-center gap-1.5 font-medium shadow-lg shadow-blue-600/30 transition active:scale-95 ${
              compact ? 'px-3 py-1 text-xs' : 'px-4 py-2 text-sm'
            }`}
          >
            <Play size={compact ? 12 : 16} /> Start
          </button>
        )}
        <button
          onClick={resetAndRestart}
          title="Reset timer (Cmd+Shift+R)"
          className={`bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-300 hover:text-white flex items-center justify-center gap-1 text-xs transition active:scale-95 ${
            compact ? 'px-2.5 py-1' : 'px-3 py-2 text-sm'
          }`}
        >
          <RotateCcw size={compact ? 12 : 14} /> Reset
        </button>
      </footer>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        hotkeys={hotkeys}
        onUpdateHotkeys={setHotkeys}
        alwaysOnTop={alwaysOnTop}
        onUpdateAlwaysOnTop={setAlwaysOnTop}
        decorations={decorations}
        onUpdateDecorations={setDecorations}
        compact={compact}
        onUpdateCompact={setCompact}
        clickThrough={clickThrough}
        onUpdateClickThrough={toggleClickThrough}
        soundTone={soundTone}
        onUpdateSoundTone={setSoundTone}
        soundVolume={soundVolume}
        onUpdateSoundVolume={setSoundVolume}
        serverUrl={serverUrl}
        onUpdateServerUrl={setServerUrl}
        webViewerBaseUrl={webViewerBaseUrl}
        onUpdateWebViewerBaseUrl={setWebViewerBaseUrl}
      />

      {/* Share Session Modal */}
      <ShareSessionModal
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
        isLive={isLive}
        roomCode={roomCode}
        viewerCount={viewerCount}
        onStartLive={openSession}
        onStopLive={closeSession}
        webViewerBaseUrl={webViewerBaseUrl}
      />
    </div>
  );
}
