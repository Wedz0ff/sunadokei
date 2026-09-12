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
    <div className="w-screen h-screen flex flex-col bg-[#121316] text-[#dfd7c2] select-none overflow-hidden font-sans">
      {/* Top Window Header */}
      <header className="px-5 py-3 border-b-2 border-[#090a0c] bg-[#16171c] flex items-center justify-between shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-4 h-4 rounded bg-[#c89b3c] border border-[#fef08a] shadow flex items-center justify-center">
            <div className="w-1.5 h-1.5 bg-[#2a1d04]" />
          </div>
          <div>
            <h1 className="text-xs font-pixel uppercase tracking-wide text-[#fef08a] tibia-text-shadow">Preferences</h1>
            <p className="text-[9px] font-pixel text-[#9e9785] mt-0.5">Tibia Hourglass Tracker</p>
          </div>
        </div>
        <button
          onClick={closeSettingsWindow}
          className="tibia-btn-gold px-3.5 py-1.5 font-pixel text-[10px] uppercase rounded transition active:scale-95 shadow"
        >
          Done
        </button>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Navigation Sidebar */}
        <nav className="w-60 border-r-2 border-[#090a0c] bg-[#16171c] p-3 flex flex-col justify-between">
          <div className="space-y-1.5">
            <div className="px-2 py-1 text-[9px] font-pixel uppercase tracking-wider text-[#cca34c]">
              Category
            </div>
            {[
              { id: 'display' as const, label: 'Window & Display', desc: 'Layout & Ghost', icon: Monitor },
              { id: 'hotkeys' as const, label: 'Global Shortcuts', desc: 'Unfocused Hotkeys', icon: Keyboard },
              { id: 'sound' as const, label: 'Audio Alerts', desc: 'Tones & Volume', icon: Volume2 },
              { id: 'sync' as const, label: 'Live Session', desc: 'Relay & Viewer URLs', icon: Globe }
            ].map(({ id, label, desc, icon: Icon }) => {
              const isActive = activeTab === id;
              return (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  className={`w-full text-left px-3 py-2 rounded text-xs transition flex items-center gap-2.5 ${
                    isActive
                      ? 'tibia-btn-gold text-[#fef08a] shadow'
                      : 'tibia-btn text-[#9e9785] hover:text-[#dfd7c2]'
                  }`}
                >
                  <Icon size={14} className={isActive ? 'text-[#fef08a]' : 'text-[#9e9785]'} />
                  <div className="overflow-hidden">
                    <div className="font-pixel text-[10px] truncate">{label}</div>
                    <div className={`text-[9px] truncate font-pixel mt-0.5 ${isActive ? 'text-[#fef08a]/80' : 'text-[#6e695b]'}`}>
                      {desc}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="tibia-inset p-3 rounded border border-[#3c3e4c] space-y-1">
            <div className="flex items-center gap-1.5 text-[#cca34c] font-pixel text-[9px]">
              <Sparkles size={11} className="text-[#f59e0b]" /> Instant Sync
            </div>
            <p className="text-[9px] font-pixel text-[#9e9785] leading-normal">
              All settings apply immediately to the main timer window in real time.
            </p>
          </div>
        </nav>

        {/* Content Area */}
        <main className="flex-1 p-6 overflow-y-auto bg-[#1b1c22]">
          {/* Window & Display Tab */}
          {activeTab === 'display' && (
            <div className="space-y-5 max-w-2xl">
              <div>
                <h2 className="text-xs font-pixel uppercase tracking-wide text-[#fef08a] tibia-text-shadow">Window & Display</h2>
                <p className="text-[10px] font-pixel text-[#9e9785] mt-1">Customize window appearance, always-on-top behavior, and mouse interaction.</p>
              </div>

              <div className="space-y-3">
                {/* Always on Top */}
                <div className="flex items-center justify-between tibia-panel p-4 rounded-lg border border-[#3c3e4c]">
                  <div className="flex items-start gap-3.5">
                    <div className="p-2 rounded bg-[#262834] text-[#e8b855] border border-[#3c3e4c]">
                      <Pin size={15} />
                    </div>
                    <div>
                      <span className="font-pixel text-[10px] text-[#dfd7c2]">Always on Top</span>
                      <p className="text-[9px] font-pixel text-[#9e9785] mt-1">
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
                    <div className="w-11 h-6 bg-[#262834] border border-[#3c3e4c] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-[#2b1f05] after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-[#dfd7c2] after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#c89b3c]"></div>
                  </label>
                </div>

                {/* Window Title Bar */}
                <div className="flex items-center justify-between tibia-panel p-4 rounded-lg border border-[#3c3e4c]">
                  <div className="flex items-start gap-3.5">
                    <div className="p-2 rounded bg-[#262834] text-[#e8b855] border border-[#3c3e4c]">
                      <Eye size={15} />
                    </div>
                    <div>
                      <span className="font-pixel text-[10px] text-[#dfd7c2]">Show Title Bar</span>
                      <p className="text-[9px] font-pixel text-[#9e9785] mt-1">
                        Toggle between native OS window borders and a sleek frameless minimalist window (still draggable).
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
                    <div className="w-11 h-6 bg-[#262834] border border-[#3c3e4c] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-[#2b1f05] after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-[#dfd7c2] after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#c89b3c]"></div>
                  </label>
                </div>

                {/* Compact Mode */}
                <div className="flex items-center justify-between tibia-panel p-4 rounded-lg border border-[#3c3e4c]">
                  <div className="flex items-start gap-3.5">
                    <div className="p-2 rounded bg-[#262834] text-[#e8b855] border border-[#3c3e4c]">
                      <Sliders size={15} />
                    </div>
                    <div>
                      <span className="font-pixel text-[10px] text-[#dfd7c2]">Compact Mode</span>
                      <p className="text-[9px] font-pixel text-[#9e9785] mt-1">
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
                    <div className="w-11 h-6 bg-[#262834] border border-[#3c3e4c] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-[#2b1f05] after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-[#dfd7c2] after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#c89b3c]"></div>
                  </label>
                </div>

                {/* Click-Through Mode Info */}
                <div className="bg-[#3b0764]/40 border border-[#a855f7]/50 rounded-lg p-4 flex items-start gap-3.5">
                  <div className="p-2 rounded bg-[#581c87]/50 text-[#d8b4fe] border border-[#a855f7]/60">
                    <Ghost size={15} />
                  </div>
                  <div className="space-y-1">
                    <span className="font-pixel text-[10px] text-[#e9d5ff]">Click-Through (Ghost Overlay Mode)</span>
                    <p className="text-[#d8b4fe] text-[9px] font-pixel leading-relaxed">
                      Allows mouse clicks and drags to pass directly through the timer to any window underneath. Use global hotkey{' '}
                      <kbd className="px-1.5 py-0.5 bg-[#1b1c22] text-[#fef08a] rounded font-pixel text-[9px] border border-[#c89b3c]">
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
            <div className="space-y-5 max-w-2xl">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-xs font-pixel uppercase tracking-wide text-[#fef08a] tibia-text-shadow">Global Shortcuts</h2>
                  <p className="text-[9px] font-pixel text-[#9e9785] mt-1">
                    These hotkeys trigger at the OS level even when the timer window is minimized or unfocused.
                  </p>
                </div>
                <button
                  onClick={() => handleUpdateHotkeys(DEFAULT_HOTKEYS)}
                  className="tibia-btn px-2.5 py-1 text-[9px] font-pixel rounded flex items-center gap-1.5 transition text-[#9e9785] hover:text-[#fef08a]"
                  title="Reset hotkeys to default"
                >
                  <RotateCcw size={10} /> Reset Defaults
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
                      className="flex justify-between items-center tibia-panel p-3.5 rounded-lg border border-[#3c3e4c]"
                    >
                      <div>
                        <div className="font-pixel text-[10px] text-[#dfd7c2]">{label}</div>
                        <div className="text-[9px] font-pixel text-[#9e9785] mt-1">{desc}</div>
                      </div>
                      <button
                        onClick={() => setRecordingKey(isRecording ? null : key)}
                        className={`px-3 py-1.5 font-pixel text-[9px] uppercase rounded transition min-w-[140px] text-center ${
                          isRecording
                            ? 'tibia-btn-ruby text-white animate-pulse'
                            : 'tibia-btn text-[#fef08a]'
                        }`}
                      >
                        {isRecording ? 'PRESS KEYS...' : formatHotkeyLabel(hotkeys[key])}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Audio Alerts Tab */}
          {activeTab === 'sound' && (
            <div className="space-y-5 max-w-2xl">
              <div>
                <h2 className="text-xs font-pixel uppercase tracking-wide text-[#fef08a] tibia-text-shadow">Audio Alerts</h2>
                <p className="text-[9px] font-pixel text-[#9e9785] mt-1">Select sound tone and playback volume when countdown reaches zero.</p>
              </div>

              <div className="tibia-panel p-5 rounded-lg border border-[#3c3e4c] space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-pixel uppercase text-[#cca34c] mb-1.5">Alert Tone</label>
                    <select
                      value={soundTone}
                      onChange={(e) => handleUpdateSoundTone(e.target.value as SoundTone)}
                      className="w-full tibia-inset border border-[#3c3e4c] rounded px-3 py-2 text-[10px] font-pixel uppercase text-[#dfd7c2] focus:outline-none focus:border-[#c89b3c]"
                    >
                      <option value="bell">Level Bell (D5 → A5)</option>
                      <option value="chime">Digital Chime (C5 → E5 → G5)</option>
                      <option value="sine">Clean Sine Tone</option>
                      <option value="none">Mute (No Sound Alert)</option>
                    </select>
                  </div>

                  <div>
                    <div className="flex justify-between text-[10px] font-pixel uppercase text-[#cca34c] mb-1.5">
                      <label>Volume Level</label>
                      <span className="text-[#fef08a] font-digits text-sm">{Math.round(soundVolume * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={soundVolume}
                      onChange={(e) => handleUpdateSoundVolume(parseFloat(e.target.value))}
                      disabled={soundTone === 'none'}
                      className="w-full h-2 rounded cursor-pointer accent-[#c89b3c] disabled:opacity-30 mt-2"
                    />
                  </div>
                </div>

                <div className="pt-2 flex justify-start">
                  <button
                    onClick={() => playAlertSound(soundVolume, soundTone)}
                    disabled={soundTone === 'none'}
                    className="tibia-btn px-3.5 py-1.5 font-pixel text-[10px] uppercase rounded flex items-center gap-2 transition disabled:opacity-40"
                  >
                    <Volume2 size={13} /> Play Preview Sound
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Live Sync Tab */}
          {activeTab === 'sync' && (
            <div className="space-y-5 max-w-2xl">
              <div>
                <h2 className="text-xs font-pixel uppercase tracking-wide text-[#fef08a] tibia-text-shadow">Live Session Sharing</h2>
                <p className="text-[9px] font-pixel text-[#9e9785] mt-1">Configure relay endpoints for broadcasting live synchronized timers to web viewers.</p>
              </div>

              <div className="tibia-panel p-5 rounded-lg border border-[#3c3e4c] space-y-4">
                <div>
                  <label className="block text-[10px] font-pixel uppercase text-[#cca34c] mb-1.5">WebSocket Relay Server</label>
                  <input
                    type="text"
                    value={serverUrl}
                    onChange={(e) => handleUpdateServerUrl(e.target.value)}
                    placeholder="ws://localhost:8080"
                    className="w-full tibia-inset border border-[#3c3e4c] rounded px-3 py-1.5 text-sm font-digits text-[#fef08a] focus:outline-none focus:border-[#c89b3c]"
                  />
                  <p className="text-[9px] font-pixel text-[#9e9785] mt-1">
                    WebSocket server address that hosts rooms and syncs timer state with viewers.
                  </p>
                </div>

                <div>
                  <label className="block text-[10px] font-pixel uppercase text-[#cca34c] mb-1.5">Web Viewer Base URL</label>
                  <input
                    type="text"
                    value={webViewerBaseUrl}
                    onChange={(e) => handleUpdateWebViewerBaseUrl(e.target.value)}
                    placeholder="http://localhost:5173"
                    className="w-full tibia-inset border border-[#3c3e4c] rounded px-3 py-1.5 text-sm font-digits text-[#fef08a] focus:outline-none focus:border-[#c89b3c]"
                  />
                  <p className="text-[9px] font-pixel text-[#9e9785] mt-1">
                    Base URL for the generated join links copied when sharing sessions (e.g. http://192.168.1.100:5173).
                  </p>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Bottom Status Footer */}
      <footer className="px-5 py-2.5 border-t-2 border-[#090a0c] bg-[#16171c] flex items-center justify-between text-xs text-[#9e9785]">
        <span className="flex items-center gap-1.5 font-pixel text-[9px] text-[#34d399]">
          <Check size={12} className="text-[#34d399]" /> Preferences are saved automatically
        </span>
        <button
          onClick={closeSettingsWindow}
          className="tibia-btn-gold px-4 py-1.5 text-[#fef08a] rounded font-pixel text-[10px] uppercase transition active:scale-95 shadow"
        >
          Done
        </button>
      </footer>
    </div>
  );
}
