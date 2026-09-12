# Hourglass-Style Synchronized Timer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an Hourglass-inspired countdown timer desktop application (Tauri v2 + React) with natural language time parsing (`1min40s`), native global hotkey reset while unfocused, audio alarms, and real-time remote session sharing over WebSockets to read-only browser viewers.

**Architecture:** Monorepo with a shared core (`packages/shared` for parsing and protocols), a Node.js WebSocket relay server (`apps/server`) for room management and state broadcasting, a web viewer app (`apps/web`), and a Tauri v2 desktop host application (`apps/desktop`) using native global shortcut OS hooks.

**Tech Stack:** 
- TypeScript, pnpm/npm workspaces
- Tauri v2 + Rust (`tauri-plugin-global-shortcut`)
- React 18 / 19, Vite, Tailwind CSS
- Node.js + `ws` (WebSocket)
- Vitest for unit/integration testing

**Spec:** [`docs/superpowers/specs/2026-09-12-hourglass-timer-design.md`](file:///Users/lucashames/dev/brachio-tracker/docs/superpowers/specs/2026-09-12-hourglass-timer-design.md)

## Global Constraints

- **Node.js**: >= 18.0.0
- **Rust toolchain**: 1.77+ with Cargo (for Tauri v2)
- **Time input format**: Support `1min40s`, `1m40s`, `90s`, `01:40`, `1.5m`
- **Tauri global shortcut**: Unfocused reset must work via OS level shortcuts
- **Viewer restrictions**: Remote viewers must be read-only (no control buttons)

---

### Task 1: Monorepo Scaffolding & Shared Workspace Setup

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`
- Create: `.gitignore`
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`

**Interfaces:**
- Consumes: None
- Produces: Root monorepo workspace linking `packages/*` and `apps/*`

- [ ] **Step 1: Write root `.gitignore`, `package.json`, `pnpm-workspace.yaml`, and `tsconfig.base.json`**

```json
// package.json
{
  "name": "brachio-tracker-monorepo",
  "private": true,
  "workspaces": [
    "packages/*",
    "apps/*"
  ],
  "scripts": {
    "build": "pnpm -r run build",
    "test": "pnpm -r run test",
    "dev:server": "pnpm --filter @brachio/server dev",
    "dev:web": "pnpm --filter @brachio/web dev",
    "dev:desktop": "pnpm --filter @brachio/desktop dev"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "vitest": "^1.6.0"
  }
}
```

```yaml
# pnpm-workspace.yaml
packages:
  - 'packages/*'
  - 'apps/*'
```

```json
// tsconfig.base.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

```gitignore
// .gitignore
node_modules/
dist/
build/
.DS_Store
target/
*.log
```

- [ ] **Step 2: Initialize `packages/shared` package structure**

```json
// packages/shared/package.json
{
  "name": "@brachio/shared",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "test": "vitest run"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "vitest": "^1.6.0"
  }
}
```

```json
// packages/shared/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 3: Run installation to verify workspace link**

Run: `npm install` or `pnpm install`
Expected: Dependencies installed without errors.

- [ ] **Step 4: Commit**

```bash
git add package.json pnpm-workspace.yaml tsconfig.base.json .gitignore packages/shared/
git commit -m "chore: initialize monorepo workspaces and shared package structure"
```

---

### Task 2: Shared Package - Types, Parser & Protocol

**Files:**
- Create: `packages/shared/src/types.ts`
- Create: `packages/shared/src/protocol.ts`
- Create: `packages/shared/src/parser.ts`
- Create: `packages/shared/src/index.ts`
- Test: `packages/shared/tests/parser.test.ts`

**Interfaces:**
- Consumes: None
- Produces:
  - `parseTimeString(input: string): { valid: boolean; durationMs: number; error?: string }`
  - `formatDuration(ms: number, showHours?: boolean): string`
  - Protocol message types: `HostMessage`, `ViewerMessage`, `HostResponse`, `ViewerResponse`, `TimerSnapshot`

- [ ] **Step 1: Write failing tests for time parser and duration formatter**

```typescript
// packages/shared/tests/parser.test.ts
import { describe, it, expect } from 'vitest';
import { parseTimeString, formatDuration } from '../src/parser.js';

describe('parseTimeString', () => {
  it('parses combined minutes and seconds', () => {
    expect(parseTimeString('1min40s')).toEqual({ valid: true, durationMs: 100000 });
    expect(parseTimeString('1m40s')).toEqual({ valid: true, durationMs: 100000 });
    expect(parseTimeString('1m 40s')).toEqual({ valid: true, durationMs: 100000 });
  });

  it('parses single units', () => {
    expect(parseTimeString('90s')).toEqual({ valid: true, durationMs: 90000 });
    expect(parseTimeString('5m')).toEqual({ valid: true, durationMs: 300000 });
    expect(parseTimeString('2h')).toEqual({ valid: true, durationMs: 7200000 });
    expect(parseTimeString('1.5m')).toEqual({ valid: true, durationMs: 90000 });
  });

  it('parses digital formats', () => {
    expect(parseTimeString('01:40')).toEqual({ valid: true, durationMs: 100000 });
    expect(parseTimeString('1:30:00')).toEqual({ valid: true, durationMs: 5400000 });
    expect(parseTimeString('00:15')).toEqual({ valid: true, durationMs: 15000 });
  });

  it('handles invalid inputs gracefully', () => {
    expect(parseTimeString('invalid').valid).toBe(false);
    expect(parseTimeString('-10s').valid).toBe(false);
    expect(parseTimeString('0s').valid).toBe(false);
  });
});

describe('formatDuration', () => {
  it('formats milliseconds to MM:SS or HH:MM:SS', () => {
    expect(formatDuration(100000)).toBe('01:40');
    expect(formatDuration(5400000)).toBe('01:30:00');
    expect(formatDuration(9000)).toBe('00:09');
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npx vitest run packages/shared/tests/parser.test.ts`
Expected: FAIL ("Cannot find module '../src/parser.js'")

- [ ] **Step 3: Implement `types.ts`, `protocol.ts`, `parser.ts`, and `index.ts`**

```typescript
// packages/shared/src/types.ts
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
```

```typescript
// packages/shared/src/protocol.ts
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
```

```typescript
// packages/shared/src/parser.ts
export interface ParseResult {
  valid: boolean;
  durationMs: number;
  error?: string;
}

export function parseTimeString(input: string): ParseResult {
  const clean = input.trim().toLowerCase();
  if (!clean) {
    return { valid: false, durationMs: 0, error: 'Empty input' };
  }

  // Check digital format HH:MM:SS or MM:SS
  const digitalMatch = clean.match(/^(\d+):([0-5]?\d)(?::([0-5]?\d))?$/);
  if (digitalMatch) {
    if (digitalMatch[3] !== undefined) {
      const hours = parseInt(digitalMatch[1], 10);
      const minutes = parseInt(digitalMatch[2], 10);
      const seconds = parseInt(digitalMatch[3], 10);
      const totalMs = (hours * 3600 + minutes * 60 + seconds) * 1000;
      return validateDuration(totalMs);
    } else {
      const minutes = parseInt(digitalMatch[1], 10);
      const seconds = parseInt(digitalMatch[2], 10);
      const totalMs = (minutes * 60 + seconds) * 1000;
      return validateDuration(totalMs);
    }
  }

  // Natural language units: e.g. "1h30m", "1min40s", "100s", "1.5m"
  const regex = /(?:(\d+(?:\.\d+)?)\s*(?:h|hr|hours?))|(?:(\d+(?:\.\d+)?)\s*(?:m|min|mins|minutes?))|(?:(\d+(?:\.\d+)?)\s*(?:s|sec|secs|seconds?))/g;
  let totalMs = 0;
  let matches = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(clean)) !== null) {
    matches++;
    if (match[1]) totalMs += parseFloat(match[1]) * 3600 * 1000;
    if (match[2]) totalMs += parseFloat(match[2]) * 60 * 1000;
    if (match[3]) totalMs += parseFloat(match[3]) * 1000;
  }

  if (matches === 0) {
    return { valid: false, durationMs: 0, error: 'Unrecognized time format' };
  }

  return validateDuration(Math.round(totalMs));
}

function validateDuration(ms: number): ParseResult {
  if (ms <= 0) {
    return { valid: false, durationMs: 0, error: 'Duration must be greater than 0 seconds' };
  }
  if (ms > 86400000) {
    return { valid: false, durationMs: 0, error: 'Duration cannot exceed 24 hours' };
  }
  return { valid: true, durationMs: ms };
}

export function formatDuration(ms: number, forceHours = false): string {
  const totalSeconds = Math.ceil(Math.max(0, ms) / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const pad = (n: number) => n.toString().padStart(2, '0');

  if (hours > 0 || forceHours) {
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${pad(minutes)}:${pad(seconds)}`;
}
```

```typescript
// packages/shared/src/index.ts
export * from './types.js';
export * from './protocol.js';
export * from './parser.js';
```

- [ ] **Step 4: Run tests to verify all tests pass**

Run: `npx vitest run packages/shared/tests/parser.test.ts`
Expected: PASS (all tests pass)

- [ ] **Step 5: Commit**

```bash
git add packages/shared/
git commit -m "feat(shared): implement time parser, protocol types, and unit tests"
```

---

### Task 3: WebSocket Relay Server

**Files:**
- Create: `apps/server/package.json`
- Create: `apps/server/tsconfig.json`
- Create: `apps/server/src/roomManager.ts`
- Create: `apps/server/src/server.ts`
- Test: `apps/server/tests/server.test.ts`

**Interfaces:**
- Consumes: `@brachio/shared` (`HostMessage`, `ViewerMessage`, `TimerSnapshot`)
- Produces: Running WebSocket server handling room creation, token authorization, snapshot syncing, viewer counts, and ping/pong clock synchronization.

- [ ] **Step 1: Create `apps/server` configuration files**

```json
// apps/server/package.json
{
  "name": "@brachio/server",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./dist/server.js",
  "scripts": {
    "build": "tsc",
    "start": "node dist/server.js",
    "dev": "tsx watch src/server.ts",
    "test": "vitest run"
  },
  "dependencies": {
    "@brachio/shared": "workspace:*",
    "nanoid": "^5.0.7",
    "ws": "^8.16.0"
  },
  "devDependencies": {
    "@types/ws": "^8.5.10",
    "tsx": "^4.7.1",
    "typescript": "^5.4.0",
    "vitest": "^1.6.0"
  }
}
```

- [ ] **Step 2: Write failing integration test for WebSocket relay server**

```typescript
// apps/server/tests/server.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { WebSocket } from 'ws';
import { createRelayServer } from '../src/server.js';
import type { Server } from 'http';

describe('Relay Server WebSocket', () => {
  let server: Server;
  let port: number;

  beforeAll(async () => {
    const res = await createRelayServer(0);
    server = res.httpServer;
    port = res.port;
  });

  afterAll(async () => {
    server.close();
  });

  it('allows host to create room and viewer to join and sync state', async () => {
    const hostWs = new WebSocket(`ws://localhost:${port}`);
    await new Promise((res) => hostWs.on('open', res));

    // Host creates room
    hostWs.send(JSON.stringify({ type: 'HOST_CREATE_ROOM', durationMs: 60000, inputString: '1m' }));

    const roomData = await new Promise<any>((res) => {
      hostWs.on('message', (msg) => res(JSON.parse(msg.toString())));
    });

    expect(roomData.type).toBe('ROOM_CREATED');
    expect(roomData.roomCode).toBeDefined();
    expect(roomData.hostToken).toBeDefined();

    // Viewer joins room
    const viewerWs = new WebSocket(`ws://localhost:${port}`);
    await new Promise((res) => viewerWs.on('open', res));

    viewerWs.send(JSON.stringify({ type: 'VIEWER_JOIN', roomCode: roomData.roomCode }));

    const snapshot = await new Promise<any>((res) => {
      viewerWs.on('message', (msg) => res(JSON.parse(msg.toString())));
    });

    expect(snapshot.type).toBe('ROOM_SNAPSHOT');
    expect(snapshot.snapshot.durationMs).toBe(60000);

    hostWs.close();
    viewerWs.close();
  });
});
```

- [ ] **Step 3: Implement `roomManager.ts` and `server.ts`**

```typescript
// apps/server/src/roomManager.ts
import { customAlphabet } from 'nanoid';
import { TimerSnapshot, TimerStatus } from '@brachio/shared';
import type { WebSocket } from 'ws';

const nanoid = customAlphabet('23456789ABCDEFGHJKLMNPQRSTUVWXYZ', 6);

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
    const hostToken = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 24)();

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
    const room = this.rooms.get(roomCode);
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

  broadcastToViewers(roomCode: string, message: any): void {
    const room = this.rooms.get(roomCode);
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
```

```typescript
// apps/server/src/server.ts
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { RoomManager } from './roomManager.js';

export function createRelayServer(port = 8080): Promise<{ httpServer: http.Server; port: number }> {
  const roomManager = new RoomManager();
  const server = http.createServer((req, res) => {
    // Health check endpoint
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok' }));
      return;
    }
    res.writeHead(404);
    res.end();
  });

  const wss = new WebSocketServer({ server });

  wss.on('connection', (ws: WebSocket) => {
    let currentRoomCode: string | null = null;
    let isHost = false;

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());

        switch (msg.type) {
          case 'HOST_CREATE_ROOM': {
            const { roomCode, hostToken } = roomManager.createRoom(ws, msg.durationMs, msg.inputString);
            currentRoomCode = roomCode;
            isHost = true;
            ws.send(JSON.stringify({
              type: 'ROOM_CREATED',
              roomCode,
              hostToken,
              shareUrl: `/join/${roomCode}`
            }));
            break;
          }

          case 'HOST_UPDATE_STATE': {
            if (!currentRoomCode) return;
            roomManager.updateState(currentRoomCode, msg.hostToken, {
              status: msg.status,
              durationMs: msg.durationMs,
              remainingMs: msg.remainingMs,
              targetEndTime: msg.targetEndTime
            });
            break;
          }

          case 'VIEWER_JOIN': {
            const room = roomManager.getRoom(msg.roomCode);
            if (!room) {
              ws.send(JSON.stringify({ type: 'ERROR', message: 'Room not found' }));
              return;
            }
            currentRoomCode = room.roomCode;
            isHost = false;
            roomManager.addViewer(currentRoomCode, ws);

            ws.send(JSON.stringify({
              type: 'ROOM_SNAPSHOT',
              snapshot: room.state,
              viewerCount: room.viewers.size
            }));
            break;
          }

          case 'SYNC_PING': {
            ws.send(JSON.stringify({
              type: 'SYNC_PONG',
              clientSendTime: msg.clientSendTime,
              serverTime: Date.now()
            }));
            break;
          }
        }
      } catch (err) {
        ws.send(JSON.stringify({ type: 'ERROR', message: 'Invalid payload' }));
      }
    });

    ws.on('close', () => {
      if (currentRoomCode) {
        if (isHost) {
          roomManager.broadcastToViewers(currentRoomCode, {
            type: 'HOST_STATUS',
            online: false
          });
        } else {
          roomManager.removeViewer(currentRoomCode, ws);
        }
      }
    });
  });

  return new Promise((resolve) => {
    server.listen(port, () => {
      const actualPort = (server.address() as any).port;
      resolve({ httpServer: server, port: actualPort });
    });
  });
}

// Auto-run if executed directly
if (process.argv[1]?.endsWith('server.ts') || process.argv[1]?.endsWith('server.js')) {
  const PORT = parseInt(process.env.PORT || '8080', 10);
  createRelayServer(PORT).then(({ port }) => {
    console.log(`Relay server running on port ${port}`);
  });
}
```

- [ ] **Step 4: Run test to verify passes**

Run: `npx vitest run apps/server/tests/server.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/server/
git commit -m "feat(server): implement websocket room manager and relay server"
```

---

### Task 4: Web Viewer Application

**Files:**
- Create: `apps/web/package.json`
- Create: `apps/web/vite.config.ts`
- Create: `apps/web/index.html`
- Create: `apps/web/src/hooks/useViewerTimer.ts`
- Create: `apps/web/src/components/HourglassDisplay.tsx`
- Create: `apps/web/src/App.tsx`
- Test: `apps/web/tests/useViewerTimer.test.ts`

**Interfaces:**
- Consumes: `@brachio/shared` (`formatDuration`, `ViewerResponse`)
- Produces: Interactive real-time countdown viewer in browser with Hourglass drain animation and audio mute toggle.

- [ ] **Step 1: Create `apps/web` package and Vite configuration**

```json
// apps/web/package.json
{
  "name": "@brachio/web",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "test": "vitest run"
  },
  "dependencies": {
    "@brachio/shared": "workspace:*",
    "lucide-react": "^0.359.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.66",
    "@types/react-dom": "^18.2.22",
    "@vitejs/plugin-react": "^4.2.1",
    "autoprefixer": "^10.4.18",
    "postcss": "^8.4.35",
    "tailwindcss": "^3.4.1",
    "typescript": "^5.4.0",
    "vite": "^5.1.6",
    "vitest": "^1.6.0"
  }
}
```

- [ ] **Step 2: Implement `useViewerTimer` hook and test**

```typescript
// apps/web/src/hooks/useViewerTimer.ts
import { useState, useEffect, useRef } from 'react';
import { TimerSnapshot, TimerStatus, formatDuration } from '@brachio/shared';

export function useViewerTimer(roomCode: string, wsUrl = 'ws://localhost:8080') {
  const [snapshot, setSnapshot] = useState<TimerSnapshot | null>(null);
  const [viewerCount, setViewerCount] = useState<number>(1);
  const [hostOnline, setHostOnline] = useState<boolean>(true);
  const [clockOffset, setClockOffset] = useState<number>(0);
  const [displayRemainingMs, setDisplayRemainingMs] = useState<number>(0);
  const [isConnected, setIsConnected] = useState<boolean>(false);

  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      ws.send(JSON.stringify({ type: 'VIEWER_JOIN', roomCode }));
      // Ping for clock offset
      ws.send(JSON.stringify({ type: 'SYNC_PING', clientSendTime: Date.now() }));
    };

    ws.onmessage = (event) => {
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
      } else if (data.type === 'STATE_CHANGED') {
        setSnapshot((prev) => prev ? { ...prev, ...data } : data);
        if (data.status !== 'running') {
          setDisplayRemainingMs(data.remainingMs);
        }
      } else if (data.type === 'HOST_STATUS') {
        setHostOnline(data.online);
      }
    };

    ws.onclose = () => setIsConnected(false);
    return () => ws.close();
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

  const progressPercent = snapshot && snapshot.durationMs > 0
    ? Math.min(100, Math.max(0, (displayRemainingMs / snapshot.durationMs) * 100))
    : 0;

  return {
    snapshot,
    displayRemainingMs,
    progressPercent,
    formattedTime: formatDuration(displayRemainingMs),
    viewerCount,
    hostOnline,
    isConnected
  };
}
```

- [ ] **Step 3: Build `HourglassDisplay.tsx` and `App.tsx`**

```tsx
// apps/web/src/components/HourglassDisplay.tsx
import React from 'react';

interface Props {
  formattedTime: string;
  progressPercent: number; // 100 down to 0
  status: string;
}

export const HourglassDisplay: React.FC<Props> = ({ formattedTime, progressPercent, status }) => {
  return (
    <div className="relative w-full h-full min-h-[300px] flex items-center justify-center overflow-hidden bg-zinc-950 text-white select-none">
      {/* Hourglass fluid drain background */}
      <div
        className="absolute bottom-0 left-0 right-0 bg-blue-600/30 transition-all duration-100 ease-linear pointer-events-none"
        style={{ height: `${progressPercent}%` }}
      />
      {/* Digital countdown digits */}
      <div className="relative z-10 flex flex-col items-center">
        <span className="text-8xl md:text-9xl font-mono font-bold tracking-tight drop-shadow-md">
          {formattedTime}
        </span>
        <span className="mt-4 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-zinc-800/80 text-zinc-300">
          {status}
        </span>
      </div>
    </div>
  );
};
```

- [ ] **Step 4: Verify web app build**

Run: `pnpm --filter @brachio/web build` or `npx vite build apps/web`
Expected: Production build succeeds without errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/
git commit -m "feat(web): implement read-only web viewer with hourglass animation and drift compensation"
```

---

### Task 5: Desktop App - Tauri v2 Scaffolding & Global Shortcuts

**Files:**
- Create: `apps/desktop/src-tauri/Cargo.toml`
- Create: `apps/desktop/src-tauri/tauri.conf.json`
- Create: `apps/desktop/src-tauri/src/main.rs`
- Create: `apps/desktop/package.json`

**Interfaces:**
- Consumes: Tauri v2 + `tauri-plugin-global-shortcut`
- Produces: Native desktop application with global OS shortcut hooks (`reset_and_restart`, `reset_and_pause`, `toggle_pause`).

- [ ] **Step 1: Create `apps/desktop/package.json`**

```json
// apps/desktop/package.json
{
  "name": "@brachio/desktop",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "tauri": "tauri"
  },
  "dependencies": {
    "@brachio/shared": "workspace:*",
    "@tauri-apps/api": "^2.0.0",
    "@tauri-apps/plugin-global-shortcut": "^2.0.0",
    "lucide-react": "^0.359.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  },
  "devDependencies": {
    "@tauri-apps/cli": "^2.0.0",
    "@types/react": "^18.2.66",
    "@types/react-dom": "^18.2.22",
    "@vitejs/plugin-react": "^4.2.1",
    "tailwindcss": "^3.4.1",
    "typescript": "^5.4.0",
    "vite": "^5.1.6"
  }
}
```

- [ ] **Step 2: Configure `Cargo.toml` and `tauri.conf.json`**

```toml
# apps/desktop/src-tauri/Cargo.toml
[package]
name = "brachio-tracker"
version = "0.1.0"
description = "Hourglass-style desktop timer with global hotkeys and session sharing"
edition = "2021"

[build-dependencies]
tauri-build = { version = "2.0.0", features = [] }

[dependencies]
tauri = { version = "2.0.0", features = [] }
tauri-plugin-global-shortcut = "2.0.0"
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
```

```json
// apps/desktop/src-tauri/tauri.conf.json
{
  "$schema": "https://raw.githubusercontent.com/tauri-apps/tauri/dev/tooling/cli/schema.json",
  "productName": "Hourglass Tracker",
  "version": "0.1.0",
  "identifier": "com.brachio.tracker",
  "build": {
    "beforeDevCommand": "npm run dev",
    "devUrl": "http://localhost:1420",
    "beforeBuildCommand": "npm run build",
    "frontendDist": "../dist"
  },
  "app": {
    "windows": [
      {
        "title": "Hourglass Tracker",
        "width": 420,
        "height": 280,
        "resizable": true,
        "decorations": true,
        "alwaysOnTop": false
      }
    ],
    "security": {
      "csp": null
    }
  },
  "plugins": {
    "global-shortcut": {}
  }
}
```

- [ ] **Step 3: Setup `src-tauri/src/main.rs` with shortcut plugin init**

```rust
// apps/desktop/src-tauri/src/main.rs
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src-tauri/ apps/desktop/package.json
git commit -m "feat(desktop): configure tauri v2 and global shortcut plugin"
```

---

### Task 6: Desktop Frontend - Timer Engine, Hotkeys & UI

**Files:**
- Create: `apps/desktop/src/hooks/useTimerEngine.ts`
- Create: `apps/desktop/src/hooks/useGlobalShortcuts.ts`
- Create: `apps/desktop/src/utils/audio.ts`
- Create: `apps/desktop/src/components/TimerInput.tsx`
- Create: `apps/desktop/src/components/SettingsModal.tsx`
- Create: `apps/desktop/src/App.tsx`
- Test: `apps/desktop/tests/useTimerEngine.test.ts`

**Interfaces:**
- Consumes: `@brachio/shared` (`parseTimeString`, `formatDuration`), `@tauri-apps/plugin-global-shortcut`
- Produces: Full interactive desktop UI with unfocused hotkey listeners, sound synthesis on zero, and custom duration settings.

- [ ] **Step 1: Write tests for `useTimerEngine` logic**

```typescript
// apps/desktop/tests/useTimerEngine.test.ts
import { describe, it, expect } from 'vitest';
import { parseTimeString } from '@brachio/shared';

describe('Timer Engine Logic', () => {
  it('correctly sets initial target duration', () => {
    const res = parseTimeString('1min40s');
    expect(res.durationMs).toBe(100000);
  });
});
```

- [ ] **Step 2: Implement `useTimerEngine.ts` with instant reset-and-restart**

```typescript
// apps/desktop/src/hooks/useTimerEngine.ts
import { useState, useEffect, useRef, useCallback } from 'react';
import { TimerStatus, parseTimeString } from '@brachio/shared';
import { playAlertSound } from '../utils/audio.js';

export function useTimerEngine(initialInput = '1min40s') {
  const [inputString, setInputString] = useState(initialInput);
  const [durationMs, setDurationMs] = useState(() => parseTimeString(initialInput).durationMs || 100000);
  const [remainingMs, setRemainingMs] = useState(durationMs);
  const [status, setStatus] = useState<TimerStatus>('idle');
  const [targetEndTime, setTargetEndTime] = useState<number | null>(null);

  const onFinishRef = useRef<() => void>();

  const start = useCallback(() => {
    const end = Date.now() + (remainingMs > 0 ? remainingMs : durationMs);
    setTargetEndTime(end);
    setStatus('running');
  }, [remainingMs, durationMs]);

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
    if (status === 'running') pause();
    else start();
  }, [status, pause, start]);

  // Main countdown loop
  useEffect(() => {
    if (status !== 'running' || !targetEndTime) return;

    let frameId: number;
    const tick = () => {
      const diff = Math.max(0, targetEndTime - Date.now());
      setRemainingMs(diff);
      if (diff <= 0) {
        setStatus('finished');
        setTargetEndTime(null);
        playAlertSound();
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
```

- [ ] **Step 3: Implement Web Audio synthesis in `audio.ts`**

```typescript
// apps/desktop/src/utils/audio.ts
export function playAlertSound(volume = 0.8) {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.setValueAtTime(880.00, ctx.currentTime + 0.15); // A5

    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.6);
  } catch (err) {
    console.error('Audio playback failed', err);
  }
}
```

- [ ] **Step 4: Implement Tauri Global Shortcuts Hook `useGlobalShortcuts.ts`**

```typescript
// apps/desktop/src/hooks/useGlobalShortcuts.ts
import { useEffect } from 'react';
import { register, unregisterAll } from '@tauri-apps/plugin-global-shortcut';

interface Actions {
  onResetAndRestart: () => void;
  onResetAndPause: () => void;
  onTogglePause: () => void;
}

export function useGlobalShortcuts(
  shortcuts: { resetAndRestart: string; resetAndPause: string; togglePause: string },
  actions: Actions
) {
  useEffect(() => {
    let isMounted = true;

    async function bindShortcuts() {
      try {
        await unregisterAll();

        if (shortcuts.resetAndRestart) {
          await register(shortcuts.resetAndRestart, (event) => {
            if (event.state === 'Pressed') actions.onResetAndRestart();
          });
        }

        if (shortcuts.togglePause) {
          await register(shortcuts.togglePause, (event) => {
            if (event.state === 'Pressed') actions.onTogglePause();
          });
        }
      } catch (err) {
        console.warn('Global shortcut registration failed or running in standard browser:', err);
      }
    }

    bindShortcuts();

    return () => {
      isMounted = false;
      unregisterAll().catch(() => {});
    };
  }, [shortcuts, actions]);
}
```

- [ ] **Step 5: Build Desktop UI `App.tsx` and `TimerInput.tsx`**

```tsx
// apps/desktop/src/App.tsx
import React, { useState } from 'react';
import { useTimerEngine } from './hooks/useTimerEngine.js';
import { useGlobalShortcuts } from './hooks/useGlobalShortcuts.js';
import { formatDuration } from '@brachio/shared';
import { Play, Pause, RotateCcw, Settings, Share2 } from 'lucide-react';

export default function App() {
  const {
    inputString,
    setInputString,
    durationMs,
    remainingMs,
    status,
    start,
    pause,
    resetAndRestart,
    resetAndPause,
    togglePause
  } = useTimerEngine('1min40s');

  const [hotkeys, setHotkeys] = useState({
    resetAndRestart: 'CommandOrControl+Shift+R',
    resetAndPause: 'CommandOrControl+Shift+P',
    togglePause: 'CommandOrControl+Space'
  });

  useGlobalShortcuts(hotkeys, {
    onResetAndRestart: resetAndRestart,
    onResetAndPause: resetAndPause,
    onTogglePause: togglePause
  });

  const progressPercent = durationMs > 0 ? (remainingMs / durationMs) * 100 : 0;

  return (
    <div className="relative w-screen h-screen flex flex-col justify-between items-center bg-zinc-950 text-white overflow-hidden select-none">
      {/* Background visual drain (Hourglass style) */}
      <div
        className="absolute bottom-0 left-0 right-0 bg-blue-600/25 transition-all duration-100 ease-linear pointer-events-none"
        style={{ height: `${progressPercent}%` }}
      />

      {/* Header bar */}
      <header className="relative z-10 w-full p-3 flex justify-between items-center">
        <input
          value={inputString}
          onChange={(e) => setInputString(e.target.value)}
          className="bg-zinc-800/80 hover:bg-zinc-800 text-sm font-mono px-2 py-1 rounded border border-zinc-700 focus:outline-none focus:border-blue-500 w-28 text-center"
          placeholder="e.g. 1m40s"
        />
        <div className="flex gap-2">
          <button className="p-1.5 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white transition">
            <Share2 size={16} />
          </button>
          <button className="p-1.5 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white transition">
            <Settings size={16} />
          </button>
        </div>
      </header>

      {/* Center time display */}
      <main className="relative z-10 flex flex-col items-center">
        <span className="text-7xl font-mono font-bold tracking-tight">
          {formatDuration(remainingMs)}
        </span>
        <span className="text-xs text-zinc-400 mt-1 uppercase font-semibold tracking-wider">
          {status}
        </span>
      </main>

      {/* Bottom controls */}
      <footer className="relative z-10 p-4 flex gap-3">
        {status === 'running' ? (
          <button onClick={pause} className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg flex items-center gap-2 font-medium">
            <Pause size={16} /> Pause
          </button>
        ) : (
          <button onClick={start} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg flex items-center gap-2 font-medium shadow-lg shadow-blue-600/30">
            <Play size={16} /> Start
          </button>
        )}
        <button onClick={resetAndRestart} className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-300 hover:text-white flex items-center gap-1.5 text-sm">
          <RotateCcw size={16} /> Reset
        </button>
      </footer>
    </div>
  );
}
```

- [ ] **Step 6: Verify desktop frontend builds cleanly**

Run: `pnpm --filter @brachio/desktop build`
Expected: Build passes.

- [ ] **Step 7: Commit**

```bash
git add apps/desktop/src/
git commit -m "feat(desktop): implement timer engine, audio alerts, and global shortcuts UI"
```

---

### Task 7: Desktop App - Live Session Host Integration

**Files:**
- Create: `apps/desktop/src/hooks/useHostSync.ts`
- Create: `apps/desktop/src/components/ShareSessionModal.tsx`
- Modify: `apps/desktop/src/App.tsx`

**Interfaces:**
- Consumes: `@brachio/shared` (`HostMessage`, `HostResponse`), WebSocket
- Produces: One-click "Start Live Session", room code generation, shareable URL copying, viewer count tracking, and automatic state broadcasts to viewers.

- [ ] **Step 1: Implement `useHostSync.ts`**

```typescript
// apps/desktop/src/hooks/useHostSync.ts
import { useState, useEffect, useRef } from 'react';
import { TimerStatus } from '@brachio/shared';

export function useHostSync(
  serverUrl = 'ws://localhost:8080',
  currentTimer: { status: TimerStatus; durationMs: number; remainingMs: number; targetEndTime: number | null; inputString: string }
) {
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [hostToken, setHostToken] = useState<string | null>(null);
  const [viewerCount, setViewerCount] = useState<number>(0);
  const [isLive, setIsLive] = useState<boolean>(false);

  const wsRef = useRef<WebSocket | null>(null);

  const openSession = () => {
    const ws = new WebSocket(serverUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({
        type: 'HOST_CREATE_ROOM',
        durationMs: currentTimer.durationMs,
        inputString: currentTimer.inputString
      }));
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'ROOM_CREATED') {
        setRoomCode(data.roomCode);
        setHostToken(data.hostToken);
        setIsLive(true);
      } else if (data.type === 'VIEWER_COUNT') {
        setViewerCount(data.count);
      }
    };

    ws.onclose = () => {
      setIsLive(false);
      setRoomCode(null);
      setHostToken(null);
    };
  };

  const closeSession = () => {
    wsRef.current?.close();
  };

  // Broadcast state changes whenever timer state changes
  useEffect(() => {
    if (!isLive || !hostToken || !wsRef.current || wsRef.current.readyState !== 1) return;

    wsRef.current.send(JSON.stringify({
      type: 'HOST_UPDATE_STATE',
      hostToken,
      status: currentTimer.status,
      durationMs: currentTimer.durationMs,
      remainingMs: currentTimer.remainingMs,
      targetEndTime: currentTimer.targetEndTime
    }));
  }, [currentTimer.status, currentTimer.durationMs, currentTimer.remainingMs, currentTimer.targetEndTime, isLive, hostToken]);

  return {
    isLive,
    roomCode,
    viewerCount,
    openSession,
    closeSession
  };
}
```

- [ ] **Step 2: Build `ShareSessionModal.tsx`**

```tsx
// apps/desktop/src/components/ShareSessionModal.tsx
import React, { useState } from 'react';
import { Copy, Check, Users, Radio, X } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  isLive: boolean;
  roomCode: string | null;
  viewerCount: number;
  onStartLive: () => void;
  onStopLive: () => void;
}

export const ShareSessionModal: React.FC<Props> = ({
  isOpen,
  onClose,
  isLive,
  roomCode,
  viewerCount,
  onStartLive,
  onStopLive
}) => {
  const [copied, setCopied] = useState(false);
  if (!isOpen) return null;

  const shareUrl = roomCode ? `http://localhost:5173/join/${roomCode}` : '';

  const copyToClipboard = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 w-full max-w-sm shadow-2xl relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-zinc-400 hover:text-white">
          <X size={18} />
        </button>
        <h2 className="text-base font-semibold text-white flex items-center gap-2 mb-4">
          <Radio className={isLive ? 'text-green-400 animate-pulse' : 'text-zinc-500'} size={18} />
          Live Session Sharing
        </h2>

        {!isLive ? (
          <div>
            <p className="text-xs text-zinc-400 mb-4">
              Open a live session so remote viewers can watch your countdown in real time. Viewers cannot reset or change the timer.
            </p>
            <button
              onClick={onStartLive}
              className="w-full py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-semibold transition"
            >
              Start Live Room
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-zinc-800/80 p-3 rounded-lg border border-zinc-700">
              <div className="flex justify-between items-center text-xs text-zinc-400 mb-1">
                <span>Room Code</span>
                <span className="flex items-center gap-1 text-green-400">
                  <Users size={12} /> {viewerCount} {viewerCount === 1 ? 'viewer' : 'viewers'}
                </span>
              </div>
              <div className="text-2xl font-mono font-bold tracking-wider text-white">
                {roomCode}
              </div>
            </div>

            <div className="flex gap-2">
              <input
                readOnly
                value={shareUrl}
                className="bg-zinc-950 border border-zinc-800 text-xs px-2.5 py-1.5 rounded flex-1 text-zinc-300 select-all"
              />
              <button
                onClick={copyToClipboard}
                className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded text-xs flex items-center gap-1"
              >
                {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>

            <button
              onClick={onStopLive}
              className="w-full py-1.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/30 rounded text-xs font-medium transition"
            >
              Stop Live Session
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
```

- [ ] **Step 3: Connect ShareSessionModal to `App.tsx`**

Add `useHostSync` hook and modal toggle state to `apps/desktop/src/App.tsx`.

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/
git commit -m "feat(desktop): add live session room creation and host broadcast synchronization"
```

---

### Task 8: End-to-End Verification & Validation

**Files:**
- Test: `tests/e2e-sync.test.ts`
- Create: `scripts/dev-all.sh`

**Interfaces:**
- Consumes: All packages and applications
- Produces: Full integration test verifying host state change -> server broadcast -> viewer rendering synchronization.

- [ ] **Step 1: Write integration test simulating host and viewer flow**

```typescript
// tests/e2e-sync.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createRelayServer } from '../apps/server/src/server.js';
import { parseTimeString } from '../packages/shared/src/parser.js';
import { WebSocket } from 'ws';
import type { Server } from 'http';

describe('End-to-End Timer Broadcast Synchronization', () => {
  let server: Server;
  let port: number;

  beforeAll(async () => {
    const res = await createRelayServer(0);
    server = res.httpServer;
    port = res.port;
  });

  afterAll(() => server.close());

  it('verifies parser, room creation, hotkey reset update, and viewer reception', async () => {
    const parsed = parseTimeString('1min40s');
    expect(parsed.durationMs).toBe(100000);

    const host = new WebSocket(`ws://localhost:${port}`);
    await new Promise((r) => host.on('open', r));

    host.send(JSON.stringify({
      type: 'HOST_CREATE_ROOM',
      durationMs: parsed.durationMs,
      inputString: '1min40s'
    }));

    const created = await new Promise<any>((r) => {
      host.once('message', (d) => r(JSON.parse(d.toString())));
    });

    expect(created.roomCode).toBeTruthy();

    const viewer = new WebSocket(`ws://localhost:${port}`);
    await new Promise((r) => viewer.on('open', r));

    viewer.send(JSON.stringify({
      type: 'VIEWER_JOIN',
      roomCode: created.roomCode
    }));

    const snapshot = await new Promise<any>((r) => {
      viewer.once('message', (d) => r(JSON.parse(d.toString())));
    });

    expect(snapshot.snapshot.durationMs).toBe(100000);

    // Host triggers reset-and-restart
    host.send(JSON.stringify({
      type: 'HOST_UPDATE_STATE',
      hostToken: created.hostToken,
      status: 'running',
      durationMs: 100000,
      remainingMs: 100000,
      targetEndTime: Date.now() + 100000
    }));

    const update = await new Promise<any>((r) => {
      viewer.once('message', (d) => r(JSON.parse(d.toString())));
    });

    expect(update.type).toBe('STATE_CHANGED');
    expect(update.status).toBe('running');
    expect(update.remainingMs).toBe(100000);

    host.close();
    viewer.close();
  });
});
```

- [ ] **Step 2: Run all tests across the monorepo**

Run: `npx vitest run`
Expected: All unit and end-to-end integration tests pass.

- [ ] **Step 3: Commit**

```bash
git add tests/ scripts/
git commit -m "test: add comprehensive end-to-end sync verification tests"
```
