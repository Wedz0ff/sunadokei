import { useState, useEffect } from 'react';
import { X, Volume2, Keyboard, Globe, RotateCcw, Monitor, Pin, Eye, Ghost } from 'lucide-react';
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 select-none">
      <div
        className="tibia-window bg-[#1b1c22] border-2 border-[#090a0c] rounded-xl p-6 w-full max-w-md shadow-2xl relative text-[#dfd7c2] animate-in fade-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-heading"
      >
        <button
          onClick={onClose}
          className="tibia-btn absolute top-4 right-4 p-1 rounded text-[#9e9785] hover:text-[#dfd7c2]"
          aria-label="Close Settings"
        >
          <X size={15} />
        </button>

        <h2 id="settings-heading" className="text-xs font-pixel uppercase tracking-wide text-[#fef08a] mb-5 flex items-center gap-2 tibia-text-shadow">
          Preferences
        </h2>

        <div className="space-y-5 max-h-[72vh] overflow-y-auto pr-1">
          {/* Window & Display Section */}
          <section className="space-y-3">
            <h3 className="text-[10px] font-pixel uppercase tracking-wider text-[#cca34c] flex items-center gap-1.5">
              <Monitor size={13} /> Window & Display
            </h3>

            <div className="space-y-2 text-xs">
              {/* Always on Top */}
              <label className="flex items-center justify-between tibia-panel p-2.5 rounded border border-[#3c3e4c] cursor-pointer hover:brightness-110">
                <div className="flex items-center gap-2.5">
                  <Pin size={13} className={alwaysOnTop ? 'text-[#e8b855]' : 'text-[#9e9785]'} />
                  <div>
                    <span className="font-pixel text-[10px] text-[#dfd7c2]">Always on Top</span>
                    <p className="text-[9px] font-pixel text-[#9e9785] mt-0.5">Keep timer floating above all other windows</p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={alwaysOnTop}
                  onChange={(e) => onUpdateAlwaysOnTop(e.target.checked)}
                  className="w-4 h-4 rounded cursor-pointer accent-[#c89b3c]"
                />
              </label>

              {/* Window Title Bar */}
              <label className="flex items-center justify-between tibia-panel p-2.5 rounded border border-[#3c3e4c] cursor-pointer hover:brightness-110">
                <div className="flex items-center gap-2.5">
                  <Eye size={13} className={decorations ? 'text-[#e8b855]' : 'text-[#9e9785]'} />
                  <div>
                    <span className="font-pixel text-[10px] text-[#dfd7c2]">Show Title Bar</span>
                    <p className="text-[9px] font-pixel text-[#9e9785] mt-0.5">Uncheck to remove OS borders (frameless mode)</p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={decorations}
                  onChange={(e) => onUpdateDecorations(e.target.checked)}
                  className="w-4 h-4 rounded cursor-pointer accent-[#c89b3c]"
                />
              </label>

              {/* Compact Mode */}
              <label className="flex items-center justify-between tibia-panel p-2.5 rounded border border-[#3c3e4c] cursor-pointer hover:brightness-110">
                <div className="flex items-center gap-2.5">
                  <Monitor size={13} className={compact ? 'text-[#e8b855]' : 'text-[#9e9785]'} />
                  <div>
                    <span className="font-pixel text-[10px] text-[#dfd7c2]">Compact Mode</span>
                    <p className="text-[9px] font-pixel text-[#9e9785] mt-0.5">Slim mini-widget display for minimal footprint</p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={compact}
                  onChange={(e) => onUpdateCompact(e.target.checked)}
                  className="w-4 h-4 rounded cursor-pointer accent-[#c89b3c]"
                />
              </label>

              {/* Click-Through Mode */}
              <label className="flex items-center justify-between tibia-panel p-2.5 rounded border border-[#3c3e4c] cursor-pointer hover:brightness-110">
                <div className="flex items-center gap-2.5">
                  <Ghost size={13} className={clickThrough ? 'text-[#c084fc]' : 'text-[#9e9785]'} />
                  <div>
                    <span className="font-pixel text-[10px] text-[#dfd7c2]">Click-Through (Ghost Mode)</span>
                    <p className="text-[9px] font-pixel text-[#9e9785] mt-0.5">
                      Clicks pass through. Hotkey: {formatHotkeyLabel(hotkeys.toggleClickThrough)}
                    </p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={clickThrough}
                  onChange={(e) => onUpdateClickThrough(e.target.checked)}
                  className="w-4 h-4 rounded cursor-pointer accent-[#a855f7]"
                />
              </label>
            </div>
          </section>

          <hr className="border-[#3c3e4c]" />

          {/* Hotkeys Section */}
          <section className="space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="text-[10px] font-pixel uppercase tracking-wider text-[#cca34c] flex items-center gap-1.5">
                <Keyboard size={13} /> Global Shortcuts
              </h3>
              <button
                onClick={() => onUpdateHotkeys(DEFAULT_HOTKEYS)}
                className="text-[9px] font-pixel text-[#9e9785] hover:text-[#fef08a] flex items-center gap-1 transition"
                title="Reset hotkeys to default"
              >
                <RotateCcw size={10} /> Reset Defaults
              </button>
            </div>

            <div className="space-y-2 text-xs">
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
                    className="flex items-center justify-between tibia-panel p-2.5 rounded border border-[#3c3e4c]"
                  >
                    <span className="font-pixel text-[10px] text-[#dfd7c2]">{label}</span>
                    <button
                      onClick={() => setRecordingKey(isRecording ? null : key)}
                      className={`font-pixel text-[9px] px-2.5 py-1.5 rounded transition ${
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
          </section>

          <hr className="border-[#3c3e4c]" />

          {/* Audio Alerts Section */}
          <section className="space-y-3">
            <h3 className="text-[10px] font-pixel uppercase tracking-wider text-[#cca34c] flex items-center gap-1.5">
              <Volume2 size={13} /> Audio Alerts
            </h3>

            <div className="space-y-3 text-xs">
              <div className="space-y-1.5">
                <span className="font-pixel text-[9px] text-[#9e9785] uppercase">Sound Tone</span>
                <div className="grid grid-cols-4 gap-1.5">
                  {(['bell', 'digital', 'chime', 'none'] as SoundTone[]).map((tone) => (
                    <button
                      key={tone}
                      onClick={() => {
                        onUpdateSoundTone(tone);
                        if (tone !== 'none') {
                          playAlertSound(soundVolume, tone);
                        }
                      }}
                      className={`py-1.5 px-2 rounded font-pixel text-[9px] uppercase transition ${
                        soundTone === tone
                          ? 'tibia-btn-gold text-[#fef08a]'
                          : 'tibia-btn text-[#9e9785]'
                      }`}
                    >
                      {tone}
                    </button>
                  ))}
                </div>
              </div>

              {soundTone !== 'none' && (
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[9px] font-pixel text-[#9e9785]">
                    <span>VOLUME</span>
                    <span className="text-[#fef08a]">{Math.round(soundVolume * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={soundVolume}
                    onChange={(e) => onUpdateSoundVolume(parseFloat(e.target.value))}
                    className="w-full accent-[#c89b3c]"
                  />
                </div>
              )}
            </div>
          </section>

          <hr className="border-[#3c3e4c]" />

          {/* Relay Server Section */}
          <section className="space-y-3">
            <h3 className="text-[10px] font-pixel uppercase tracking-wider text-[#cca34c] flex items-center gap-1.5">
              <Globe size={13} /> Live Session Relay
            </h3>

            <div className="space-y-2 text-xs">
              <div className="space-y-1">
                <span className="font-pixel text-[9px] text-[#9e9785] uppercase">WebSocket URL</span>
                <input
                  type="text"
                  value={serverUrl}
                  onChange={(e) => onUpdateServerUrl(e.target.value)}
                  placeholder="ws://localhost:8080"
                  className="w-full tibia-inset px-3 py-1.5 rounded font-digits text-sm text-[#fef08a] border border-[#3c3e4c] focus:outline-none focus:border-[#c89b3c]"
                />
              </div>

              {webViewerBaseUrl !== undefined && onUpdateWebViewerBaseUrl && (
                <div className="space-y-1">
                  <span className="font-pixel text-[9px] text-[#9e9785] uppercase">Web Viewer Base URL</span>
                  <input
                    type="text"
                    value={webViewerBaseUrl}
                    onChange={(e) => onUpdateWebViewerBaseUrl(e.target.value)}
                    placeholder="http://localhost:5173"
                    className="w-full tibia-inset px-3 py-1.5 rounded font-digits text-sm text-[#fef08a] border border-[#3c3e4c] focus:outline-none focus:border-[#c89b3c]"
                  />
                </div>
              )}
            </div>
          </section>
        </div>

        <div className="mt-5 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 tibia-btn-gold text-[#fef08a] rounded font-pixel text-[10px] uppercase transition active:scale-95 shadow"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
