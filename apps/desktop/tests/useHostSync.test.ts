import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useHostSync, CurrentTimerState } from '../src/hooks/useHostSync';

class MockWebSocket {
  static instances: MockWebSocket[] = [];
  url: string;
  readyState: number = 0; // 0 = CONNECTING, 1 = OPEN, 2 = CLOSING, 3 = CLOSED
  send = vi.fn();
  close = vi.fn(() => {
    this.readyState = 3;
    if (this.onclose) {
      this.onclose(new CloseEvent('close'));
    }
  });

  onopen: ((event: any) => void) | null = null;
  onmessage: ((event: any) => void) | null = null;
  onclose: ((event: any) => void) | null = null;
  onerror: ((event: any) => void) | null = null;

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  simulateOpen() {
    this.readyState = 1;
    if (this.onopen) {
      this.onopen(new Event('open'));
    }
  }

  simulateMessage(data: any) {
    if (this.onmessage) {
      this.onmessage(new MessageEvent('message', { data: JSON.stringify(data) }));
    }
  }

  simulateClose() {
    this.readyState = 3;
    if (this.onclose) {
      this.onclose(new CloseEvent('close'));
    }
  }
}

describe('useHostSync hook', () => {
  const defaultTimer: CurrentTimerState = {
    status: 'idle',
    durationMs: 100000,
    remainingMs: 100000,
    targetEndTime: null,
    inputString: '1min40s'
  };

  beforeEach(() => {
    vi.clearAllMocks();
    MockWebSocket.instances = [];
    vi.stubGlobal('WebSocket', MockWebSocket);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('initializes with default values', () => {
    const { result } = renderHook(() => useHostSync('ws://localhost:8080', defaultTimer));

    expect(result.current.isLive).toBe(false);
    expect(result.current.roomCode).toBeNull();
    expect(result.current.viewerCount).toBe(0);
    expect(typeof result.current.openSession).toBe('function');
    expect(typeof result.current.closeSession).toBe('function');
  });

  it('connects to server and creates room on openSession', () => {
    const { result } = renderHook(() => useHostSync('ws://test-server:9999', defaultTimer));

    act(() => {
      result.current.openSession();
    });

    expect(MockWebSocket.instances.length).toBe(1);
    const ws = MockWebSocket.instances[0];
    expect(ws.url).toBe('ws://test-server:9999');

    // Simulate connection opening
    act(() => {
      ws.simulateOpen();
    });

    expect(ws.send).toHaveBeenCalledTimes(1);
    expect(JSON.parse(ws.send.mock.calls[0][0])).toEqual({
      type: 'HOST_CREATE_ROOM',
      durationMs: 100000,
      inputString: '1min40s'
    });

    // Simulate server ROOM_CREATED response
    act(() => {
      ws.simulateMessage({
        type: 'ROOM_CREATED',
        roomCode: 'ABC123',
        hostToken: 'secret-token-xyz',
        shareUrl: '/join/ABC123'
      });
    });

    expect(result.current.isLive).toBe(true);
    expect(result.current.roomCode).toBe('ABC123');
  });

  it('updates viewerCount on VIEWER_COUNT message', () => {
    const { result } = renderHook(() => useHostSync('ws://localhost:8080', defaultTimer));

    act(() => {
      result.current.openSession();
    });
    const ws = MockWebSocket.instances[0];

    act(() => {
      ws.simulateOpen();
      ws.simulateMessage({
        type: 'ROOM_CREATED',
        roomCode: 'XYZ789',
        hostToken: 'token-abc',
        shareUrl: '/join/XYZ789'
      });
    });

    expect(result.current.viewerCount).toBe(0);

    act(() => {
      ws.simulateMessage({
        type: 'VIEWER_COUNT',
        count: 7
      });
    });

    expect(result.current.viewerCount).toBe(7);
  });

  it('broadcasts state changes to viewers via HOST_UPDATE_STATE when timer changes while live', () => {
    let timerState = { ...defaultTimer };
    const { result, rerender } = renderHook(
      ({ timer }) => useHostSync('ws://localhost:8080', timer),
      { initialProps: { timer: timerState } }
    );

    act(() => {
      result.current.openSession();
    });
    const ws = MockWebSocket.instances[0];

    act(() => {
      ws.simulateOpen();
      ws.simulateMessage({
        type: 'ROOM_CREATED',
        roomCode: 'ROOM1',
        hostToken: 'token-123',
        shareUrl: '/join/ROOM1'
      });
    });

    // Clear calls from room creation & initial sync
    ws.send.mockClear();

    // Timer starts running
    const now = Date.now();
    timerState = {
      ...timerState,
      status: 'running',
      targetEndTime: now + 100000,
      remainingMs: 100000
    };

    rerender({ timer: timerState });

    expect(ws.send).toHaveBeenCalledWith(
      JSON.stringify({
        type: 'HOST_UPDATE_STATE',
        hostToken: 'token-123',
        status: 'running',
        durationMs: 100000,
        remainingMs: 100000,
        targetEndTime: now + 100000
      })
    );
  });

  it('does not broadcast state updates when not live or when websocket is not open', () => {
    let timerState = { ...defaultTimer };
    const { rerender } = renderHook(
      ({ timer }) => useHostSync('ws://localhost:8080', timer),
      { initialProps: { timer: timerState } }
    );

    expect(MockWebSocket.instances.length).toBe(0);

    // Update timer while not live
    timerState = {
      ...timerState,
      status: 'running',
      targetEndTime: 123456789,
      remainingMs: 95000
    };

    rerender({ timer: timerState });

    // No WebSocket instances should have been created or sent to
    expect(MockWebSocket.instances.length).toBe(0);
  });

  it('resets state and closes connection on closeSession', () => {
    const { result } = renderHook(() => useHostSync('ws://localhost:8080', defaultTimer));

    act(() => {
      result.current.openSession();
    });
    const ws = MockWebSocket.instances[0];

    act(() => {
      ws.simulateOpen();
      ws.simulateMessage({
        type: 'ROOM_CREATED',
        roomCode: 'ROOM1',
        hostToken: 'token-123',
        shareUrl: '/join/ROOM1'
      });
      ws.simulateMessage({
        type: 'VIEWER_COUNT',
        count: 3
      });
    });

    expect(result.current.isLive).toBe(true);
    expect(result.current.roomCode).toBe('ROOM1');
    expect(result.current.viewerCount).toBe(3);

    act(() => {
      result.current.closeSession();
    });

    expect(ws.close).toHaveBeenCalled();
    expect(result.current.isLive).toBe(false);
    expect(result.current.roomCode).toBeNull();
    expect(result.current.viewerCount).toBe(0);
  });

  it('resets state when websocket closes from remote/server side', () => {
    const { result } = renderHook(() => useHostSync('ws://localhost:8080', defaultTimer));

    act(() => {
      result.current.openSession();
    });
    const ws = MockWebSocket.instances[0];

    act(() => {
      ws.simulateOpen();
      ws.simulateMessage({
        type: 'ROOM_CREATED',
        roomCode: 'ROOM1',
        hostToken: 'token-123',
        shareUrl: '/join/ROOM1'
      });
    });

    expect(result.current.isLive).toBe(true);

    act(() => {
      ws.simulateClose();
    });

    expect(result.current.isLive).toBe(false);
    expect(result.current.roomCode).toBeNull();
    expect(result.current.viewerCount).toBe(0);
  });

  it('does not re-broadcast when only remainingMs changes during running state', () => {
    let timerState = { ...defaultTimer };
    const { result, rerender } = renderHook(
      ({ timer }) => useHostSync('ws://localhost:8080', timer),
      { initialProps: { timer: timerState } }
    );

    act(() => {
      result.current.openSession();
    });
    const ws = MockWebSocket.instances[0];

    act(() => {
      ws.simulateOpen();
      ws.simulateMessage({
        type: 'ROOM_CREATED',
        roomCode: 'ROOM1',
        hostToken: 'token-123',
        shareUrl: '/join/ROOM1'
      });
    });

    const now = Date.now();
    timerState = {
      ...timerState,
      status: 'running',
      targetEndTime: now + 100000,
      remainingMs: 100000
    };

    rerender({ timer: timerState });
    expect(ws.send).toHaveBeenCalled();

    ws.send.mockClear();

    // High frequency rAF tick: only remainingMs changes
    timerState = {
      ...timerState,
      remainingMs: 99950
    };
    rerender({ timer: timerState });

    // Should NOT send WebSocket message on mere tick
    expect(ws.send).not.toHaveBeenCalled();
  });

  it('broadcasts heartbeat every 2 seconds while running', () => {
    vi.useFakeTimers();
    let timerState = { ...defaultTimer };
    const { result, rerender } = renderHook(
      ({ timer }) => useHostSync('ws://localhost:8080', timer),
      { initialProps: { timer: timerState } }
    );

    act(() => {
      result.current.openSession();
    });
    const ws = MockWebSocket.instances[0];

    act(() => {
      ws.simulateOpen();
      ws.simulateMessage({
        type: 'ROOM_CREATED',
        roomCode: 'ROOM1',
        hostToken: 'token-123',
        shareUrl: '/join/ROOM1'
      });
    });

    const now = Date.now();
    timerState = {
      ...timerState,
      status: 'running',
      targetEndTime: now + 100000,
      remainingMs: 100000
    };
    rerender({ timer: timerState });
    ws.send.mockClear();

    // Update latest remainingMs via tick
    timerState = {
      ...timerState,
      remainingMs: 98000
    };
    rerender({ timer: timerState });
    expect(ws.send).not.toHaveBeenCalled();

    // Advance 2 seconds
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(ws.send).toHaveBeenCalledTimes(1);
    expect(JSON.parse(ws.send.mock.calls[0][0])).toEqual({
      type: 'HOST_UPDATE_STATE',
      hostToken: 'token-123',
      status: 'running',
      durationMs: 100000,
      remainingMs: 98000,
      targetEndTime: now + 100000
    });

    vi.useRealTimers();
  });

  it('ignores socket close from an orphaned socket instance', () => {
    const { result } = renderHook(() => useHostSync('ws://localhost:8080', defaultTimer));

    act(() => {
      result.current.openSession();
    });
    const firstWs = MockWebSocket.instances[0];

    act(() => {
      firstWs.simulateOpen();
      firstWs.simulateMessage({
        type: 'ROOM_CREATED',
        roomCode: 'ROOM1',
        hostToken: 'token-123',
        shareUrl: '/join/ROOM1'
      });
    });

    expect(result.current.isLive).toBe(true);

    // Opening another session replaces wsRef.current with secondWs
    act(() => {
      result.current.openSession();
    });
    expect(MockWebSocket.instances.length).toBe(2);
    const secondWs = MockWebSocket.instances[1];

    act(() => {
      secondWs.simulateOpen();
      secondWs.simulateMessage({
        type: 'ROOM_CREATED',
        roomCode: 'ROOM2',
        hostToken: 'token-456',
        shareUrl: '/join/ROOM2'
      });
    });

    // Simulate close on the FIRST (orphaned) socket
    act(() => {
      firstWs.simulateClose();
    });

    // State should still be live with the second room, not reset by the first socket's close
    expect(result.current.isLive).toBe(true);
    expect(result.current.roomCode).toBe('ROOM2');
  });

  it('closes WebSocket on unmount', () => {
    const { result, unmount } = renderHook(() => useHostSync('ws://localhost:8080', defaultTimer));

    act(() => {
      result.current.openSession();
    });
    const ws = MockWebSocket.instances[0];

    unmount();

    expect(ws.close).toHaveBeenCalled();
  });
});
