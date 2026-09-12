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

  const openSession = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
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
      setIsLive(false);
      setRoomCode(null);
      setHostToken(null);
      setViewerCount(0);
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
      wsRef.current.close();
      wsRef.current = null;
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

  // Broadcast state changes whenever timer state changes
  useEffect(() => {
    if (!isLive || !hostToken || !wsRef.current || wsRef.current.readyState !== 1) return;

    wsRef.current.send(
      JSON.stringify({
        type: 'HOST_UPDATE_STATE',
        hostToken,
        status: currentTimer.status,
        durationMs: currentTimer.durationMs,
        remainingMs: currentTimer.remainingMs,
        targetEndTime: currentTimer.targetEndTime
      })
    );
  }, [
    currentTimer.status,
    currentTimer.durationMs,
    currentTimer.remainingMs,
    currentTimer.targetEndTime,
    isLive,
    hostToken
  ]);

  return {
    isLive,
    roomCode,
    viewerCount,
    openSession,
    closeSession
  };
}
