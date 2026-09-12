import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { parseTimeString } from '@brachio/shared';
import { useTimerEngine } from '../src/hooks/useTimerEngine';
import * as audioModule from '../src/utils/audio';

vi.mock('../src/utils/audio', () => ({
  playAlertSound: vi.fn()
}));

describe('Timer Engine Logic', () => {
  it('correctly sets initial target duration', () => {
    const res = parseTimeString('1min40s');
    expect(res.durationMs).toBe(100000);
  });
});

describe('useTimerEngine hook', () => {
  let rafCallbacks: Map<number, FrameRequestCallback>;
  let nextRafId: number;

  beforeEach(() => {
    vi.clearAllMocks();
    rafCallbacks = new Map();
    nextRafId = 0;

    vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => {
      const id = ++nextRafId;
      rafCallbacks.set(id, cb);
      return id;
    });

    vi.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation((id: number) => {
      rafCallbacks.delete(id);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const stepFrame = (time: number) => {
    const entries = Array.from(rafCallbacks.entries());
    rafCallbacks.clear();
    for (const [, cb] of entries) {
      cb(time);
    }
  };

  it('initializes with default duration (1min40s = 100000ms) and idle status', () => {
    const { result } = renderHook(() => useTimerEngine());

    expect(result.current.inputString).toBe('1min40s');
    expect(result.current.durationMs).toBe(100000);
    expect(result.current.remainingMs).toBe(100000);
    expect(result.current.status).toBe('idle');
    expect(result.current.targetEndTime).toBeNull();
  });

  it('initializes with custom time input', () => {
    const { result } = renderHook(() => useTimerEngine('45s'));

    expect(result.current.inputString).toBe('45s');
    expect(result.current.durationMs).toBe(45000);
    expect(result.current.remainingMs).toBe(45000);
  });

  it('starts the timer from idle', () => {
    const { result } = renderHook(() => useTimerEngine('10s'));

    const now = 1000000;
    vi.spyOn(Date, 'now').mockReturnValue(now);

    act(() => {
      result.current.start();
    });

    expect(result.current.status).toBe('running');
    expect(result.current.targetEndTime).toBe(now + 10000);
    expect(result.current.remainingMs).toBe(10000);
  });

  it('pauses a running timer and preserves remainingMs', () => {
    const { result } = renderHook(() => useTimerEngine('10s'));

    let currentTime = 1000000;
    vi.spyOn(Date, 'now').mockImplementation(() => currentTime);

    act(() => {
      result.current.start();
    });

    // Advance 3 seconds
    currentTime += 3000;
    act(() => {
      stepFrame(currentTime);
    });

    expect(result.current.remainingMs).toBe(7000);

    act(() => {
      result.current.pause();
    });

    expect(result.current.status).toBe('paused');
    expect(result.current.targetEndTime).toBeNull();
    expect(result.current.remainingMs).toBe(7000);
  });

  it('toggles pause and resume', () => {
    const { result } = renderHook(() => useTimerEngine('10s'));

    let currentTime = 1000000;
    vi.spyOn(Date, 'now').mockImplementation(() => currentTime);

    // From idle -> running
    act(() => {
      result.current.togglePause();
    });
    expect(result.current.status).toBe('running');

    // From running -> paused
    act(() => {
      result.current.togglePause();
    });
    expect(result.current.status).toBe('paused');

    // From paused -> running
    act(() => {
      result.current.togglePause();
    });
    expect(result.current.status).toBe('running');
  });

  it('resets and restarts the timer', () => {
    const { result } = renderHook(() => useTimerEngine('10s'));

    let currentTime = 1000000;
    vi.spyOn(Date, 'now').mockImplementation(() => currentTime);

    act(() => {
      result.current.start();
    });

    currentTime += 4000;
    act(() => {
      stepFrame(currentTime);
    });

    expect(result.current.remainingMs).toBe(6000);

    // Call resetAndRestart
    act(() => {
      result.current.resetAndRestart();
    });

    expect(result.current.status).toBe('running');
    expect(result.current.remainingMs).toBe(10000);
    expect(result.current.targetEndTime).toBe(currentTime + 10000);
  });

  it('resets and pauses the timer', () => {
    const { result } = renderHook(() => useTimerEngine('10s'));

    let currentTime = 1000000;
    vi.spyOn(Date, 'now').mockImplementation(() => currentTime);

    act(() => {
      result.current.start();
    });

    currentTime += 4000;
    act(() => {
      stepFrame(currentTime);
    });

    act(() => {
      result.current.resetAndPause();
    });

    expect(result.current.status).toBe('idle');
    expect(result.current.remainingMs).toBe(10000);
    expect(result.current.targetEndTime).toBeNull();
  });

  it('counts down to 0, transitions to finished, plays alert sound, and invokes onFinish', () => {
    const onFinish = vi.fn();
    const { result } = renderHook(() =>
      useTimerEngine('5s', { onFinish, soundEnabled: true, soundTone: 'bell' })
    );

    let currentTime = 1000000;
    vi.spyOn(Date, 'now').mockImplementation(() => currentTime);

    act(() => {
      result.current.start();
    });

    // Advance 5 seconds (to completion)
    currentTime += 5000;
    act(() => {
      stepFrame(currentTime);
    });

    expect(result.current.status).toBe('finished');
    expect(result.current.remainingMs).toBe(0);
    expect(result.current.targetEndTime).toBeNull();
    expect(audioModule.playAlertSound).toHaveBeenCalledWith(0.8, 'bell');
    expect(onFinish).toHaveBeenCalledTimes(1);
  });

  it('starts again after finishing and runs for full duration', () => {
    const { result } = renderHook(() => useTimerEngine('5s'));

    let currentTime = 1000000;
    vi.spyOn(Date, 'now').mockImplementation(() => currentTime);

    act(() => {
      result.current.start();
    });

    currentTime += 5000;
    act(() => {
      stepFrame(currentTime);
    });

    expect(result.current.status).toBe('finished');
    expect(result.current.remainingMs).toBe(0);

    // Start again
    currentTime += 1000;
    act(() => {
      result.current.start();
    });

    expect(result.current.status).toBe('running');
    expect(result.current.remainingMs).toBe(5000);
    expect(result.current.targetEndTime).toBe(currentTime + 5000);
  });

  it('updates duration and remaining time when user updates input string while idle', () => {
    const { result } = renderHook(() => useTimerEngine('1min'));

    expect(result.current.durationMs).toBe(60000);
    expect(result.current.remainingMs).toBe(60000);

    act(() => {
      result.current.setInputString('2min30s');
    });

    expect(result.current.inputString).toBe('2min30s');
    expect(result.current.durationMs).toBe(150000);
    expect(result.current.remainingMs).toBe(150000);
  });
});
