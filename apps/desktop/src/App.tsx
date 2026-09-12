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
  Pin,
  PinOff,
  Maximize2,
  Minimize2,
  Ghost,
  Edit3,
  Shrink
} from 'lucide-react';

const STORAGE_KEYS = {
  HOTKEYS: 'brachio_hotkeys',
  SOUND_TONE: 'brachio_sound_tone',
  SOUND_VOLUME: 'brachio_sound_volume',
  SERVER_URL: 'brachio_server_url',
  WEB_VIEWER_BASE_URL: 'brachio_web_viewer_base_url',
  ALWAYS_ON_TOP: 'brachio_always_on_top',
  DECORATIONS: 'brachio_decorations',
  COMPACT: 'brachio_compact',
  ULTRA_COMPACT: 'brachio_ultra_compact'
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
      return (
        localStorage.getItem(STORAGE_KEYS.SERVER_URL) ||
        import.meta.env.VITE_DEFAULT_SERVER_URL ||
        'wss://sunadokei.wed.tf'
      );
    } catch {
      return 'wss://sunadokei.wed.tf';
    }
  });

  const [webViewerBaseUrl, setWebViewerBaseUrl] = useState<string>(() => {
    try {
      return (
        localStorage.getItem(STORAGE_KEYS.WEB_VIEWER_BASE_URL) ||
        import.meta.env.VITE_DEFAULT_WEB_VIEWER_URL ||
        'https://sunadokei.wed.tf'
      );
    } catch {
      return 'https://sunadokei.wed.tf';
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
    ultraCompact,
    clickThrough,
    setAlwaysOnTop,
    toggleAlwaysOnTop,
    setDecorations,
    setCompact,
    toggleCompact,
    setUltraCompact,
    toggleUltraCompact,
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
      } else if (e.key === STORAGE_KEYS.ULTRA_COMPACT) {
        setUltraCompact(e.newValue === 'true');
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
    if (ultraCompact) return;
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

  {/* Ultra Compact View: Render ONLY the time digits and health/progress bar! */}
  if (ultraCompact) {
    return (
      <div
        data-tauri-drag-region
        onDoubleClick={toggleUltraCompact}
        className={`relative w-screen h-screen flex flex-col justify-center items-center select-none overflow-hidden font-tibia group cursor-move px-2 py-1 ${
          clickThrough ? 'opacity-90 ring-2 ring-purple-500' : ''
        }`}
        style={{
          background: "url('/tibia/background-dark.png')",
          borderWidth: '2px',
          borderImage: "url('/tibia/2-frame.png') 2 / 2px / 0 repeat",
          imageRendering: 'pixelated'
        }}
        title="Drag anywhere to move. Double-click to expand to full view."
      >
        {/* Hover Quick Actions */}
        <div className="absolute top-1 right-1 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-20">
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleAlwaysOnTop();
            }}
            title={alwaysOnTop ? 'Disable Always on Top' : 'Enable Always on Top'}
            className={`tibia-btn p-0.5 text-[9px] rounded-xs ${
              alwaysOnTop ? 'text-[#ffcc00]' : 'text-[#888888]'
            }`}
          >
            {alwaysOnTop ? <Pin size={9} className="text-[#ffcc00]" /> : <PinOff size={9} />}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleUltraCompact();
            }}
            title="Expand to Full View (or double-click)"
            className="tibia-btn p-0.5 text-[9px] rounded-xs text-[#c0c0c0] hover:text-[#ffffff]"
          >
            <Maximize2 size={9} />
          </button>
        </div>

        {/* Time Digits - Read-only display (editing disabled in shrink mode) */}
        <div
          data-tauri-drag-region
          className="relative w-full flex items-center justify-center select-none"
        >
          <span
            data-tauri-drag-region
            className={`w-full text-center font-tibia font-bold select-none block leading-none text-3xl tracking-normal pointer-events-none ${
              status === 'finished'
                ? 'text-[#ff5454]'
                : 'text-[#ffffff]'
            }`}
            style={{ textShadow: '2px 2px 0 #000000' }}
          >
            {formatDuration(remainingMs)}
          </span>
        </div>

        {/* Settings In-App Modal */}
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
          ultraCompact={ultraCompact}
          onUpdateUltraCompact={setUltraCompact}
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

  return (
    <div
      className={`relative w-screen h-screen flex flex-col justify-between overflow-hidden select-none transition-all font-tibia ${
        clickThrough ? 'opacity-90 ring-2 ring-purple-500' : ''
      }`}
      style={{
        background: "url('/tibia/background-regular.png')",
        imageRendering: 'pixelated'
      }}
    >
      {/* Background fluid / mana sand drain */}
      <div
        className={`absolute bottom-0 left-0 right-0 transition-all duration-150 pointer-events-none opacity-20 ${
          status === 'finished'
            ? 'bg-red-600'
            : status === 'paused'
            ? 'bg-amber-600'
            : 'bg-blue-600'
        }`}
        style={{ height: `${progressPercent}%` }}
      />

      {/* Click-Through Ghost Mode Banner */}
      {clickThrough && (
        <div
          data-tauri-drag-region
          className="relative z-30 tibia-widget-top py-1 px-2.5 flex items-center justify-between text-[11px] text-[#c084fc]"
        >
          <span className="flex items-center gap-1.5">
            <Ghost size={12} className="animate-pulse text-[#d8b4fe]" /> CLICK-THROUGH ACTIVE
          </span>
          <span className="text-[10px] text-[#e9d5ff]">Press {hotkeys.toggleClickThrough.replace('CommandOrControl', '⌘/Ctrl')} to unlock</span>
        </div>
      )}

      {/* Top Header Bar - Authentic Tibia Client Widget Top */}
      <header
        data-tauri-drag-region
        className={`relative z-10 w-full tibia-widget-top flex justify-between items-center cursor-move ${
          compact ? 'px-2 py-0.5' : 'px-2.5 py-1'
        }`}
      >
        <div data-tauri-drag-region className="flex items-center gap-1.5">
          {/* Red dragon icon / title */}
          <span className={compact ? 'text-xs' : 'text-sm'}>🐲</span>
          <span data-tauri-drag-region className={`tibia-widget-top-text text-[#c0c0c0] ${compact ? 'text-[10px]' : 'text-[11px]'}`}>
            Sunadokei 砂時計
          </span>
          {isLive && (
            <span className="px-1.5 py-0.2 bg-[#064e3b] text-[#54e054] text-[9px] border border-[#10b981]/50 rounded-xs">
              LIVE{viewerCount > 0 ? ` (${viewerCount})` : ''}
            </span>
          )}
        </div>

        <div className="flex gap-1 items-center">
          {/* Always on Top Pin Button */}
          <button
            onClick={toggleAlwaysOnTop}
            title={alwaysOnTop ? 'Disable Always on Top' : 'Enable Always on Top'}
            aria-label="Toggle Always on Top"
            className={`tibia-btn ${compact ? 'px-1 py-0.5' : 'px-1.5 py-0.5'} text-[10px] rounded-xs ${
              alwaysOnTop ? 'text-[#ffcc00]' : 'text-[#c0c0c0]'
            }`}
          >
            {alwaysOnTop ? <Pin size={compact ? 10 : 11} className="text-[#ffcc00]" /> : <PinOff size={compact ? 10 : 11} />}
          </button>

          {/* Compact Toggle Button */}
          <button
            onClick={toggleCompact}
            title={compact ? 'Expand to Full View' : 'Switch to Compact View'}
            aria-label="Toggle Compact Mode"
            className={`tibia-btn ${compact ? 'px-1 py-0.5' : 'px-1.5 py-0.5'} text-[10px] rounded-xs text-[#c0c0c0]`}
          >
            {compact ? <Maximize2 size={compact ? 10 : 11} /> : <Minimize2 size={compact ? 10 : 11} />}
          </button>

          {/* Ultra Compact Toggle Button */}
          <button
            onClick={toggleUltraCompact}
            title="Switch to Ultra Compact View (Time Only)"
            aria-label="Toggle Ultra Compact Mode"
            className={`tibia-btn ${compact ? 'px-1 py-0.5' : 'px-1.5 py-0.5'} text-[10px] rounded-xs text-[#c0c0c0] hover:text-[#ffffff]`}
          >
            <Shrink size={compact ? 10 : 11} />
          </button>

          {/* Share Button */}
          <button
            onClick={() => setIsShareOpen(true)}
            title="Live Session Sharing"
            aria-label="Live Session Sharing"
            className={`tibia-btn ${compact ? 'px-1 py-0.5' : 'px-1.5 py-0.5'} text-[10px] rounded-xs ${
              isLive ? 'text-[#54e054]' : 'text-[#c0c0c0]'
            }`}
          >
            <Share2 size={compact ? 10 : 11} />
          </button>


          {/* Settings Button */}
          <button
            onClick={openSettings}
            title="Settings"
            aria-label="Settings"
            className={`tibia-btn ${compact ? 'px-1 py-0.5' : 'px-1.5 py-0.5'} text-[10px] rounded-xs text-[#c0c0c0]`}
          >
            <Settings size={compact ? 10 : 11} />
          </button>
        </div>
      </header>

      {/* Main Body - Sunken Stone Panel with Health/Progress Bar */}
      <main
        data-tauri-drag-region
        className={`relative z-10 flex flex-col items-center justify-center w-full ${
          compact ? 'px-2 my-auto' : 'px-3 my-auto'
        }`}
      >
        <div className={`w-full max-w-sm tibia-panel flex flex-col items-center shadow-lg ${
          compact ? 'p-1.5' : 'p-3'
        }`}>
          {isEditingTime ? (
            <div className="flex flex-col items-center w-full">
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
                className={`tibia-slot w-full text-center text-[#ffffff] px-2 py-0.5 outline-none font-tibia ${
                  editError ? 'text-[#ff5454]' : 'text-[#ffffff]'
                } ${compact ? 'text-3xl' : 'text-6xl'}`}
                style={{ textShadow: '1px 1px 0 #000' }}
              />
              <div className="mt-0.5 text-[9px] text-[#909090]">
                {editError ? (
                  <span className="text-[#ff5454]">{editError}</span>
                ) : (
                  <span>Press <kbd className="text-[#ffffff]">Enter</kbd> to save, <kbd className="text-[#ffffff]">Esc</kbd> to cancel</span>
                )}
              </div>
            </div>
          ) : (
            <div
              onClick={handleStartEditing}
              title="Click to edit duration"
              className="cursor-pointer group relative flex flex-col items-center w-full"
            >
              <div className="relative w-full flex items-center justify-center">
                <span
                  data-tauri-drag-region
                  className={`w-full text-center font-tibia font-bold select-none block leading-none ${
                    compact ? 'text-4xl' : 'text-7xl md:text-8xl'
                  } ${
                    status === 'finished'
                      ? 'text-[#ff5454]'
                      : 'text-[#ffffff]'
                  }`}
                  style={{ textShadow: '2px 2px 0 #000000' }}
                >
                  {formatDuration(remainingMs)}
                </span>
                <Edit3
                  size={compact ? 11 : 14}
                  className="absolute right-1 opacity-0 group-hover:opacity-75 text-[#909090] transition-opacity pointer-events-none"
                />
              </div>

              {/* Status information row */}
              {!compact && (
                <div className="w-full flex justify-between items-center text-[10px] text-[#909090] mt-2 px-1">
                  <span>
                    Status:{' '}
                    <span
                      className={`font-bold ${
                        status === 'running'
                          ? 'text-[#54e054]'
                          : status === 'finished'
                          ? 'text-[#ff5454]'
                          : status === 'paused'
                          ? 'text-[#f59e0b]'
                          : 'text-[#c0c0c0]'
                      }`}
                      style={{ textShadow: '1px 1px 0 #000' }}
                    >
                      {status.toUpperCase()}
                    </span>
                  </span>
                  <span className="text-[#c0c0c0]">
                    Total: <span className="text-[#ffffff]">{inputString}</span>
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Bottom controls with Authentic Tibia Buttons */}
      <footer
        data-tauri-drag-region
        className={`relative z-10 w-full flex items-center justify-center gap-1.5 ${
          compact ? 'pb-1.5 pt-0' : 'pb-3 pt-2'
        }`}
      >
        {/* Running state */}
        {status === 'running' && (
          <>
            <button
              onClick={pause}
              title="Pause countdown"
              className={`tibia-btn ${compact ? 'px-2.5 py-1 text-[11px]' : 'px-4 py-1.5 text-xs'} font-tibia uppercase flex items-center gap-1`}
            >
              <Pause size={compact ? 10 : 12} /> Pause
            </button>
            <button
              onClick={stop}
              title="Stop and reset to beginning"
              className={`tibia-btn-red ${compact ? 'px-2.5 py-1 text-[11px]' : 'px-3.5 py-1.5 text-xs'} font-tibia uppercase flex items-center gap-1`}
            >
              <Square size={compact ? 10 : 11} /> Stop
            </button>
            <button
              onClick={resetAndRestart}
              title="Reset and restart immediately (Cmd+Shift+R)"
              className={`tibia-btn ${compact ? 'px-2 py-1 text-[11px]' : 'px-3 py-1.5 text-xs'} font-tibia uppercase flex items-center gap-1`}
            >
              <RotateCcw size={compact ? 10 : 11} /> Reset
            </button>
          </>
        )}

        {/* Paused state */}
        {status === 'paused' && (
          <>
            <button
              onClick={start}
              title="Resume countdown"
              className={`tibia-btn-green ${compact ? 'px-3 py-1 text-[11px]' : 'px-4 py-1.5 text-xs'} font-tibia uppercase flex items-center gap-1`}
            >
              <Play size={compact ? 10 : 12} /> Resume
            </button>
            <button
              onClick={stop}
              title="Stop and reset to beginning"
              className={`tibia-btn ${compact ? 'px-2.5 py-1 text-[11px]' : 'px-3.5 py-1.5 text-xs'} font-tibia uppercase flex items-center gap-1`}
            >
              <Square size={compact ? 10 : 11} /> Stop
            </button>
            <button
              onClick={resetAndRestart}
              title="Reset and restart immediately (Cmd+Shift+R)"
              className={`tibia-btn ${compact ? 'px-2 py-1 text-[11px]' : 'px-3 py-1.5 text-xs'} font-tibia uppercase flex items-center gap-1`}
            >
              <RotateCcw size={compact ? 10 : 11} /> Reset
            </button>
          </>
        )}

        {/* Finished / Alarm State */}
        {status === 'finished' && (
          <>
            <button
              onClick={stop}
              title="Stop alarm and reset"
              className={`tibia-btn-red ${compact ? 'px-3 py-1 text-[11px]' : 'px-5 py-1.5 text-xs'} font-tibia uppercase flex items-center gap-1`}
            >
              <Square size={compact ? 10 : 12} /> Stop Alarm
            </button>
            <button
              onClick={resetAndRestart}
              title="Restart from beginning"
              className={`tibia-btn-green ${compact ? 'px-2.5 py-1 text-[11px]' : 'px-4 py-1.5 text-xs'} font-tibia uppercase flex items-center gap-1`}
            >
              <RotateCcw size={compact ? 10 : 11} /> Restart
            </button>
          </>
        )}

        {/* Idle state */}
        {status === 'idle' && (
          <>
            <button
              onClick={start}
              title="Start countdown"
              className={`tibia-btn-green ${compact ? 'px-4 py-1 text-[11px]' : 'px-6 py-1.5 text-xs'} font-tibia uppercase flex items-center gap-1`}
            >
              <Play size={compact ? 10 : 12} /> Start
            </button>
            <button
              onClick={resetAndRestart}
              title="Reset timer (Cmd+Shift+R)"
              className={`tibia-btn ${compact ? 'px-2.5 py-1 text-[11px]' : 'px-3.5 py-1.5 text-xs'} font-tibia uppercase flex items-center gap-1`}
            >
              <RotateCcw size={compact ? 10 : 11} /> Reset
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
        ultraCompact={ultraCompact}
        onUpdateUltraCompact={setUltraCompact}
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
