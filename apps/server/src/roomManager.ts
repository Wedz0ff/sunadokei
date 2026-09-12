import { customAlphabet } from 'nanoid';
import type { TimerSnapshot } from '@brachio/shared';
import type { WebSocket } from 'ws';

const nanoid = customAlphabet('23456789ABCDEFGHJKLMNPQRSTUVWXYZ', 6);
const tokenGen = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 24);

export interface Room {
  roomCode: string;
  hostToken: string;
  hostSocket: WebSocket | null;
  state: TimerSnapshot;
  viewers: Set<WebSocket>;
}

export class RoomManager {
  private rooms = new Map<string, Room>();

  createRoom(hostSocket: WebSocket, durationMs: number, inputString: string): { roomCode: string; hostToken: string } {
    const roomCode = nanoid();
    const hostToken = tokenGen();

    const room: Room = {
      roomCode,
      hostToken,
      hostSocket,
      state: {
        status: 'idle',
        inputString,
        durationMs,
        remainingMs: durationMs,
        targetEndTime: null,
        serverTime: Date.now()
      },
      viewers: new Set()
    };

    this.rooms.set(roomCode, room);
    return { roomCode, hostToken };
  }

  getRoom(roomCode: string): Room | undefined {
    return this.rooms.get(roomCode.toUpperCase());
  }

  updateState(roomCode: string, hostToken: string, update: Partial<TimerSnapshot>): boolean {
    const room = this.rooms.get(roomCode.toUpperCase());
    if (!room || room.hostToken !== hostToken) return false;

    room.state = {
      ...room.state,
      ...update,
      serverTime: Date.now()
    };

    this.broadcastToViewers(roomCode, {
      type: 'STATE_CHANGED',
      ...room.state
    });

    if (update.status === 'finished') {
      this.broadcastToViewers(roomCode, {
        type: 'TIMER_FINISHED'
      });
    }

    return true;
  }

  addViewer(roomCode: string, socket: WebSocket): boolean {
    const room = this.rooms.get(roomCode.toUpperCase());
    if (!room) return false;

    room.viewers.add(socket);
    this.notifyHostViewerCount(room);
    return true;
  }

  removeViewer(roomCode: string, socket: WebSocket): void {
    const room = this.rooms.get(roomCode.toUpperCase());
    if (!room) return;
    room.viewers.delete(socket);
    this.notifyHostViewerCount(room);
  }

  deleteRoom(roomCode: string, hostToken: string): boolean {
    const room = this.rooms.get(roomCode.toUpperCase());
    if (!room || room.hostToken !== hostToken) return false;

    this.broadcastToViewers(roomCode, {
      type: 'HOST_STATUS',
      online: false
    });
    this.rooms.delete(roomCode.toUpperCase());
    return true;
  }

  broadcastToViewers(roomCode: string, message: any): void {
    const room = this.rooms.get(roomCode.toUpperCase());
    if (!room) return;
    const data = JSON.stringify(message);
    for (const viewer of room.viewers) {
      if (viewer.readyState === 1) { // OPEN
        viewer.send(data);
      }
    }
  }

  private notifyHostViewerCount(room: Room): void {
    if (room.hostSocket && room.hostSocket.readyState === 1) {
      room.hostSocket.send(JSON.stringify({
        type: 'VIEWER_COUNT',
        count: room.viewers.size
      }));
    }
  }
}
