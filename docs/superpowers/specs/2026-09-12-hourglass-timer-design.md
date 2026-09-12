# Technical Design Specification: Hourglass-Style Synchronized Timer

- **Date**: 2026-09-12
- **Status**: Validated Design

---

## 1. Overview

This project is a multi-platform countdown timer application inspired by [Hourglass](https://github.com/alan-mc/Hourglass). It provides:
1. **A desktop host app (Tauri v2 + React)** with natural language time parsing (e.g. `1min40s`), high-precision countdown, audio playback on zero, and global hotkey control that functions even when the app is unfocused or minimized.
2. **A shared live session system**: The host can generate a live room session over the internet; remote viewers join via web browser to watch the real-time countdown without being able to reset or manipulate the timer.
3. **A lightweight WebSocket relay server** connecting the desktop host to web viewers with low-latency state synchronization and clock-drift compensation.

---

## 2. Architecture & Monorepo Layout

The repository is organized as a pnpm/npm workspace monorepo:

```text
brachio-tracker/
├── apps/
│   ├── desktop/                 # Tauri v2 + React (Host Desktop Application)
│   │   ├── src-tauri/           # Rust backend (Tauri v2, global shortcuts, audio/dialog)
│   │   └── src/                 # React UI (Timer, Hourglass input, Settings modal)
│   │
│   ├── web/                     # Web Viewer (React + Vite + Tailwind CSS)
│   │   └── src/                 # Read-only viewer UI (served to remote viewers)
│   │
│   └── server/                  # WebSocket Relay Server (Node.js/Bun + ws)
│       └── src/                 # Room management, token authentication, pub/sub broadcast
│
├── packages/
│   └── shared/                  # Shared TypeScript models, parsing logic, and protocol
│       └── src/
│           ├── index.ts
│           ├── parser.ts        # Natural language time parser ("1m40s" -> ms)
│           ├── protocol.ts      # WebSocket message types and schemas
│           └── types.ts         # TimerState, Settings, Room info
│
├── package.json                 # Monorepo root workspaces definition
├── tsconfig.base.json
└── README.md
```

---

## 3. Core Subsystems & Components

### 3.1 Time Parser (`packages/shared/src/parser.ts`)
Parses human-friendly time strings into milliseconds:
- **Supported patterns**:
  - Combined units: `1min40s`, `1m40s`, `1m 40s`, `2h15m30s`, `10s`
  - Single units: `90s`, `5m`, `1.5m`, `2h`
  - Digital formats: `01:40`, `1:30:00`, `00:15`
- **Output**: Returns duration in milliseconds `{ valid: true, durationMs: 100000 }` or `{ valid: false, error: string }`.
- **Validation**:
  - Maximum limit: 24 hours (86,400,000 ms).
  - Minimum limit: 1 second (1,000 ms).
  - Handles whitespace and case insensitivity (`1MIN40S`).

### 3.2 Desktop Host Engine (`apps/desktop`)
- **State Model**:
  ```typescript
  interface HostTimerState {
    status: 'idle' | 'running' | 'paused' | 'finished';
    inputString: string;       // e.g. "1min40s"
    durationMs: number;        // e.g. 100000
    remainingMs: number;       // Current remaining time in ms
    targetEndTime: number | null; // Date.now() + remainingMs when running
    activeRoomCode: string | null;
    hostToken: string | null;
    isMuted: boolean;
  }
  ```
- **Countdown Precision**:
  - Calculates remaining time via wall-clock diff: `remainingMs = Math.max(0, targetEndTime - Date.now())`.
  - Animates smoothly at 60 FPS using `requestAnimationFrame`.
  - Triggers audio alarm and enters `'finished'` state immediately when `remainingMs <= 0`.
- **Global Hotkey Integration**:
  - Powered by `@tauri-apps/plugin-global-shortcut`.
  - Registered shortcuts are active system-wide even when the desktop window is unfocused, minimized, or covered by full-screen apps.
  - **Supported Actions**:
    - `reset_and_restart`: Resets `remainingMs = durationMs`, calculates new `targetEndTime`, and starts countdown immediately.
    - `reset_and_pause`: Resets `remainingMs = durationMs`, sets `status = 'idle'`.
    - `toggle_pause`: Pauses if running; resumes if paused.
  - User can configure custom key bindings (default: `CommandOrControl+Shift+R` for Reset & Restart).

### 3.3 Audio Notification System
- **Preset Sounds**: Bundled standard audio tones (Digital Beep, Chime, Classic Bell).
- **Custom Sound**: Host can select a local audio file (`.mp3`, `.wav`, `.ogg`) using Tauri's native file dialog.
- **Playback Options**:
  - Single play vs loop until reset/stopped.
  - Host volume slider (0 - 100%).
- **Viewer Audio Sync**:
  - When timer reaches 0, the server broadcasts `TIMER_FINISHED`.
  - Web viewers can toggle audio unmuted to hear completion alerts in their browser.

### 3.4 WebSocket Relay Server (`apps/server`)
- **State Management**:
  - In-memory room store:
    ```typescript
    interface Room {
      roomCode: string;          // e.g. "HOUR-428"
      hostSocketId: string;
      hostToken: string;         // Secret UUID
      state: TimerSnapshot;
      viewerCount: number;
    }
    ```
- **Room Code Generation**:
  - Human-friendly 6-to-7 character codes (e.g. `TRK-892`).
- **Security & Authorization**:
  - State mutations (`START`, `PAUSE`, `RESET`, `UPDATE_DURATION`) require the `hostToken`.
  - Viewers join without tokens and cannot emit any state-modifying actions.
  - Rate limiting on room creation and socket messages.

### 3.5 Web Viewer (`apps/web`)
- Minimalist, distraction-free UI rendered at route `/join/:roomCode`.
- Displays:
  - Large digital countdown (`MM:SS` or `HH:MM:SS`).
  - Dynamic Hourglass-style visual drain/progress bar.
  - Status indicator (e.g., "Live", "Paused", "Finished", "Host Disconnected").
  - Viewer count badge.
  - Audio mute/unmute toggle for the viewer's local browser sound alert.
- **Clock Synchronization**:
  - On connection, viewer performs a 2-way ping/pong with the server:
    $$\Delta t_{offset} = t_{server} - (t_{client} + \frac{RTT}{2})$$
  - Countdown interpolates using local time adjusted by $\Delta t_{offset}$:
    $$remaining = \max(0, targetEndTime - (Date.now() + \Delta t_{offset}))$$

---

## 4. WebSocket Protocol Messages

```typescript
// Host -> Server
type HostMessage =
  | { type: 'HOST_CREATE_ROOM'; durationMs: number; inputString: string }
  | { type: 'HOST_UPDATE_STATE'; hostToken: string; status: TimerStatus; durationMs: number; remainingMs: number; targetEndTime: number | null }
  | { type: 'HOST_CLOSE_ROOM'; hostToken: string };

// Server -> Host
type HostResponse =
  | { type: 'ROOM_CREATED'; roomCode: string; hostToken: string; shareUrl: string }
  | { type: 'VIEWER_COUNT'; count: number }
  | { type: 'ERROR'; message: string };

// Viewer -> Server
type ViewerMessage =
  | { type: 'VIEWER_JOIN'; roomCode: string }
  | { type: 'SYNC_PING'; clientSendTime: number };

// Server -> Viewer
type ViewerResponse =
  | { type: 'SYNC_PONG'; clientSendTime: number; serverTime: number }
  | { type: 'ROOM_SNAPSHOT'; snapshot: TimerSnapshot; viewerCount: number }
  | { type: 'STATE_CHANGED'; status: TimerStatus; durationMs: number; remainingMs: number; targetEndTime: number | null; serverTime: number }
  | { type: 'TIMER_FINISHED' }
  | { type: 'HOST_STATUS'; online: boolean }
  | { type: 'ERROR'; message: string };
```

---

## 5. Configuration & Persistence

The desktop app stores its configuration locally via a JSON settings file:
- `defaultDuration`: string (e.g. `"1m40s"`)
- `hotkeyBindings`:
  - `resetAndRestart`: string (e.g. `"CommandOrControl+Shift+R"`)
  - `resetAndPause`: string (e.g. `"CommandOrControl+Shift+P"`)
  - `togglePause`: string (e.g. `"CommandOrControl+Space"`)
- `audio`:
  - `preset`: `"digital"` | `"bell"` | `"chime"` | `"custom"`
  - `customFilePath`: string | null
  - `volume`: number (0 - 100)
  - `loop`: boolean
- `serverUrl`: string (default: relay server URL)

---

## 6. Testing Strategy

1. **Unit Tests (`packages/shared`)**:
   - Time parser with valid formats, combined units, invalid inputs, edge values (0s, >24h).
   - Clock offset calculations.
2. **Server Integration Tests (`apps/server`)**:
   - Room creation, secret host token verification, rejection of unauthorized mutations.
   - Viewer join, snapshot delivery, broadcast distribution, viewer disconnect handling.
3. **Desktop & Web Component Tests**:
   - Timer countdown math and boundary transitions (`running` -> `finished` when <= 0).
   - Hotkey binding serialization and collision prevention.
