import { TimerStatus, TimerSnapshot } from './types.js';

export type HostMessage =
  | { type: 'HOST_CREATE_ROOM'; durationMs: number; inputString: string }
  | { type: 'HOST_UPDATE_STATE'; hostToken: string; status: TimerStatus; durationMs: number; remainingMs: number; targetEndTime: number | null }
  | { type: 'HOST_CLOSE_ROOM'; hostToken: string };

export type HostResponse =
  | { type: 'ROOM_CREATED'; roomCode: string; hostToken: string; shareUrl: string }
  | { type: 'VIEWER_COUNT'; count: number }
  | { type: 'ERROR'; message: string };

export type ViewerMessage =
  | { type: 'VIEWER_JOIN'; roomCode: string }
  | { type: 'SYNC_PING'; clientSendTime: number };

export type ViewerResponse =
  | { type: 'SYNC_PONG'; clientSendTime: number; serverTime: number }
  | { type: 'ROOM_SNAPSHOT'; snapshot: TimerSnapshot; viewerCount: number }
  | { type: 'STATE_CHANGED'; status: TimerStatus; durationMs: number; remainingMs: number; targetEndTime: number | null; serverTime: number }
  | { type: 'TIMER_FINISHED' }
  | { type: 'HOST_STATUS'; online: boolean }
  | { type: 'ERROR'; message: string };
