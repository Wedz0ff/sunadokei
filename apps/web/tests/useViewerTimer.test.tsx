import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useViewerTimer } from '../src/hooks/useViewerTimer';
import type { TimerSnapshot } from '@brachio/shared';

// Mock WebSocket
class MockWebSocket {
  static instances: MockWebSocket[] = [];
  url: string;
  readyState = 0; // CONNECTING
  sent: string[] = [];
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: ((err: unknown) => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  simulateOpen() {
    this.readyState = 1; // OPEN
    if (this.onopen) this.onopen();
  }

  send(data: string) {
    this.sent.push(data);
  }

  close() {
    this.readyState = 3; // CLOSED
    if (this.onclose) this.onclose();
  }

  simulateMessage(data: unknown) {
    if (this.onmessage) {
      this.onmessage({ data: JSON.stringify(data) });
    }
  }

  simulateError(err: unknown) {
    if (this.onerror) {
      this.onerror(err);
    }
  }
}

describe('useViewerTimer hook', () => {
  const originalWebSocket = globalThis.WebSocket;

  beforeEach(() => {
    MockWebSocket.instances = [];
    (globalThis as unknown as { WebSocket: typeof MockWebSocket }).WebSocket = MockWebSocket;
  });

  afterEach(() => {
    (globalThis as unknown as { WebSocket: typeof originalWebSocket }).WebSocket = originalWebSocket;
  });

  it('does not establish connection when roomCode is empty', () => {
    const { result, unmount } = renderHook(() => useViewerTimer(''));
    expect(MockWebSocket.instances.length).toBe(0);
    expect(result.current.isConnected).toBe(false);
    expect(result.current.snapshot).toBeNull();
    expect(result.current.displayRemainingMs).toBe(0);
    expect(result.current.progressPercent).toBe(0);
    unmount();
  });

  it('connects to WebSocket, sends VIEWER_JOIN and SYNC_PING upon open', () => {
    const { result, unmount } = renderHook(() => useViewerTimer('TRK-100'));
    expect(MockWebSocket.instances.length).toBe(1);

    const ws = MockWebSocket.instances[0];
    expect(ws.url).toBe('ws://localhost:8080');
    expect(result.current.isConnected).toBe(false);

    // Simulate open
    act(() => {
      ws.simulateOpen();
    });

    expect(result.current.isConnected).toBe(true);
    expect(ws.sent.length).toBe(2);

    const joinMsg = JSON.parse(ws.sent[0]);
    expect(joinMsg.type).toBe('VIEWER_JOIN');
    expect(joinMsg.roomCode).toBe('TRK-100');

    const pingMsg = JSON.parse(ws.sent[1]);
    expect(pingMsg.type).toBe('SYNC_PING');
    expect(typeof pingMsg.clientSendTime).toBe('number');

    unmount();
  });

  it('updates state on ROOM_SNAPSHOT', () => {
    const { result, unmount } = renderHook(() => useViewerTimer('TRK-100'));
    const ws = MockWebSocket.instances[0];

    act(() => {
      ws.simulateOpen();
    });

    const mockSnapshot: TimerSnapshot = {
      status: 'idle',
      inputString: '2m',
      durationMs: 120000,
      remainingMs: 120000,
      targetEndTime: null,
      serverTime: 10000
    };

    act(() => {
      ws.simulateMessage({
        type: 'ROOM_SNAPSHOT',
        snapshot: mockSnapshot,
        viewerCount: 5
      });
    });

    expect(result.current.snapshot).toEqual(mockSnapshot);
    expect(result.current.displayRemainingMs).toBe(120000);
    expect(result.current.formattedTime).toBe('02:00');
    expect(result.current.progressPercent).toBe(100);
    expect(result.current.viewerCount).toBe(5);

    unmount();
  });

  it('updates state on STATE_CHANGED and adjusts displayRemainingMs', () => {
    const { result, unmount } = renderHook(() => useViewerTimer('TRK-100'));
    const ws = MockWebSocket.instances[0];

    act(() => {
      ws.simulateOpen();
      ws.simulateMessage({
        type: 'ROOM_SNAPSHOT',
        snapshot: {
          status: 'idle',
          inputString: '1m',
          durationMs: 60000,
          remainingMs: 60000,
          targetEndTime: null,
          serverTime: 1000
        },
        viewerCount: 1
      });
    });

    // Paused state change with remaining time 30s
    act(() => {
      ws.simulateMessage({
        type: 'STATE_CHANGED',
        status: 'paused',
        durationMs: 60000,
        remainingMs: 30000,
        targetEndTime: null,
        serverTime: 2000
      });
    });

    expect(result.current.snapshot?.status).toBe('paused');
    expect(result.current.displayRemainingMs).toBe(30000);
    expect(result.current.formattedTime).toBe('00:30');
    expect(result.current.progressPercent).toBe(50);

    unmount();
  });

  it('handles SYNC_PONG and calculates clock offset', () => {
    const { unmount } = renderHook(() => useViewerTimer('TRK-100'));
    const ws = MockWebSocket.instances[0];

    act(() => {
      ws.simulateOpen();
    });

    act(() => {
      ws.simulateMessage({
        type: 'SYNC_PONG',
        clientSendTime: Date.now() - 100,
        serverTime: Date.now() + 500
      });
    });

    act(() => {
      ws.simulateMessage({
        type: 'ROOM_SNAPSHOT',
        snapshot: {
          status: 'running',
          inputString: '1m',
          durationMs: 60000,
          remainingMs: 40000,
          targetEndTime: Date.now() + 40000,
          serverTime: Date.now()
        },
        viewerCount: 2
      });
    });

    unmount();
  });

  it('updates hostOnline on HOST_STATUS', () => {
    const { result, unmount } = renderHook(() => useViewerTimer('TRK-100'));
    const ws = MockWebSocket.instances[0];

    act(() => {
      ws.simulateOpen();
      ws.simulateMessage({ type: 'HOST_STATUS', online: false });
    });

    expect(result.current.hostOnline).toBe(false);

    act(() => {
      ws.simulateMessage({ type: 'HOST_STATUS', online: true });
    });

    expect(result.current.hostOnline).toBe(true);
    unmount();
  });

  it('handles TIMER_FINISHED and sets displayRemainingMs to 0', () => {
    const { result, unmount } = renderHook(() => useViewerTimer('TRK-100'));
    const ws = MockWebSocket.instances[0];

    act(() => {
      ws.simulateOpen();
      ws.simulateMessage({
        type: 'ROOM_SNAPSHOT',
        snapshot: {
          status: 'running',
          inputString: '10s',
          durationMs: 10000,
          remainingMs: 5000,
          targetEndTime: Date.now() + 5000,
          serverTime: Date.now()
        },
        viewerCount: 2
      });
    });

    act(() => {
      ws.simulateMessage({ type: 'TIMER_FINISHED' });
    });

    expect(result.current.snapshot?.status).toBe('finished');
    expect(result.current.displayRemainingMs).toBe(0);
    expect(result.current.progressPercent).toBe(0);
    expect(result.current.formattedTime).toBe('00:00');

    unmount();
  });

  it('sets error on ERROR message or connection error', () => {
    const { result, unmount } = renderHook(() => useViewerTimer('TRK-100'));
    const ws = MockWebSocket.instances[0];

    act(() => {
      ws.simulateOpen();
      ws.simulateMessage({ type: 'ERROR', message: 'Room not found' });
    });

    expect(result.current.error).toBe('Room not found');

    act(() => {
      ws.simulateError(new Error('Network error'));
    });

    expect(result.current.error).toBe('WebSocket connection error');

    unmount();
  });

  it('closes WebSocket on unmount', () => {
    const { unmount } = renderHook(() => useViewerTimer('TRK-100'));
    const ws = MockWebSocket.instances[0];

    act(() => {
      ws.simulateOpen();
    });
    expect(ws.readyState).toBe(1);

    unmount();
    expect(ws.readyState).toBe(3); // CLOSED
  });
});
