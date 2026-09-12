import { useEffect, useRef } from 'react';
import { register, unregisterAll } from '@tauri-apps/plugin-global-shortcut';

export interface ShortcutActions {
  onResetAndRestart: () => void;
  onResetAndPause: () => void;
  onTogglePause: () => void;
}

export interface ShortcutMap {
  resetAndRestart: string;
  resetAndPause: string;
  togglePause: string;
}

function matchesBrowserEvent(e: KeyboardEvent, shortcut: string): boolean {
  if (!shortcut) return false;
  const parts = shortcut.split('+').map((p) => p.trim());
  let metaOrCtrlRequired = false;
  let shiftRequired = false;
  let altRequired = false;
  let targetKey = '';

  for (const part of parts) {
    const lower = part.toLowerCase();
    if (
      lower === 'commandorcontrol' ||
      lower === 'cmdorctrl' ||
      lower === 'cmdorcontrol' ||
      lower === 'ctrl' ||
      lower === 'meta'
    ) {
      metaOrCtrlRequired = true;
    } else if (lower === 'shift') {
      shiftRequired = true;
    } else if (lower === 'alt') {
      altRequired = true;
    } else {
      targetKey = lower;
    }
  }

  const isMetaOrCtrl = e.metaKey || e.ctrlKey;
  if (metaOrCtrlRequired !== isMetaOrCtrl) return false;
  if (shiftRequired !== e.shiftKey) return false;
  if (altRequired !== e.altKey) return false;

  const eventKey = e.key.toLowerCase();
  const eventCode = e.code.toLowerCase();

  if (targetKey === 'space') {
    return eventCode === 'space' || eventKey === ' ';
  }

  return eventKey === targetKey || eventCode === `key${targetKey}`;
}

export function useGlobalShortcuts(shortcuts: ShortcutMap, actions: ShortcutActions) {
  const actionsRef = useRef(actions);
  useEffect(() => {
    actionsRef.current = actions;
  }, [actions]);

  const shortcutsRef = useRef(shortcuts);
  useEffect(() => {
    shortcutsRef.current = shortcuts;
  }, [shortcuts]);

  useEffect(() => {
    let isTauri = true;

    async function bindShortcuts() {
      try {
        await unregisterAll();

        if (shortcuts.resetAndRestart) {
          await register(shortcuts.resetAndRestart, (event) => {
            if (event.state === 'Pressed') actionsRef.current.onResetAndRestart();
          });
        }

        if (shortcuts.resetAndPause) {
          await register(shortcuts.resetAndPause, (event) => {
            if (event.state === 'Pressed') actionsRef.current.onResetAndPause();
          });
        }

        if (shortcuts.togglePause) {
          await register(shortcuts.togglePause, (event) => {
            if (event.state === 'Pressed') actionsRef.current.onTogglePause();
          });
        }
      } catch (err) {
        isTauri = false;
        // Running in browser or tests where Tauri plugin is not available
      }
    }

    bindShortcuts();

    // Fallback for browser preview / development
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts if user is typing in an input or textarea
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return;
      }

      if (matchesBrowserEvent(e, shortcutsRef.current.resetAndRestart)) {
        e.preventDefault();
        actionsRef.current.onResetAndRestart();
      } else if (matchesBrowserEvent(e, shortcutsRef.current.resetAndPause)) {
        e.preventDefault();
        actionsRef.current.onResetAndPause();
      } else if (matchesBrowserEvent(e, shortcutsRef.current.togglePause)) {
        e.preventDefault();
        actionsRef.current.onTogglePause();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (isTauri) {
        unregisterAll().catch(() => {});
      }
    };
  }, [shortcuts.resetAndRestart, shortcuts.resetAndPause, shortcuts.togglePause]);
}
