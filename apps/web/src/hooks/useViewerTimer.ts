import { useState, useEffect, useRef } from 'react';
import { TimerSnapshot, formatDuration } from '@brachio/shared';

export interface UseViewerTimerResult {
  snapshot: TimerSnapshot | null;
  displayRemainingMs: number;
  progressPercent: number;
  formattedTime: string;
  viewerCount: number;
  hostOnline: boolean;
  isConnected: boolean;
  error: string | null;
}

function getDefaultWsUrl(): string {
  if (typeof window === 'undefined') return 'wss://sunadokei.wed.tf';
  const hostname = window.location.hostname;
  if (!hostname || hostname === 'localhost' || hostname === '127.0.0.1') {
    return `ws://${hostname || 'localhost'}:8080`;
  }
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}`;
}

export function useViewerTimer(
  roomCode: string,
  wsUrl = getDefaultWsUrl()
): UseViewerTimerResult {
  const [snapshot, setSnapshot] = useState<TimerSnapshot | null>(null);
  const [viewerCount, setViewerCount] = useState<number>(1);
  const [hostOnline, setHostOnline] = useState<boolean>(true);
  const [clockOffset, setClockOffset] = useState<number>(0);
  const [displayRemainingMs, setDisplayRemainingMs] = useState<number>(0);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!roomCode) {
      setIsConnected(false);
      setSnapshot(null);
      setError(null);
      return;
    }

    let isCancelled = false;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      if (isCancelled) return;
      setIsConnected(true);
      setError(null);
      ws.send(JSON.stringify({ type: 'VIEWER_JOIN', roomCode }));
      // Ping for clock offset
      ws.send(JSON.stringify({ type: 'SYNC_PING', clientSendTime: Date.now() }));
    };

    ws.onmessage = (event) => {
      if (isCancelled) return;
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'SYNC_PONG') {
          const now = Date.now();
          const rtt = now - data.clientSendTime;
          const estimatedServerTime = data.serverTime + rtt / 2;
          setClockOffset(estimatedServerTime - now);
        } else if (data.type === 'ROOM_SNAPSHOT') {
          setSnapshot(data.snapshot);
          setDisplayRemainingMs(data.snapshot.remainingMs);
          setViewerCount(data.viewerCount);
          setError(null);
        } else if (data.type === 'STATE_CHANGED') {
          setSnapshot((prev) => {
            if (!prev) return data;
            return {
              ...prev,
              status: data.status,
              durationMs: data.durationMs,
              remainingMs: data.remainingMs,
              targetEndTime: data.targetEndTime,
              serverTime: data.serverTime
            };
          });
          if (data.status !== 'running') {
            setDisplayRemainingMs(data.remainingMs);
          }
        } else if (data.type === 'TIMER_FINISHED') {
          setSnapshot((prev) =>
            prev ? { ...prev, status: 'finished', remainingMs: 0, targetEndTime: null } : null
          );
          setDisplayRemainingMs(0);
        } else if (data.type === 'HOST_STATUS') {
          setHostOnline(data.online);
        } else if (data.type === 'ERROR') {
          setError(data.message);
        }
      } catch (err) {
        console.error('Failed to parse WebSocket message:', err);
      }
    };

    ws.onerror = () => {
      if (isCancelled) return;
      setError('WebSocket connection error');
    };

    ws.onclose = () => {
      if (isCancelled) return;
      setIsConnected(false);
    };

    return () => {
      isCancelled = true;
      ws.close();
      wsRef.current = null;
    };
  }, [roomCode, wsUrl]);

  // High precision animation loop for running timer
  useEffect(() => {
    if (!snapshot || snapshot.status !== 'running' || !snapshot.targetEndTime) return;

    let frameId: number;
    const tick = () => {
      const nowSynced = Date.now() + clockOffset;
      const rem = Math.max(0, snapshot.targetEndTime! - nowSynced);
      setDisplayRemainingMs(rem);
      if (rem > 0) {
        frameId = requestAnimationFrame(tick);
      }
    };

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [snapshot?.status, snapshot?.targetEndTime, clockOffset]);

  const progressPercent =
    snapshot && snapshot.durationMs > 0
      ? Math.min(100, Math.max(0, (displayRemainingMs / snapshot.durationMs) * 100))
      : 0;

  return {
    snapshot,
    displayRemainingMs,
    progressPercent,
    formattedTime: formatDuration(displayRemainingMs),
    viewerCount,
    hostOnline,
    isConnected,
    error
  };
}
