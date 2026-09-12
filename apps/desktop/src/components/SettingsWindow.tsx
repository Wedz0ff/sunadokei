import { useState, useEffect } from 'react';
import {
  Volume2,
  Keyboard,
  Globe,
  RotateCcw,
  Monitor,
  Pin,
  Eye,
  Ghost,
  Check,
  Sliders,
  Sparkles
} from 'lucide-react';
import { isTauri } from '@tauri-apps/api/core';
import { SoundTone, playAlertSound } from '../utils/audio';

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

export function SettingsWindow() {
  const [activeTab, setActiveTab] = useState<'display' | 'hotkeys' | 'sound' | 'sync'>('display');
  const [recordingKey, setRecordingKey] = useState<keyof typeof DEFAULT_HOTKEYS | null>(null);

  const [hotkeys, setHotkeys] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.HOTKEYS);
      return saved ? { ...DEFAULT_HOTKEYS, ...JSON.parse(saved) } : DEFAULT_HOTKEYS;
    } catch {
      return DEFAULT_HOTKEYS;
    }
  });

  const [alwaysOnTop, setAlwaysOnTop] = useState(() => {
    return localStorage.getItem(STORAGE_KEYS.ALWAYS_ON_TOP) === 'true';
  });

  const [decorations, setDecorations] = useState(() => {
    const val = localStorage.getItem(STORAGE_KEYS.DECORATIONS);
    return val === null ? true : val === 'true';
  });

  const [compact, setCompact] = useState(() => {
    return localStorage.getItem(STORAGE_KEYS.COMPACT) === 'true';
  });

  const [soundTone, setSoundTone] = useState<SoundTone>(() => {
    return (localStorage.getItem(STORAGE_KEYS.SOUND_TONE) as SoundTone) || 'bell';
  });

  const [soundVolume, setSoundVolume] = useState<number>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.SOUND_VOLUME);
    return saved ? parseFloat(saved) : 0.8;
  });

  const [serverUrl, setServerUrl] = useState<string>(() => {
    return localStorage.getItem(STORAGE_KEYS.SERVER_URL) || 'ws://localhost:8080';
  });

  const [webViewerBaseUrl, setWebViewerBaseUrl] = useState<string>(() => {
    return (
      localStorage.getItem(STORAGE_KEYS.WEB_VIEWER_BASE_URL) ||
      `http://${typeof window !== 'undefined' && window.location?.hostname ? window.location.hostname : 'localhost'}:5173`
    );
  });

  // Ensure window size is generous and handle window close requested to hide
  useEffect(() => {
    if (!isTauri()) return;
    let unlisten: (() => void) | undefined;

    import('@tauri-apps/api/window').then(({ getCurrentWindow, LogicalSize }) => {
      const win = getCurrentWindow();
      win.setSize(new LogicalSize(760, 540)).catch(() => {});
      win.onCloseRequested((event) => {
        event.preventDefault();
        win.hide();
      }).then((fn) => {
        unlisten = fn;
      });
    });

    return () => {
      unlisten?.();
    };
  }, []);

  // Sync to localStorage and notify other windows via custom storage event
  const saveAndNotify = (key: string, value: string) => {
    localStorage.setItem(key, value);
    window.dispatchEvent(new StorageEvent('storage', { key, newValue: value }));
  };

  const handleUpdateAlwaysOnTop = (val: boolean) => {
    setAlwaysOnTop(val);
    saveAndNotify(STORAGE_KEYS.ALWAYS_ON_TOP, String(val));
    if (isTauri()) {
      import('@tauri-apps/api/window').then(({ Window }) => {
        Window.getByLabel('main').then((mainWin) => mainWin?.setAlwaysOnTop(val));
      });
    }
  };

  const handleUpdateDecorations = (val: boolean) => {
    setDecorations(val);
    saveAndNotify(STORAGE_KEYS.DECORATIONS, String(val));
    if (isTauri()) {
      import('@tauri-apps/api/window').then(({ Window }) => {
        Window.getByLabel('main').then((mainWin) => mainWin?.setDecorations(val));
      });
    }
  };

  const handleUpdateCompact = (val: boolean) => {
    setCompact(val);
    saveAndNotify(STORAGE_KEYS.COMPACT, String(val));
    if (isTauri()) {
      import('@tauri-apps/api/window').then(({ Window, LogicalSize }) => {
        Window.getByLabel('main').then((mainWin) => {
          mainWin?.setSize(val ? new LogicalSize(240, 95) : new LogicalSize(420, 280));
        });
      });
    }
  };

  const handleUpdateHotkeys = (newHotkeys: typeof DEFAULT_HOTKEYS) => {
    setHotkeys(newHotkeys);
    saveAndNotify(STORAGE_KEYS.HOTKEYS, JSON.stringify(newHotkeys));
  };

  const handleUpdateSoundTone = (tone: SoundTone) => {
    setSoundTone(tone);
    saveAndNotify(STORAGE_KEYS.SOUND_TONE, tone);
  };

  const handleUpdateSoundVolume = (volume: number) => {
    setSoundVolume(volume);
    saveAndNotify(STORAGE_KEYS.SOUND_VOLUME, volume.toString());
  };

  const handleUpdateServerUrl = (url: string) => {
    setServerUrl(url);
    saveAndNotify(STORAGE_KEYS.SERVER_URL, url);
  };

  const handleUpdateWebViewerBaseUrl = (url: string) => {
    setWebViewerBaseUrl(url);
    saveAndNotify(STORAGE_KEYS.WEB_VIEWER_BASE_URL, url);
  };

  const closeSettingsWindow = async () => {
    if (isTauri()) {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      getCurrentWindow().hide();
    } else {
      window.close();
    }
  };

  // Key recorder event handler
  useEffect(() => {
    if (!recordingKey) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (e.key === 'Escape') {
        setRecordingKey(null);
        return;
      }

      if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) {
        return;
      }

      const parts: string[] = [];
      if (e.metaKey || e.ctrlKey) parts.push('CommandOrControl');
      if (e.altKey) parts.push('Alt');
      if (e.shiftKey) parts.push('Shift');

      let keyName = e.key.toUpperCase();
      if (e.code === 'Space' || e.key === ' ') {
        keyName = 'Space';
      } else if (keyName.length === 1) {
        keyName = keyName.toUpperCase();
      }

      parts.push(keyName);

      const combo = parts.join('+');
      handleUpdateHotkeys({
        ...hotkeys,
        [recordingKey]: combo
      });
      setRecordingKey(null);
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
    };
  }, [recordingKey, hotkeys]);

  const formatHotkeyLabel = (combo: string) => {
    return combo
      .replace(/CommandOrControl/g, '⌘ / Ctrl')
      .replace(/\+/g, ' + ');
  };

  return (
    <div className="w-screen h-screen flex flex-col bg-zinc-950 text-zinc-200 select-none overflow-hidden font-sans">
      {/* Top Window Header */}
      <header className="px-5 py-3.5 border-b border-zinc-800/80 bg-zinc-900/70 flex items-center justify-between backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-3.5 h-3.5 rounded-full bg-blue-500 shadow-md shadow-blue-500/40 flex items-center justify-center">
            <div className="w-1.5 h-1.5 rounded-full bg-white/80" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-white tracking-tight">Preferences</h1>
            <p className="text-[11px] text-zinc-400">Hourglass Synchronized Timer</p>
          </div>
        </div>
        <button
          onClick={closeSettingsWindow}
          className="px-3.5 py-1.5 text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white rounded-lg border border-zinc-700/80 transition active:scale-95 shadow-xs"
        >
          Done
        </button>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Navigation Sidebar */}
        <nav className="w-56 border-r border-zinc-800/80 bg-zinc-900/30 p-3 flex flex-col justify-between">
          <div className="space-y-1">
            <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              General Settings
            </div>
            {[
              { id: 'display' as const, label: 'Window & Display', desc: 'Layout, Pinning, Ghost', icon: Monitor },
              { id: 'hotkeys' as const, label: 'Global Shortcuts', desc: 'Unfocused Hotkeys', icon: Keyboard },
              { id: 'sound' as const, label: 'Audio Alerts', desc: 'Tones & Volume', icon: Volume2 },
              { id: 'sync' as const, label: 'Live Session', desc: 'Relay & Viewer URLs', icon: Globe }
            ].map(({ id, label, desc, icon: Icon }) => {
              const isActive = activeTab === id;
              return (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-medium transition flex items-center gap-3 ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-600/25 font-semibold'
                      : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60'
                  }`}
                >
                  <Icon size={16} className={isActive ? 'text-white' : 'text-zinc-400'} />
                  <div className="overflow-hidden">
                    <div className="truncate">{label}</div>
                    <div className={`text-[10px] truncate ${isActive ? 'text-blue-100' : 'text-zinc-500'}`}>
                      {desc}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="p-3 bg-zinc-900/60 rounded-xl border border-zinc-800/60 text-[11px] text-zinc-500 space-y-1">
            <div className="flex items-center gap-1.5 text-zinc-400 font-medium">
              <Sparkles size={12} className="text-amber-400" /> Instant Sync
            </div>
            <p>All settings apply instantly to the main timer window in real time.</p>
          </div>
        </nav>

        {/* Content Area */}
        <main className="flex-1 p-7 overflow-y-auto bg-zinc-950/70">
          {/* Window & Display Tab */}
          {activeTab === 'display' && (
            <div className="space-y-6 max-w-2xl">
              <div>
                <h2 className="text-base font-semibold text-white">Window & Display</h2>
                <p className="text-xs text-zinc-400 mt-0.5">Customize window appearance, always-on-top behavior, and mouse interaction.</p>
              </div>

              <div className="space-y-3">
                {/* Always on Top */}
                <div className="flex items-center justify-between bg-zinc-900/80 p-4 rounded-xl border border-zinc-800/80 hover:border-zinc-700/80 transition">
                  <div className="flex items-start gap-3.5">
                    <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 mt-0.5">
                      <Pin size={16} />
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-zinc-200">Always on Top</span>
                      <p className="text-xs text-zinc-400 mt-0.5">
                        Keep the timer window floating above games, code editors, and full-screen windows.
                      </p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={alwaysOnTop}
                      onChange={(e) => handleUpdateAlwaysOnTop(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>

                {/* Window Title Bar */}
                <div className="flex items-center justify-between bg-zinc-900/80 p-4 rounded-xl border border-zinc-800/80 hover:border-zinc-700/80 transition">
                  <div className="flex items-start gap-3.5">
                    <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 mt-0.5">
                      <Eye size={16} />
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-zinc-200">Show Title Bar</span>
                      <p className="text-xs text-zinc-400 mt-0.5">
                        Toggle between native OS window borders and a sleek frameless minimalist window (still fully draggable).
                      </p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={decorations}
                      onChange={(e) => handleUpdateDecorations(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>

                {/* Compact Mode */}
                <div className="flex items-center justify-between bg-zinc-900/80 p-4 rounded-xl border border-zinc-800/80 hover:border-zinc-700/80 transition">
                  <div className="flex items-start gap-3.5">
                    <div className="p-2 rounded-lg bg-teal-500/10 text-teal-400 border border-teal-500/20 mt-0.5">
                      <Sliders size={16} />
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-zinc-200">Compact Mode</span>
                      <p className="text-xs text-zinc-400 mt-0.5">
                        Shrink the timer into a sleek mini-widget (240px × 95px) taking minimal space on your desktop.
                      </p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={compact}
                      onChange={(e) => handleUpdateCompact(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>

                {/* Click-Through Mode Info */}
                <div className="bg-purple-950/30 border border-purple-800/40 rounded-xl p-4 flex items-start gap-3.5">
                  <div className="p-2 rounded-lg bg-purple-500/20 text-purple-300 border border-purple-500/30 mt-0.5">
                    <Ghost size={16} />
                  </div>
                  <div className="space-y-1 text-xs">
                    <span className="font-semibold text-purple-200">Click-Through (Ghost Overlay Mode)</span>
                    <p className="text-purple-300/80 text-[11px] leading-relaxed">
                      Allows mouse clicks and drags to pass directly through the timer to any window underneath. Use global hotkey{' '}
                      <kbd className="px-2 py-0.5 bg-zinc-900 text-purple-200 rounded font-mono font-bold text-[11px] border border-purple-700/50 shadow-xs">
                        {formatHotkeyLabel(hotkeys.toggleClickThrough)}
                      </kbd>{' '}
                      to toggle ghost mode on and off at any time.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Hotkeys Tab */}
          {activeTab === 'hotkeys' && (
            <div className="space-y-6 max-w-2xl">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-base font-semibold text-white">Global Shortcuts</h2>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    These hotkeys trigger at the OS level even when the timer window is minimized or unfocused.
                  </p>
                </div>
                <button
                  onClick={() => handleUpdateHotkeys(DEFAULT_HOTKEYS)}
                  className="px-2.5 py-1 text-xs text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700 rounded-lg border border-zinc-700/70 flex items-center gap-1.5 transition"
                  title="Reset hotkeys to default"
                >
                  <RotateCcw size={12} /> Reset Defaults
                </button>
              </div>

              <div className="space-y-2.5">
                {[
                  { key: 'resetAndRestart' as const, label: 'Reset & Restart', desc: 'Instantly resets timer to initial duration and restarts countdown' },
                  { key: 'resetAndPause' as const, label: 'Reset & Pause', desc: 'Resets timer to initial duration and remains paused' },
                  { key: 'togglePause' as const, label: 'Start / Pause', desc: 'Toggles between running and paused states' },
                  { key: 'toggleClickThrough' as const, label: 'Toggle Click-Through', desc: 'Enables or disables mouse passthrough overlay mode' }
                ].map(({ key, label, desc }) => {
                  const isRecording = recordingKey === key;
                  return (
                    <div
                      key={key}
                      className="flex justify-between items-center bg-zinc-900/80 p-3.5 rounded-xl border border-zinc-800/80 hover:border-zinc-700/80 transition"
                    >
                      <div>
                        <div className="text-xs font-semibold text-zinc-200">{label}</div>
                        <div className="text-[11px] text-zinc-500 mt-0.5">{desc}</div>
                      </div>
                      <button
                        onClick={() => setRecordingKey(isRecording ? null : key)}
                        className={`px-3 py-1.5 font-mono text-xs rounded-lg transition border shadow-xs min-w-[140px] text-center ${
                          isRecording
                            ? 'bg-blue-600 text-white border-blue-400 ring-2 ring-blue-500/50 animate-pulse'
                            : 'bg-zinc-800 text-zinc-200 hover:bg-zinc-700 hover:text-white border-zinc-700'
                        }`}
                      >
                        {isRecording ? 'Press keys...' : formatHotkeyLabel(hotkeys[key])}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Audio Alerts Tab */}
          {activeTab === 'sound' && (
            <div className="space-y-6 max-w-2xl">
              <div>
                <h2 className="text-base font-semibold text-white">Audio Alerts</h2>
                <p className="text-xs text-zinc-400 mt-0.5">Select sound tone and playback volume when the countdown reaches zero.</p>
              </div>

              <div className="bg-zinc-900/80 p-5 rounded-xl border border-zinc-800/80 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1.5">Alert Tone</label>
                    <select
                      value={soundTone}
                      onChange={(e) => handleUpdateSoundTone(e.target.value as SoundTone)}
                      className="w-full bg-zinc-950 border border-zinc-700/80 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-blue-500 shadow-xs"
                    >
                      <option value="bell">Level Bell (D5 → A5)</option>
                      <option value="chime">Digital Chime (C5 → E5 → G5)</option>
                      <option value="sine">Clean Sine Tone</option>
                      <option value="none">Mute (No Sound Alert)</option>
                    </select>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-medium text-zinc-300 mb-1.5">
                      <label>Volume Level</label>
                      <span className="text-zinc-400 font-mono">{Math.round(soundVolume * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={soundVolume}
                      onChange={(e) => handleUpdateSoundVolume(parseFloat(e.target.value))}
                      disabled={soundTone === 'none'}
                      className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-500 disabled:opacity-30 mt-2"
                    />
                  </div>
                </div>

                <div className="pt-2 flex justify-start">
                  <button
                    onClick={() => playAlertSound(soundVolume, soundTone)}
                    disabled={soundTone === 'none'}
                    className="px-3.5 py-1.5 text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white rounded-lg border border-zinc-700 flex items-center gap-2 transition disabled:opacity-40 shadow-xs"
                  >
                    <Volume2 size={14} /> Play Preview Sound
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Live Sync Tab */}
          {activeTab === 'sync' && (
            <div className="space-y-6 max-w-2xl">
              <div>
                <h2 className="text-base font-semibold text-white">Live Session Sharing</h2>
                <p className="text-xs text-zinc-400 mt-0.5">Configure relay endpoints for broadcasting live synchronized timers to web viewers.</p>
              </div>

              <div className="bg-zinc-900/80 p-5 rounded-xl border border-zinc-800/80 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1.5">WebSocket Relay Server</label>
                  <input
                    type="text"
                    value={serverUrl}
                    onChange={(e) => handleUpdateServerUrl(e.target.value)}
                    placeholder="ws://localhost:8080"
                    className="w-full bg-zinc-950 border border-zinc-700/80 rounded-lg px-3 py-2 text-xs font-mono text-zinc-200 focus:outline-none focus:border-blue-500 shadow-xs"
                  />
                  <p className="text-[11px] text-zinc-500 mt-1">
                    WebSocket server address that hosts rooms and syncs timer state with viewers.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1.5">Web Viewer Base URL</label>
                  <input
                    type="text"
                    value={webViewerBaseUrl}
                    onChange={(e) => handleUpdateWebViewerBaseUrl(e.target.value)}
                    placeholder="http://localhost:5173"
                    className="w-full bg-zinc-950 border border-zinc-700/80 rounded-lg px-3 py-2 text-xs font-mono text-zinc-200 focus:outline-none focus:border-blue-500 shadow-xs"
                  />
                  <p className="text-[11px] text-zinc-500 mt-1">
                    Base URL for the generated join links copied when sharing sessions (e.g. http://192.168.1.100:5173).
                  </p>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Bottom Status Footer */}
      <footer className="px-5 py-3 border-t border-zinc-800/80 bg-zinc-900/70 flex items-center justify-between text-xs text-zinc-400">
        <span className="flex items-center gap-1.5 text-zinc-400 font-medium">
          <Check size={14} className="text-green-400" /> Preferences are saved automatically
        </span>
        <button
          onClick={closeSettingsWindow}
          className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold transition active:scale-95 shadow-sm shadow-blue-600/30"
        >
          Done
        </button>
      </footer>
    </div>
  );
}
