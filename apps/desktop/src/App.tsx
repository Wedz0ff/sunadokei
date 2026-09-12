import { useState, useEffect } from 'react';
import { useTimerEngine } from './hooks/useTimerEngine';
import { useGlobalShortcuts } from './hooks/useGlobalShortcuts';
import { TimerInput } from './components/TimerInput';
import { SettingsModal } from './components/SettingsModal';
import { formatDuration } from '@brachio/shared';
import { SoundTone } from './utils/audio';
import { Play, Pause, RotateCcw, Settings, Share2 } from 'lucide-react';

const STORAGE_KEYS = {
  HOTKEYS: 'brachio_hotkeys',
  SOUND_TONE: 'brachio_sound_tone',
  SOUND_VOLUME: 'brachio_sound_volume',
  SERVER_URL: 'brachio_server_url'
};

const DEFAULT_HOTKEYS = {
  resetAndRestart: 'CommandOrControl+Shift+R',
  resetAndPause: 'CommandOrControl+Shift+P',
  togglePause: 'CommandOrControl+Space'
};

export default function App() {
  const [hotkeys, setHotkeys] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.HOTKEYS);
      return saved ? JSON.parse(saved) : DEFAULT_HOTKEYS;
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

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

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

  const {
    inputString,
    setInputString,
    durationMs,
    remainingMs,
    status,
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

  useGlobalShortcuts(hotkeys, {
    onResetAndRestart: resetAndRestart,
    onResetAndPause: resetAndPause,
    onTogglePause: togglePause
  });

  const progressPercent = durationMs > 0 ? Math.min(100, Math.max(0, (remainingMs / durationMs) * 100)) : 0;

  return (
    <div className="relative w-screen h-screen flex flex-col justify-between items-center bg-zinc-950 text-white overflow-hidden select-none">
      {/* Background visual drain (Hourglass style) */}
      <div
        className={`absolute bottom-0 left-0 right-0 transition-all duration-100 ease-linear pointer-events-none ${
          status === 'finished' ? 'bg-rose-600/30' : 'bg-blue-600/25'
        }`}
        style={{ height: `${progressPercent}%` }}
      />

      {/* Header bar */}
      <header className="relative z-10 w-full p-3 flex justify-between items-center">
        <TimerInput
          value={inputString}
          onChange={setInputString}
          onSubmit={resetAndRestart}
          placeholder="e.g. 1min40s"
        />

        <div className="flex gap-2 items-center">
          <button
            title="Live Session Sharing"
            aria-label="Live Session Sharing"
            className="p-1.5 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white transition"
          >
            <Share2 size={16} />
          </button>
          <button
            onClick={() => setIsSettingsOpen(true)}
            title="Settings"
            aria-label="Settings"
            className="p-1.5 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white transition"
          >
            <Settings size={16} />
          </button>
        </div>
      </header>

      {/* Center time display */}
      <main className="relative z-10 flex flex-col items-center">
        <span
          className={`text-7xl font-mono font-bold tracking-tight ${
            status === 'finished' ? 'text-rose-400 animate-pulse' : 'text-white'
          }`}
        >
          {formatDuration(remainingMs)}
        </span>
        <span
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
      </main>

      {/* Bottom controls */}
      <footer className="relative z-10 p-4 flex gap-3">
        {status === 'running' ? (
          <button
            onClick={pause}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg flex items-center gap-2 font-medium transition active:scale-95"
          >
            <Pause size={16} /> Pause
          </button>
        ) : (
          <button
            onClick={start}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg flex items-center gap-2 font-medium shadow-lg shadow-blue-600/30 transition active:scale-95"
          >
            <Play size={16} /> Start
          </button>
        )}
        <button
          onClick={resetAndRestart}
          className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-300 hover:text-white flex items-center gap-1.5 text-sm transition active:scale-95"
        >
          <RotateCcw size={16} /> Reset
        </button>
      </footer>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        hotkeys={hotkeys}
        onUpdateHotkeys={setHotkeys}
        soundTone={soundTone}
        onUpdateSoundTone={setSoundTone}
        soundVolume={soundVolume}
        onUpdateSoundVolume={setSoundVolume}
        serverUrl={serverUrl}
        onUpdateServerUrl={setServerUrl}
      />
    </div>
  );
}
