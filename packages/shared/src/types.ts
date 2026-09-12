export type TimerStatus = 'idle' | 'running' | 'paused' | 'finished';

export interface TimerSnapshot {
  status: TimerStatus;
  inputString: string;
  durationMs: number;
  remainingMs: number;
  targetEndTime: number | null;
  serverTime: number;
}

export interface HotkeyConfig {
  resetAndRestart: string;
  resetAndPause: string;
  togglePause: string;
}

export interface AudioConfig {
  preset: 'digital' | 'bell' | 'chime' | 'custom';
  customFilePath: string | null;
  volume: number; // 0 - 100
  loop: boolean;
}
