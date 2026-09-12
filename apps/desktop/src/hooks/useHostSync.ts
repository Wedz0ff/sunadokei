import { useState, useEffect, useRef, useCallback } from 'react';
import { TimerStatus } from '@brachio/shared';

export interface CurrentTimerState {
  status: TimerStatus;
  durationMs: number;
  remainingMs: number;
  targetEndTime: number | null;
  inputString: string;
}

export function useHostSync(
  serverUrl = 'ws://localhost:8080',
  currentTimer: CurrentTimerState
) {
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [hostToken, setHostToken] = useState<string | null>(null);
  const [viewerCount, setViewerCount] = useState<number>(0);
  const [isLive, setIsLive] = useState<boolean>(false);

  const wsRef = useRef<WebSocket | null>(null);
  const currentTimerRef = useRef(currentTimer);

  useEffect(() => {
    currentTimerRef.current = currentTimer;
  }, [currentTimer]);

  const sendStateUpdate = useCallback(() => {
    if (!isLive || !hostToken || !wsRef.current || wsRef.current.readyState !== 1) return;

    wsRef.current.send(
      JSON.stringify({
        type: 'HOST_UPDATE_STATE',
        hostToken,
        status: currentTimerRef.current.status,
        durationMs: currentTimerRef.current.durationMs,
        remainingMs: currentTimerRef.current.remainingMs,
        targetEndTime: currentTimerRef.current.targetEndTime
      })
    );
  }, [isLive, hostToken]);

  const openSession = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    const ws = new WebSocket(serverUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(
        JSON.stringify({
          type: 'HOST_CREATE_ROOM',
          durationMs: currentTimerRef.current.durationMs,
          inputString: currentTimerRef.current.inputString
        })
      );
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'ROOM_CREATED') {
          setRoomCode(data.roomCode);
          setHostToken(data.hostToken);
          setIsLive(true);
        } else if (data.type === 'VIEWER_COUNT') {
          setViewerCount(data.count);
        }
      } catch (err) {
        console.error('Failed to parse WebSocket message:', err);
      }
    };

    ws.onclose = () => {
      if (wsRef.current === ws) {
        setIsLive(false);
        setRoomCode(null);
        setHostToken(null);
        setViewerCount(0);
        wsRef.current = null;
      }
    };

    ws.onerror = () => {
      // Errors will typically trigger onclose
    };
  }, [serverUrl]);

  const closeSession = useCallback(() => {
    if (wsRef.current) {
      if (wsRef.current.readyState === 1 && hostToken) {
        try {
          wsRef.current.send(
            JSON.stringify({
              type: 'HOST_CLOSE_ROOM',
              hostToken
            })
          );
        } catch {}
      }
      const activeWs = wsRef.current;
      wsRef.current = null;
      activeWs.close();
    }
    setIsLive(false);
    setRoomCode(null);
    setHostToken(null);
    setViewerCount(0);
  }, [hostToken]);

  // Clean up WebSocket connection when unmounting
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, []);

  // Broadcast state changes on discrete timer transitions (decoupled from high-frequency rAF remainingMs)
  useEffect(() => {
    sendStateUpdate();
  }, [
    currentTimer.status,
    currentTimer.durationMs,
    currentTimer.targetEndTime,
    sendStateUpdate
  ]);

  // Periodic drift keep-alive heartbeat while running (every 2 seconds)
  useEffect(() => {
    if (!isLive || currentTimer.status !== 'running') return;

    const interval = setInterval(() => {
      sendStateUpdate();
    }, 2000);

    return () => clearInterval(interval);
  }, [isLive, currentTimer.status, sendStateUpdate]);

  return {
    isLive,
    roomCode,
    viewerCount,
    openSession,
    closeSession
  };
}
