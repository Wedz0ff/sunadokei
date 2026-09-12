import { useState, useEffect, useRef, useCallback } from 'react';
import { TimerStatus, parseTimeString } from '@brachio/shared';
import { playAlertSound, SoundTone } from '../utils/audio';

export interface UseTimerEngineOptions {
  onFinish?: () => void;
  soundEnabled?: boolean;
  soundTone?: SoundTone;
  soundVolume?: number;
}

export function useTimerEngine(
  initialInput = '1min40s',
  options?: UseTimerEngineOptions
) {
  const [inputString, setInputStringState] = useState(initialInput);
  const [durationMs, setDurationMs] = useState(() => {
    const res = parseTimeString(initialInput);
    return res.valid ? res.durationMs : 100000;
  });
  const [remainingMs, setRemainingMs] = useState(durationMs);
  const [status, setStatus] = useState<TimerStatus>('idle');
  const [targetEndTime, setTargetEndTime] = useState<number | null>(null);

  const onFinishRef = useRef(options?.onFinish);
  useEffect(() => {
    onFinishRef.current = options?.onFinish;
  }, [options?.onFinish]);

  const soundToneRef = useRef(options?.soundTone ?? 'bell');
  useEffect(() => {
    soundToneRef.current = options?.soundTone ?? 'bell';
  }, [options?.soundTone]);

  const soundVolumeRef = useRef(options?.soundVolume ?? 0.8);
  useEffect(() => {
    soundVolumeRef.current = options?.soundVolume ?? 0.8;
  }, [options?.soundVolume]);

  const soundEnabledRef = useRef(options?.soundEnabled ?? true);
  useEffect(() => {
    soundEnabledRef.current = options?.soundEnabled ?? true;
  }, [options?.soundEnabled]);

  const setInputString = useCallback(
    (newInput: string) => {
      setInputStringState(newInput);
      if (status === 'idle') {
        const parsed = parseTimeString(newInput);
        if (parsed.valid) {
          setDurationMs(parsed.durationMs);
          setRemainingMs(parsed.durationMs);
        }
      }
    },
    [status]
  );

  const start = useCallback(() => {
    const msToRun = remainingMs > 0 && status !== 'finished' ? remainingMs : durationMs;
    setRemainingMs(msToRun);
    const end = Date.now() + msToRun;
    setTargetEndTime(end);
    setStatus('running');
  }, [remainingMs, durationMs, status]);

  const pause = useCallback(() => {
    if (status !== 'running') return;
    setStatus('paused');
    setTargetEndTime(null);
  }, [status]);

  const resetAndRestart = useCallback(() => {
    const parsed = parseTimeString(inputString);
    const dur = parsed.valid ? parsed.durationMs : durationMs;
    setDurationMs(dur);
    setRemainingMs(dur);
    setTargetEndTime(Date.now() + dur);
    setStatus('running');
  }, [inputString, durationMs]);

  const resetAndPause = useCallback(() => {
    const parsed = parseTimeString(inputString);
    const dur = parsed.valid ? parsed.durationMs : durationMs;
    setDurationMs(dur);
    setRemainingMs(dur);
    setTargetEndTime(null);
    setStatus('idle');
  }, [inputString, durationMs]);

  const togglePause = useCallback(() => {
    if (status === 'running') {
      pause();
    } else {
      start();
    }
  }, [status, pause, start]);

  // Main high-precision animation loop
  useEffect(() => {
    if (status !== 'running' || !targetEndTime) return;

    let frameId: number;
    const tick = () => {
      const diff = Math.max(0, targetEndTime - Date.now());
      setRemainingMs(diff);
      if (diff <= 0) {
        setStatus('finished');
        setTargetEndTime(null);
        if (soundEnabledRef.current) {
          playAlertSound(soundVolumeRef.current, soundToneRef.current);
        }
        onFinishRef.current?.();
      } else {
        frameId = requestAnimationFrame(tick);
      }
    };

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [status, targetEndTime]);

  return {
    inputString,
    setInputString,
    durationMs,
    remainingMs,
    status,
    targetEndTime,
    start,
    pause,
    resetAndRestart,
    resetAndPause,
    togglePause
  };
}
