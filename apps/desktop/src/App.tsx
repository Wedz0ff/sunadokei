import { useState, useEffect, useRef } from 'react';
import { useTimerEngine } from './hooks/useTimerEngine';
import { useGlobalShortcuts } from './hooks/useGlobalShortcuts';
import { useHostSync } from './hooks/useHostSync';
import { useWindowControls } from './hooks/useWindowControls';
import { SettingsModal } from './components/SettingsModal';
import { SettingsWindow } from './components/SettingsWindow';
import { ShareSessionModal } from './components/ShareSessionModal';
import { formatDuration, parseTimeString } from '@brachio/shared';
import { SoundTone } from './utils/audio';
import { isTauri } from '@tauri-apps/api/core';
import {
  Play,
  Pause,
  Square,
  RotateCcw,
  Settings,
  Share2,
  Radio,
  Pin,
  PinOff,
  Maximize2,
  Minimize2,
  Ghost,
  Edit3
} from 'lucide-react';

const STORAGE_KEYS = {
  HOTKEYS: 'brachio_hotkeys',
  SOUND_TONE: 'brachio_sound_tone',
  SOUND_VOLUME: 'brachio_sound_volume',
  SERVER_URL: 'brachio_server_url',
  WEB_VIEWER_BASE_URL: 'brachio_web_viewer_base_url',
  ALWAYS_ON_TOP: 'brachio_always_on_top',
  DECORATIONS: 'brachio_decorations',
  COMPACT: 'brachio_compact'
};

const DEFAULT_HOTKEYS = {
  resetAndRestart: 'CommandOrControl+Shift+R',
  resetAndPause: 'CommandOrControl+Shift+P',
  togglePause: 'CommandOrControl+Space',
  toggleClickThrough: 'CommandOrControl+Shift+C'
};

export default function App() {
  // If this window is launched as the dedicated settings window, render SettingsWindow
  const isSettingsWindow =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('window') === 'settings';

  if (isSettingsWindow) {
    return <SettingsWindow />;
  }

  return <MainTimerApp />;
}

function MainTimerApp() {
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

  // Inline time editing state
  const [isEditingTime, setIsEditingTime] = useState(false);
  const [editTimeValue, setEditTimeValue] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

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

  // Listen for storage changes from the separate Settings window
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (!e.key || !e.newValue) return;
      if (e.key === STORAGE_KEYS.HOTKEYS) {
        try {
          setHotkeys(JSON.parse(e.newValue));
        } catch {}
      } else if (e.key === STORAGE_KEYS.SOUND_TONE) {
        setSoundTone(e.newValue as SoundTone);
      } else if (e.key === STORAGE_KEYS.SOUND_VOLUME) {
        setSoundVolume(parseFloat(e.newValue));
      } else if (e.key === STORAGE_KEYS.SERVER_URL) {
        setServerUrl(e.newValue);
      } else if (e.key === STORAGE_KEYS.WEB_VIEWER_BASE_URL) {
        setWebViewerBaseUrl(e.newValue);
      } else if (e.key === STORAGE_KEYS.ALWAYS_ON_TOP) {
        setAlwaysOnTop(e.newValue === 'true');
      } else if (e.key === STORAGE_KEYS.DECORATIONS) {
        setDecorations(e.newValue === 'true');
      } else if (e.key === STORAGE_KEYS.COMPACT) {
        setCompact(e.newValue === 'true');
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [setAlwaysOnTop, setDecorations, setCompact]);

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
    stop,
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

  const openSettings = async () => {
    if (isTauri()) {
      try {
        const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow');
        const win = await WebviewWindow.getByLabel('settings');
        if (win) {
          await win.show();
          await win.setFocus();
          return;
        }
      } catch (err) {
        console.warn('Failed to open native settings window, falling back to modal:', err);
      }
    }
    setIsSettingsOpen(true);
  };

  // Start inline editing of the duration directly on the time display
  const handleStartEditing = () => {
    if (status === 'running') {
      pause();
    }
    setEditTimeValue(inputString);
    setEditError(null);
    setIsEditingTime(true);
    setTimeout(() => {
      editInputRef.current?.focus();
      editInputRef.current?.select();
    }, 20);
  };

  // Save the edited time duration
  const handleSaveEditTime = () => {
    const trimmed = editTimeValue.trim();
    if (!trimmed) {
      setIsEditingTime(false);
      return;
    }
    const parsed = parseTimeString(trimmed);
    if (!parsed.valid) {
      setEditError(parsed.error || 'Invalid time');
      return;
    }

    setInputString(trimmed);
    setIsEditingTime(false);
    setEditError(null);
  };

  const handleEditKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSaveEditTime();
    } else if (e.key === 'Escape') {
      setIsEditingTime(false);
      setEditError(null);
    }
  };

  const progressPercent = durationMs > 0 ? Math.min(100, Math.max(0, (remainingMs / durationMs) * 100)) : 0;

  return (
    <div
      className={`relative w-screen h-screen flex flex-col justify-between items-center bg-[#1b1c22] text-[#dfd7c2] overflow-hidden select-none transition-all tibia-window ${
        clickThrough ? 'opacity-90 ring-2 ring-purple-500/80' : ''
      }`}
    >
      {/* Background visual drain (Hourglass / Mana sand style) */}
      <div
        className={`absolute bottom-0 left-0 right-0 transition-all duration-150 pointer-events-none ${
          status === 'finished'
            ? 'bg-gradient-to-t from-[#5a0c0c]/80 to-[#991b1b]/50 border-t-2 border-[#ef4444]'
            : status === 'paused'
            ? 'bg-gradient-to-t from-[#572704]/80 to-[#b45309]/40 border-t-2 border-[#f59e0b]'
            : 'bg-gradient-to-t from-[#0f2357]/85 to-[#1d4ed8]/45 border-t-2 border-[#60a5fa]'
        }`}
        style={{ height: `${progressPercent}%` }}
      />

      {/* Click-Through Ghost Mode Banner */}
      {clickThrough && (
        <div
          data-tauri-drag-region
          className="absolute top-0 left-0 right-0 z-30 bg-[#3b0764]/95 text-[#f3e8ff] border-b border-[#a855f7] text-[9px] font-pixel py-1 px-2 flex items-center justify-between pointer-events-none"
        >
          <span className="flex items-center gap-1.5">
            <Ghost size={11} className="animate-pulse text-[#d8b4fe]" /> CLICK-THROUGH ACTIVE
          </span>
          <span className="font-sans text-[10px] text-[#e9d5ff]">Press {hotkeys.toggleClickThrough.replace('CommandOrControl', '⌘/Ctrl')} to unlock</span>
        </div>
      )}

      {/* Header bar - Tibia stone titleplate & utility buttons */}
      <header
        data-tauri-drag-region
        className={`relative z-10 w-full flex justify-between items-center ${
          compact ? 'p-1.5 px-2' : 'p-2.5 px-3'
        }`}
      >
        <div data-tauri-drag-region className="flex items-center gap-2">
          {isLive && (
            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-[#064e3b]/90 border border-[#059669] rounded text-[9px] font-pixel text-[#6ee7b7] shadow">
              <Radio size={10} className="animate-pulse text-[#34d399]" />
              <span>LIVE</span>
              <span className="text-[#a7f3d0]">({viewerCount})</span>
            </div>
          )}
        </div>

        <div className="flex gap-1.5 items-center">
          {/* Always on Top Pin Button */}
          <button
            onClick={toggleAlwaysOnTop}
            title={alwaysOnTop ? 'Disable Always on Top' : 'Enable Always on Top'}
            aria-label="Toggle Always on Top"
            className={`tibia-btn p-1.5 rounded transition ${
              alwaysOnTop ? 'text-[#fef08a] border-[#c89b3c] bg-[#3a2e12]' : 'text-[#9e9785] hover:text-[#dfd7c2]'
            }`}
          >
            {alwaysOnTop ? <Pin size={compact ? 12 : 14} className="text-[#e8b855]" /> : <PinOff size={compact ? 12 : 14} />}
          </button>

          {/* Compact Toggle Button */}
          <button
            onClick={toggleCompact}
            title={compact ? 'Expand to Full View' : 'Switch to Compact View'}
            aria-label="Toggle Compact Mode"
            className="tibia-btn p-1.5 rounded text-[#9e9785] hover:text-[#dfd7c2] transition"
          >
            {compact ? <Maximize2 size={12} /> : <Minimize2 size={14} />}
          </button>

          {/* Share Button */}
          <button
            onClick={() => setIsShareOpen(true)}
            title="Live Session Sharing"
            aria-label="Live Session Sharing"
            className={`tibia-btn relative p-1.5 rounded transition ${
              isLive ? 'text-[#6ee7b7] border-[#059669]' : 'text-[#9e9785] hover:text-[#dfd7c2]'
            }`}
          >
            <Share2 size={compact ? 12 : 14} />
            {isLive && (
              <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-[#34d399] animate-pulse" />
            )}
          </button>

          {/* Settings Button */}
          <button
            onClick={openSettings}
            title="Settings"
            aria-label="Settings"
            className="tibia-btn p-1.5 rounded text-[#9e9785] hover:text-[#dfd7c2] transition"
          >
            <Settings size={compact ? 12 : 14} />
          </button>
        </div>
      </header>

      {/* Center time display - sunken stone tablet with pixel numbers */}
      <main
        data-tauri-drag-region
        className={`relative z-10 flex flex-col items-center justify-center my-auto ${
          compact ? 'py-0' : 'py-1'
        }`}
      >
        {isEditingTime ? (
          <div className="flex flex-col items-center animate-in fade-in zoom-in-95 duration-100">
            <input
              ref={editInputRef}
              type="text"
              value={editTimeValue}
              onChange={(e) => {
                setEditTimeValue(e.target.value);
                setEditError(null);
              }}
              onKeyDown={handleEditKeyDown}
              onBlur={handleSaveEditTime}
              placeholder="e.g. 1min40s"
              className={`tibia-inset font-digits tracking-wider text-center text-[#fef08a] rounded-lg px-3 py-0.5 border-2 shadow-inner focus:outline-none ${
                editError ? 'border-[#ef4444]' : 'border-[#c89b3c] ring-1 ring-[#f59e0b]'
              } ${compact ? 'text-5xl w-44' : 'text-8xl w-72'}`}
            />
            <div className="mt-1.5 text-[9px] font-pixel text-[#9e9785] flex items-center gap-1.5">
              {editError ? (
                <span className="text-[#fca5a5]">{editError}</span>
              ) : (
                <span>Press <kbd className="px-1 py-0.5 bg-[#262834] rounded text-[#dfd7c2] border border-[#3c3e4c]">Enter</kbd> to save, <kbd className="px-1 py-0.5 bg-[#262834] rounded text-[#dfd7c2] border border-[#3c3e4c]">Esc</kbd> to cancel</span>
              )}
            </div>
          </div>
        ) : (
          <div
            onClick={handleStartEditing}
            title="Click to change duration"
            className="group relative flex flex-col items-center cursor-pointer px-4 py-1 rounded-lg hover:brightness-110 transition"
          >
            <div className="tibia-inset px-4 py-1 rounded border border-[#3c3e4c] flex items-center gap-2">
              <span
                data-tauri-drag-region
                className={`font-digits tracking-wider select-none transition-transform tibia-text-shadow ${
                  compact ? 'text-6xl' : 'text-8xl md:text-9xl'
                } ${
                  status === 'finished'
                    ? 'text-[#fca5a5] animate-pulse'
                    : 'text-[#fef08a]'
                }`}
              >
                {formatDuration(remainingMs)}
              </span>
              <Edit3
                size={compact ? 12 : 16}
                className="opacity-0 group-hover:opacity-80 text-[#c89b3c] transition-opacity"
              />
            </div>

            {!compact && (
              <span
                data-tauri-drag-region
                className={`text-[9px] mt-1.5 uppercase font-pixel tracking-wider flex items-center gap-1.5 tibia-text-shadow ${
                  status === 'running'
                    ? 'text-[#60a5fa]'
                    : status === 'finished'
                    ? 'text-[#f87171]'
                    : status === 'paused'
                    ? 'text-[#fbbf24]'
                    : 'text-[#9e9785] group-hover:text-[#e8b855]'
                }`}
              >
                {status === 'idle' ? 'Click numbers to edit' : status}
              </span>
            )}
          </div>
        )}
      </main>

      {/* Bottom controls with Pause, Stop, and Reset buttons */}
      <footer
        data-tauri-drag-region
        className={`relative z-10 flex items-center justify-center gap-2 ${
          compact ? 'p-1.5 pb-2' : 'p-3 gap-3'
        }`}
      >
        {/* Running state */}
        {status === 'running' && (
          <>
            <button
              onClick={pause}
              title="Pause countdown"
              className={`tibia-btn rounded flex items-center justify-center gap-1.5 font-pixel text-[10px] uppercase active:scale-95 ${
                compact ? 'px-2.5 py-1' : 'px-4 py-1.5'
              }`}
            >
              <Pause size={compact ? 11 : 13} /> Pause
            </button>
            <button
              onClick={stop}
              title="Stop and reset to beginning"
              className={`tibia-btn-ruby rounded flex items-center justify-center gap-1.5 font-pixel text-[10px] uppercase active:scale-95 ${
                compact ? 'px-2.5 py-1' : 'px-3.5 py-1.5'
              }`}
            >
              <Square size={compact ? 10 : 12} /> Stop
            </button>
            <button
              onClick={resetAndRestart}
              title="Reset and restart immediately (Cmd+Shift+R)"
              className={`tibia-btn rounded flex items-center justify-center gap-1 font-pixel text-[10px] uppercase active:scale-95 ${
                compact ? 'px-2 py-1' : 'px-3 py-1.5'
              }`}
            >
              <RotateCcw size={compact ? 10 : 12} /> Reset
            </button>
          </>
        )}

        {/* Paused state */}
        {status === 'paused' && (
          <>
            <button
              onClick={start}
              title="Resume countdown"
              className={`tibia-btn-mana rounded flex items-center justify-center gap-1.5 font-pixel text-[10px] uppercase active:scale-95 ${
                compact ? 'px-3 py-1' : 'px-4 py-1.5'
              }`}
            >
              <Play size={compact ? 11 : 13} /> Resume
            </button>
            <button
              onClick={stop}
              title="Stop and reset to beginning"
              className={`tibia-btn rounded flex items-center justify-center gap-1.5 font-pixel text-[10px] uppercase active:scale-95 ${
                compact ? 'px-2.5 py-1' : 'px-3.5 py-1.5'
              }`}
            >
              <Square size={compact ? 10 : 12} /> Stop
            </button>
            <button
              onClick={resetAndRestart}
              title="Reset and restart immediately (Cmd+Shift+R)"
              className={`tibia-btn rounded flex items-center justify-center gap-1 font-pixel text-[10px] uppercase active:scale-95 ${
                compact ? 'px-2 py-1' : 'px-3 py-1.5'
              }`}
            >
              <RotateCcw size={compact ? 10 : 12} /> Reset
            </button>
          </>
        )}

        {/* Finished / Alarm State */}
        {status === 'finished' && (
          <>
            <button
              onClick={stop}
              title="Stop alarm and reset"
              className={`tibia-btn-ruby rounded flex items-center justify-center gap-1.5 font-pixel text-[10px] uppercase active:scale-95 animate-bounce ${
                compact ? 'px-3 py-1' : 'px-5 py-2'
              }`}
            >
              <Square size={compact ? 11 : 13} /> Stop Alarm
            </button>
            <button
              onClick={resetAndRestart}
              title="Restart from beginning"
              className={`tibia-btn-gold rounded flex items-center justify-center gap-1 font-pixel text-[10px] uppercase active:scale-95 ${
                compact ? 'px-2.5 py-1' : 'px-3.5 py-2'
              }`}
            >
              <RotateCcw size={compact ? 10 : 12} /> Restart
            </button>
          </>
        )}

        {/* Idle state */}
        {status === 'idle' && (
          <>
            <button
              onClick={start}
              title="Start countdown"
              className={`tibia-btn-mana rounded flex items-center justify-center gap-1.5 font-pixel text-[10px] uppercase active:scale-95 ${
                compact ? 'px-3.5 py-1' : 'px-5 py-2'
              }`}
            >
              <Play size={compact ? 11 : 13} /> Start
            </button>
            <button
              onClick={resetAndRestart}
              title="Reset timer (Cmd+Shift+R)"
              className={`tibia-btn rounded flex items-center justify-center gap-1 font-pixel text-[10px] uppercase active:scale-95 ${
                compact ? 'px-2.5 py-1' : 'px-3.5 py-2'
              }`}
            >
              <RotateCcw size={compact ? 10 : 12} /> Reset
            </button>
          </>
        )}
      </footer>

      {/* Settings In-App Modal (Fallback for non-Tauri browser previews) */}
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
