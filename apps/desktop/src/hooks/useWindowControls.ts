import { useState, useEffect, useCallback, useRef } from 'react';
import { isTauri } from '@tauri-apps/api/core';

export function useWindowControls() {
  const [alwaysOnTop, setAlwaysOnTopState] = useState<boolean>(() => {
    return localStorage.getItem('brachio_always_on_top') === 'true';
  });

  const [decorations, setDecorationsState] = useState<boolean>(() => {
    const val = localStorage.getItem('brachio_decorations');
    return val === null ? true : val === 'true';
  });

  const [compact, setCompactState] = useState<boolean>(() => {
    return localStorage.getItem('brachio_compact') === 'true';
  });

  const [clickThrough, setClickThroughState] = useState<boolean>(false);
  const prevAlwaysOnTopRef = useRef<boolean>(alwaysOnTop);

  // Apply alwaysOnTop to native window
  useEffect(() => {
    if (!isTauri()) return;
    import('@tauri-apps/api/window')
      .then(({ getCurrentWindow }) => {
        const win = getCurrentWindow();
        win.setAlwaysOnTop(alwaysOnTop || clickThrough).catch((err) => {
          console.warn('Failed to set always on top:', err);
        });
      })
      .catch(() => {});
  }, [alwaysOnTop, clickThrough]);

  // Apply decorations (titlebar) to native window
  useEffect(() => {
    if (!isTauri()) return;
    import('@tauri-apps/api/window')
      .then(({ getCurrentWindow }) => {
        const win = getCurrentWindow();
        win.setDecorations(decorations).catch((err) => {
          console.warn('Failed to set decorations:', err);
        });
      })
      .catch(() => {});
  }, [decorations]);

  // Apply ignoreCursorEvents (click-through) to native window
  useEffect(() => {
    if (!isTauri()) return;
    import('@tauri-apps/api/window')
      .then(({ getCurrentWindow }) => {
        const win = getCurrentWindow();
        win.setIgnoreCursorEvents(clickThrough).catch((err) => {
          console.warn('Failed to set ignore cursor events:', err);
        });
      })
      .catch(() => {});
  }, [clickThrough]);

  // Apply window sizing for compact mode
  useEffect(() => {
    if (!isTauri()) return;
    import('@tauri-apps/api/window')
      .then(({ getCurrentWindow, LogicalSize }) => {
        const win = getCurrentWindow();
        const size = compact ? new LogicalSize(240, 95) : new LogicalSize(420, 280);
        win.setSize(size).catch((err) => {
          console.warn('Failed to set window size:', err);
        });
      })
      .catch(() => {});
  }, [compact]);

  const setAlwaysOnTop = useCallback((val: boolean) => {
    setAlwaysOnTopState(val);
    localStorage.setItem('brachio_always_on_top', String(val));
  }, []);

  const toggleAlwaysOnTop = useCallback(() => {
    setAlwaysOnTopState((prev) => {
      const next = !prev;
      localStorage.setItem('brachio_always_on_top', String(next));
      return next;
    });
  }, []);

  const setDecorations = useCallback((val: boolean) => {
    setDecorationsState(val);
    localStorage.setItem('brachio_decorations', String(val));
  }, []);

  const toggleDecorations = useCallback(() => {
    setDecorationsState((prev) => {
      const next = !prev;
      localStorage.setItem('brachio_decorations', String(next));
      return next;
    });
  }, []);

  const setCompact = useCallback((val: boolean) => {
    setCompactState(val);
    localStorage.setItem('brachio_compact', String(val));
  }, []);

  const toggleCompact = useCallback(() => {
    setCompactState((prev) => {
      const next = !prev;
      localStorage.setItem('brachio_compact', String(next));
      return next;
    });
  }, []);

  const toggleClickThrough = useCallback(() => {
    setClickThroughState((prev) => {
      const next = !prev;
      if (next) {
        // Turning ON click-through: remember previous alwaysOnTop and force alwaysOnTop
        prevAlwaysOnTopRef.current = alwaysOnTop;
        setAlwaysOnTopState(true);
      } else {
        // Turning OFF click-through: restore previous alwaysOnTop
        setAlwaysOnTopState(prevAlwaysOnTopRef.current);
      }
      return next;
    });
  }, [alwaysOnTop]);

  return {
    alwaysOnTop,
    decorations,
    compact,
    clickThrough,
    setAlwaysOnTop,
    toggleAlwaysOnTop,
    setDecorations,
    toggleDecorations,
    setCompact,
    toggleCompact,
    toggleClickThrough
  };
}
