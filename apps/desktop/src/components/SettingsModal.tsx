import { useState, useEffect } from 'react';
import { X, Volume2, Keyboard, Globe, RotateCcw } from 'lucide-react';
import { SoundTone, playAlertSound } from '../utils/audio';

export interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  hotkeys: {
    resetAndRestart: string;
    resetAndPause: string;
    togglePause: string;
  };
  onUpdateHotkeys: (hotkeys: {
    resetAndRestart: string;
    resetAndPause: string;
    togglePause: string;
  }) => void;
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
  togglePause: 'CommandOrControl+Space'
};

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  hotkeys,
  onUpdateHotkeys,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 select-none">
      <div
        className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 w-full max-w-md shadow-2xl relative text-zinc-200 animate-in fade-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-heading"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
          aria-label="Close Settings"
        >
          <X size={18} />
        </button>

        <h2 id="settings-heading" className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          Settings
        </h2>

        <div className="space-y-5 max-h-[75vh] overflow-y-auto pr-1">
          {/* Hotkeys Section */}
          <section className="space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                <Keyboard size={14} /> Global Shortcuts
              </h3>
              <button
                onClick={() => onUpdateHotkeys(DEFAULT_HOTKEYS)}
                className="text-[11px] text-zinc-400 hover:text-white flex items-center gap-1 transition"
                title="Reset hotkeys to default"
              >
                <RotateCcw size={11} /> Reset Defaults
              </button>
            </div>

            <div className="space-y-2 text-xs">
              {[
                { key: 'resetAndRestart' as const, label: 'Reset & Restart' },
                { key: 'resetAndPause' as const, label: 'Reset & Pause' },
                { key: 'togglePause' as const, label: 'Start / Pause' }
              ].map(({ key, label }) => {
                const isRecording = recordingKey === key;
                return (
                  <div
                    key={key}
                    className="flex justify-between items-center bg-zinc-800/60 p-2 rounded border border-zinc-700/60"
                  >
                    <span className="font-medium text-zinc-300">{label}</span>
                    <button
                      onClick={() => setRecordingKey(isRecording ? null : key)}
                      className={`px-2 py-1 font-mono text-[11px] rounded transition border ${
                        isRecording
                          ? 'bg-blue-600 text-white border-blue-400 animate-pulse'
                          : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white border-zinc-600'
                      }`}
                    >
                      {isRecording ? 'Press keys...' : formatHotkeyLabel(hotkeys[key])}
                    </button>
                  </div>
                );
              })}
            </div>
            <p className="text-[11px] text-zinc-500">
              Shortcuts trigger globally even when the window is in the background.
            </p>
          </section>

          <hr className="border-zinc-800" />

          {/* Sound Selector Section */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
              <Volume2 size={14} /> Completion Audio Alert
            </h3>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <label className="block text-zinc-400 mb-1 text-[11px]">Sound Tone</label>
                <select
                  value={soundTone}
                  onChange={(e) => onUpdateSoundTone(e.target.value as SoundTone)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-zinc-200 text-xs focus:outline-none focus:border-blue-500"
                >
                  <option value="bell">Bell (D5 → A5)</option>
                  <option value="chime">Chime (C5 → E5 → G5)</option>
                  <option value="sine">Sine Tone</option>
                  <option value="none">Mute (No Sound)</option>
                </select>
              </div>

              <div>
                <div className="flex justify-between text-zinc-400 mb-1 text-[11px]">
                  <label>Volume</label>
                  <span>{Math.round(soundVolume * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={soundVolume}
                  onChange={(e) => onUpdateSoundVolume(parseFloat(e.target.value))}
                  disabled={soundTone === 'none'}
                  className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-blue-500 disabled:opacity-40"
                />
              </div>
            </div>

            <button
              onClick={() => playAlertSound(soundVolume, soundTone)}
              disabled={soundTone === 'none'}
              className="px-2.5 py-1 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded border border-zinc-700 flex items-center gap-1.5 transition disabled:opacity-40"
            >
              <Volume2 size={12} /> Play Test Alert
            </button>
          </section>

          <hr className="border-zinc-800" />

          {/* Server Config Section */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
              <Globe size={14} /> Live Sync Server
            </h3>

            <div>
              <label className="block text-zinc-400 mb-1 text-[11px]">WebSocket URL</label>
              <input
                type="text"
                value={serverUrl}
                onChange={(e) => onUpdateServerUrl(e.target.value)}
                placeholder="ws://localhost:8080"
                className="w-full bg-zinc-800 border border-zinc-700 rounded px-2.5 py-1.5 text-xs font-mono text-zinc-200 focus:outline-none focus:border-blue-500"
              />
              <p className="text-[11px] text-zinc-500 mt-1">
                Used to host broadcast countdown sessions for remote viewers.
              </p>
            </div>

            {webViewerBaseUrl !== undefined && onUpdateWebViewerBaseUrl && (
              <div>
                <label className="block text-zinc-400 mb-1 text-[11px]">Web Viewer Base URL</label>
                <input
                  type="text"
                  value={webViewerBaseUrl}
                  onChange={(e) => onUpdateWebViewerBaseUrl(e.target.value)}
                  placeholder="http://localhost:5173"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded px-2.5 py-1.5 text-xs font-mono text-zinc-200 focus:outline-none focus:border-blue-500"
                />
                <p className="text-[11px] text-zinc-500 mt-1">
                  Base URL for generated viewer links (e.g. http://192.168.1.100:5173).
                </p>
              </div>
            )}
          </section>
        </div>

        <div className="mt-5 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-medium transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
