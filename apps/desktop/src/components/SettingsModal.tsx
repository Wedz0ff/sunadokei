import { useState, useEffect } from 'react';
import { X, Volume2, Keyboard, Globe, RotateCcw, Monitor, Pin, Eye, Ghost, Shrink } from 'lucide-react';
import { SoundTone, playAlertSound } from '../utils/audio';

export interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  hotkeys: {
    resetAndRestart: string;
    resetAndPause: string;
    togglePause: string;
    toggleClickThrough: string;
  };
  onUpdateHotkeys: (hotkeys: {
    resetAndRestart: string;
    resetAndPause: string;
    togglePause: string;
    toggleClickThrough: string;
  }) => void;
  alwaysOnTop: boolean;
  onUpdateAlwaysOnTop: (val: boolean) => void;
  decorations: boolean;
  onUpdateDecorations: (val: boolean) => void;
  compact: boolean;
  onUpdateCompact: (val: boolean) => void;
  ultraCompact?: boolean;
  onUpdateUltraCompact?: (val: boolean) => void;
  clickThrough: boolean;
  onUpdateClickThrough: (val: boolean) => void;
  soundTone: SoundTone;
  onUpdateSoundTone: (tone: SoundTone) => void;
  soundVolume: number;
  onUpdateSoundVolume: (volume: number) => void;
  serverUrl: string;
  onUpdateServerUrl: (url: string) => void;
  webViewerBaseUrl?: string;
  onUpdateWebViewerBaseUrl?: (url: string) => void;
}

const DEFAULT_HOTKEYS = {
  resetAndRestart: 'CommandOrControl+Shift+R',
  resetAndPause: 'CommandOrControl+Shift+P',
  togglePause: 'CommandOrControl+Space',
  toggleClickThrough: 'CommandOrControl+Shift+C'
};

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  hotkeys,
  onUpdateHotkeys,
  alwaysOnTop,
  onUpdateAlwaysOnTop,
  decorations,
  onUpdateDecorations,
  compact,
  onUpdateCompact,
  ultraCompact,
  onUpdateUltraCompact,
  clickThrough,
  onUpdateClickThrough,
  soundTone,
  onUpdateSoundTone,
  soundVolume,
  onUpdateSoundVolume,
  serverUrl,
  onUpdateServerUrl,
  webViewerBaseUrl,
  onUpdateWebViewerBaseUrl
}) => {
  const [recordingKey, setRecordingKey] = useState<keyof typeof DEFAULT_HOTKEYS | null>(null);

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

      // Ignore modifier-only key presses
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
      onUpdateHotkeys({
        ...hotkeys,
        [recordingKey]: combo
      });
      setRecordingKey(null);
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
    };
  }, [recordingKey, hotkeys, onUpdateHotkeys]);

  // Close on Escape when not recording
  useEffect(() => {
    if (!isOpen || recordingKey) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, recordingKey, onClose]);

  if (!isOpen) return null;

  const formatHotkeyLabel = (combo: string) => {
    return combo
      .replace(/CommandOrControl/g, '⌘ / Ctrl')
      .replace(/\+/g, ' + ');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 select-none font-tibia">
      <div
        className="tibia-window-frame p-1 w-full max-w-md shadow-2xl relative text-[#c0c0c0]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-heading"
      >
        <div className="tibia-widget-top flex items-center justify-between px-2 py-1 mb-2">
          <h2 id="settings-heading" className="tibia-widget-top-text flex items-center gap-1.5">
            Preferences
          </h2>
          <button
            onClick={onClose}
            className="tibia-btn px-1.5 py-0.5 text-[11px] leading-none"
            aria-label="Close Settings"
          >
            <X size={12} />
          </button>
        </div>

        <div className="p-2 space-y-3 max-h-[72vh] overflow-y-auto">
          {/* Window & Display Section */}
          <section className="space-y-2">
            <h3 className="text-xs text-[#c0c0c0] flex items-center gap-1.5">
              <Monitor size={12} /> Window & Display
            </h3>

            <div className="space-y-1.5 text-xs">
              {/* Always on Top */}
              <label className="flex items-center justify-between tibia-panel p-2 cursor-pointer hover:brightness-110">
                <div className="flex items-center gap-2">
                  <Pin size={12} className={alwaysOnTop ? 'text-[#54e054]' : 'text-[#888888]'} />
                  <div>
                    <span className="text-xs text-[#c0c0c0]">Always on Top</span>
                    <p className="text-[10px] text-[#888888]">Keep timer floating above all other windows</p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={alwaysOnTop}
                  onChange={(e) => onUpdateAlwaysOnTop(e.target.checked)}
                  className="w-3.5 h-3.5 rounded cursor-pointer accent-[#54e054]"
                />
              </label>

              {/* Window Title Bar */}
              <label className="flex items-center justify-between tibia-panel p-2 cursor-pointer hover:brightness-110">
                <div className="flex items-center gap-2">
                  <Eye size={12} className={decorations ? 'text-[#54e054]' : 'text-[#888888]'} />
                  <div>
                    <span className="text-xs text-[#c0c0c0]">Show Title Bar</span>
                    <p className="text-[10px] text-[#888888]">Uncheck to remove OS borders (frameless mode)</p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={decorations}
                  onChange={(e) => onUpdateDecorations(e.target.checked)}
                  className="w-3.5 h-3.5 rounded cursor-pointer accent-[#54e054]"
                />
              </label>

              {/* Compact Mode */}
              <label className="flex items-center justify-between tibia-panel p-2 cursor-pointer hover:brightness-110">
                <div className="flex items-center gap-2">
                  <Monitor size={12} className={compact ? 'text-[#54e054]' : 'text-[#888888]'} />
                  <div>
                    <span className="text-xs text-[#c0c0c0]">Compact Mode</span>
                    <p className="text-[10px] text-[#888888]">Slim mini-widget display for minimal footprint</p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={compact}
                  onChange={(e) => onUpdateCompact(e.target.checked)}
                  className="w-3.5 h-3.5 rounded cursor-pointer accent-[#54e054]"
                />
              </label>

              {/* Ultra Compact Mode */}
              <label className="flex items-center justify-between tibia-panel p-2 cursor-pointer hover:brightness-110">
                <div className="flex items-center gap-2">
                  <Shrink size={12} className={ultraCompact ? 'text-[#54e054]' : 'text-[#888888]'} />
                  <div>
                    <span className="text-xs text-[#c0c0c0]">Ultra Compact Mode</span>
                    <p className="text-[10px] text-[#888888]">Display only the timer digits in a micro HUD (160×44px)</p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={ultraCompact || false}
                  onChange={(e) => onUpdateUltraCompact?.(e.target.checked)}
                  className="w-3.5 h-3.5 rounded cursor-pointer accent-[#54e054]"
                />
              </label>


              {/* Click-Through Mode */}
              <label className="flex items-center justify-between tibia-panel p-2 cursor-pointer hover:brightness-110">
                <div className="flex items-center gap-2">
                  <Ghost size={12} className={clickThrough ? 'text-[#5477ff]' : 'text-[#888888]'} />
                  <div>
                    <span className="text-xs text-[#c0c0c0]">Click-Through (Ghost Mode)</span>
                    <p className="text-[10px] text-[#888888]">
                      Clicks pass through. Hotkey: {formatHotkeyLabel(hotkeys.toggleClickThrough)}
                    </p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={clickThrough}
                  onChange={(e) => onUpdateClickThrough(e.target.checked)}
                  className="w-3.5 h-3.5 rounded cursor-pointer accent-[#5477ff]"
                />
              </label>
            </div>
          </section>

          {/* Hotkeys Section */}
          <section className="space-y-2">
            <div className="flex justify-between items-center">
              <h3 className="text-xs text-[#c0c0c0] flex items-center gap-1.5">
                <Keyboard size={12} /> Global Shortcuts
              </h3>
              <button
                onClick={() => onUpdateHotkeys(DEFAULT_HOTKEYS)}
                className="text-[10px] text-[#888888] hover:text-[#ffffff] flex items-center gap-1 transition"
                title="Reset hotkeys to default"
              >
                <RotateCcw size={10} /> Reset Defaults
              </button>
            </div>

            <div className="space-y-1.5 text-xs">
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
                    className="flex items-center justify-between tibia-panel p-2"
                  >
                    <span className="text-xs text-[#c0c0c0]">{label}</span>
                    <button
                      onClick={() => setRecordingKey(isRecording ? null : key)}
                      className={`text-xs px-2 py-1 transition ${
                        isRecording
                          ? 'tibia-btn-red text-[#ffffff] animate-pulse'
                          : 'tibia-btn text-[#c0c0c0]'
                      }`}
                    >
                      {isRecording ? 'PRESS KEYS...' : formatHotkeyLabel(hotkeys[key])}
                    </button>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Audio Alerts Section */}
          <section className="space-y-2">
            <h3 className="text-xs text-[#c0c0c0] flex items-center gap-1.5">
              <Volume2 size={12} /> Audio Alerts
            </h3>

            <div className="space-y-2 text-xs">
              <div className="space-y-1">
                <span className="text-[10px] text-[#888888] uppercase">Sound Tone</span>
                <div className="grid grid-cols-4 gap-1">
                  {(['bell', 'digital', 'chime', 'none'] as SoundTone[]).map((tone) => (
                    <button
                      key={tone}
                      onClick={() => {
                        onUpdateSoundTone(tone);
                        if (tone !== 'none') {
                          playAlertSound(soundVolume, tone);
                        }
                      }}
                      className={`py-1 px-1.5 text-xs uppercase transition ${
                        soundTone === tone
                          ? 'tibia-btn-green text-[#ffffff]'
                          : 'tibia-btn text-[#c0c0c0]'
                      }`}
                    >
                      {tone}
                    </button>
                  ))}
                </div>
              </div>

              {soundTone !== 'none' && (
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] text-[#888888]">
                    <span>VOLUME</span>
                    <span className="text-[#ffffff]">{Math.round(soundVolume * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={soundVolume}
                    onChange={(e) => onUpdateSoundVolume(parseFloat(e.target.value))}
                    className="w-full accent-[#54e054]"
                  />
                </div>
              )}
            </div>
          </section>

          {/* Relay Server Section */}
          <section className="space-y-2">
            <h3 className="text-xs text-[#c0c0c0] flex items-center gap-1.5">
              <Globe size={12} /> Live Session Relay
            </h3>

            <div className="space-y-2 text-xs">
              <div className="space-y-1">
                <span className="text-[10px] text-[#888888] uppercase">WebSocket URL</span>
                <input
                  type="text"
                  value={serverUrl}
                  onChange={(e) => onUpdateServerUrl(e.target.value)}
                  placeholder="ws://localhost:8080"
                  className="w-full tibia-slot px-2 py-1 text-xs text-[#ffffff] font-tibia outline-none"
                />
              </div>

              {webViewerBaseUrl !== undefined && onUpdateWebViewerBaseUrl && (
                <div className="space-y-1">
                  <span className="text-[10px] text-[#888888] uppercase">Web Viewer Base URL</span>
                  <input
                    type="text"
                    value={webViewerBaseUrl}
                    onChange={(e) => onUpdateWebViewerBaseUrl(e.target.value)}
                    placeholder="http://localhost:5173"
                    className="w-full tibia-slot px-2 py-1 text-xs text-[#ffffff] font-tibia outline-none"
                  />
                </div>
              )}
            </div>
          </section>
        </div>

        <div className="p-2 pt-0 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1 tibia-btn-green text-[#ffffff] text-xs uppercase font-bold tracking-wider shadow"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

