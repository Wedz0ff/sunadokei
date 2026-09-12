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
  Check
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

  // Handle window close requested in Tauri to hide rather than destroy
  useEffect(() => {
    if (!isTauri()) return;
    let unlisten: (() => void) | undefined;

    import('@tauri-apps/api/window').then(({ getCurrentWindow }) => {
      const win = getCurrentWindow();
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
    // Dispatch a storage event so the main window reacts immediately in the same process
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
      {/* Top Header */}
      <header className="p-3 border-b border-zinc-800/80 bg-zinc-900/60 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-blue-500 shadow-xs shadow-blue-500/50" />
          <h1 className="text-sm font-semibold text-white tracking-wide">Hourglass Preferences</h1>
        </div>
        <button
          onClick={closeSettingsWindow}
          className="px-2.5 py-1 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded border border-zinc-700 transition"
        >
          Close
        </button>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Navigation Sidebar */}
        <nav className="w-40 border-r border-zinc-800/80 bg-zinc-900/30 p-2 space-y-1">
          {[
            { id: 'display' as const, label: 'Window', icon: Monitor },
            { id: 'hotkeys' as const, label: 'Shortcuts', icon: Keyboard },
            { id: 'sound' as const, label: 'Audio', icon: Volume2 },
            { id: 'sync' as const, label: 'Live Sync', icon: Globe }
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition ${
                activeTab === id
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
              }`}
            >
              <Icon size={14} />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        {/* Content Area */}
        <main className="flex-1 p-5 overflow-y-auto bg-zinc-950">
          {/* Window & Display Tab */}
          {activeTab === 'display' && (
            <div className="space-y-4 max-w-sm">
              <div>
                <h2 className="text-sm font-semibold text-white">Window & Display</h2>
                <p className="text-xs text-zinc-500">Configure layout, decorations, and overlay behavior</p>
              </div>

              <div className="space-y-2">
                <label className="flex items-center justify-between bg-zinc-900/80 p-3 rounded-lg border border-zinc-800 cursor-pointer hover:border-zinc-700 transition">
                  <div className="flex items-center gap-2.5">
                    <Pin size={15} className={alwaysOnTop ? 'text-blue-400' : 'text-zinc-500'} />
                    <div>
                      <span className="text-xs font-medium text-zinc-200">Always on Top</span>
                      <p className="text-[11px] text-zinc-500">Float above all other open apps</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={alwaysOnTop}
                    onChange={(e) => handleUpdateAlwaysOnTop(e.target.checked)}
                    className="w-4 h-4 rounded bg-zinc-800 border-zinc-700 text-blue-600 focus:ring-0 cursor-pointer accent-blue-500"
                  />
                </label>

                <label className="flex items-center justify-between bg-zinc-900/80 p-3 rounded-lg border border-zinc-800 cursor-pointer hover:border-zinc-700 transition">
                  <div className="flex items-center gap-2.5">
                    <Eye size={15} className={decorations ? 'text-blue-400' : 'text-zinc-500'} />
                    <div>
                      <span className="text-xs font-medium text-zinc-200">Show Title Bar</span>
                      <p className="text-[11px] text-zinc-500">Uncheck for a clean frameless window</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={decorations}
                    onChange={(e) => handleUpdateDecorations(e.target.checked)}
                    className="w-4 h-4 rounded bg-zinc-800 border-zinc-700 text-blue-600 focus:ring-0 cursor-pointer accent-blue-500"
                  />
                </label>

                <label className="flex items-center justify-between bg-zinc-900/80 p-3 rounded-lg border border-zinc-800 cursor-pointer hover:border-zinc-700 transition">
                  <div className="flex items-center gap-2.5">
                    <Monitor size={15} className={compact ? 'text-blue-400' : 'text-zinc-500'} />
                    <div>
                      <span className="text-xs font-medium text-zinc-200">Compact Mode</span>
                      <p className="text-[11px] text-zinc-500">Slim mini-widget display</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={compact}
                    onChange={(e) => handleUpdateCompact(e.target.checked)}
                    className="w-4 h-4 rounded bg-zinc-800 border-zinc-700 text-blue-600 focus:ring-0 cursor-pointer accent-blue-500"
                  />
                </label>

                <div className="bg-zinc-900/40 p-3 rounded-lg border border-zinc-800 text-xs space-y-1">
                  <span className="font-medium text-zinc-300 flex items-center gap-1.5">
                    <Ghost size={13} className="text-purple-400" /> Click-Through (Ghost Mode)
                  </span>
                  <p className="text-[11px] text-zinc-500">
                    Use global shortcut <kbd className="px-1.5 py-0.5 bg-zinc-800 rounded font-mono text-[10px] text-zinc-300 border border-zinc-700">{formatHotkeyLabel(hotkeys.toggleClickThrough)}</kbd> to make all clicks pass through to background apps.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Hotkeys Tab */}
          {activeTab === 'hotkeys' && (
            <div className="space-y-4 max-w-sm">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-sm font-semibold text-white">Global Shortcuts</h2>
                  <p className="text-xs text-zinc-500">Operate timer even when unfocused</p>
                </div>
                <button
                  onClick={() => handleUpdateHotkeys(DEFAULT_HOTKEYS)}
                  className="text-[11px] text-zinc-400 hover:text-white flex items-center gap-1 transition"
                  title="Reset hotkeys to default"
                >
                  <RotateCcw size={11} /> Defaults
                </button>
              </div>

              <div className="space-y-2">
                {[
                  { key: 'resetAndRestart' as const, label: 'Reset & Restart' },
                  { key: 'resetAndPause' as const, label: 'Reset & Pause' },
                  { key: 'togglePause' as const, label: 'Start / Pause' },
                  { key: 'toggleClickThrough' as const, label: 'Toggle Click-Through' }
                ].map(({ key, label }) => {
                  const isRecording = recordingKey === key;
                  return (
                    <div
                      key={key}
                      className="flex justify-between items-center bg-zinc-900/80 p-2.5 rounded-lg border border-zinc-800"
                    >
                      <span className="text-xs font-medium text-zinc-300">{label}</span>
                      <button
                        onClick={() => setRecordingKey(isRecording ? null : key)}
                        className={`px-2.5 py-1 font-mono text-xs rounded transition border ${
                          isRecording
                            ? 'bg-blue-600 text-white border-blue-400 animate-pulse'
                            : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white border-zinc-700'
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
            <div className="space-y-4 max-w-sm">
              <div>
                <h2 className="text-sm font-semibold text-white">Audio Alerts</h2>
                <p className="text-xs text-zinc-500">Sound tone played when timer reaches zero</p>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-zinc-400 mb-1 text-xs">Alert Sound</label>
                  <select
                    value={soundTone}
                    onChange={(e) => handleUpdateSoundTone(e.target.value as SoundTone)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-blue-500"
                  >
                    <option value="bell">Bell (D5 → A5)</option>
                    <option value="chime">Chime (C5 → E5 → G5)</option>
                    <option value="sine">Sine Tone</option>
                    <option value="none">Mute (No Sound)</option>
                  </select>
                </div>

                <div>
                  <div className="flex justify-between text-zinc-400 mb-1 text-xs">
                    <label>Volume</label>
                    <span>{Math.round(soundVolume * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={soundVolume}
                    onChange={(e) => handleUpdateSoundVolume(parseFloat(e.target.value))}
                    disabled={soundTone === 'none'}
                    className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-500 disabled:opacity-40"
                  />
                </div>

                <button
                  onClick={() => playAlertSound(soundVolume, soundTone)}
                  disabled={soundTone === 'none'}
                  className="px-3 py-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg border border-zinc-700 flex items-center gap-1.5 transition disabled:opacity-40"
                >
                  <Volume2 size={13} /> Test Sound
                </button>
              </div>
            </div>
          )}

          {/* Live Sync Tab */}
          {activeTab === 'sync' && (
            <div className="space-y-4 max-w-sm">
              <div>
                <h2 className="text-sm font-semibold text-white">Live Sync Relay</h2>
                <p className="text-xs text-zinc-500">Configure remote web session server</p>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-zinc-400 mb-1 text-xs">WebSocket Relay Server</label>
                  <input
                    type="text"
                    value={serverUrl}
                    onChange={(e) => handleUpdateServerUrl(e.target.value)}
                    placeholder="ws://localhost:8080"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs font-mono text-zinc-200 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-zinc-400 mb-1 text-xs">Web Viewer Base URL</label>
                  <input
                    type="text"
                    value={webViewerBaseUrl}
                    onChange={(e) => handleUpdateWebViewerBaseUrl(e.target.value)}
                    placeholder="http://localhost:5173"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs font-mono text-zinc-200 focus:outline-none focus:border-blue-500"
                  />
                  <p className="text-[11px] text-zinc-500 mt-1">
                    Base URL for generated join links shared with other users.
                  </p>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Footer */}
      <footer className="p-3 border-t border-zinc-800/80 bg-zinc-900/60 flex items-center justify-between text-xs text-zinc-500">
        <span className="flex items-center gap-1 text-zinc-400">
          <Check size={13} className="text-green-400" /> Changes saved automatically
        </span>
        <button
          onClick={closeSettingsWindow}
          className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-medium transition"
        >
          Done
        </button>
      </footer>
    </div>
  );
}
