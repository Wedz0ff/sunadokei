import http from 'http';
import fs from 'fs';
import path from 'path';
import { WebSocketServer, WebSocket } from 'ws';
import { RoomManager } from './roomManager.js';

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.webp': 'image/webp',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav'
};

function resolveStaticDir(customDir?: string): string | null {
  if (customDir && fs.existsSync(customDir)) {
    return path.resolve(customDir);
  }
  if (process.env.STATIC_DIR && fs.existsSync(process.env.STATIC_DIR)) {
    return path.resolve(process.env.STATIC_DIR);
  }
  const candidates = [
    path.resolve(process.cwd(), 'public'),
    path.resolve(process.cwd(), 'apps/web/dist'),
    path.resolve(process.cwd(), '../web/dist'),
    path.resolve(process.cwd(), 'dist/web')
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

export function createRelayServer(
  port = 8080,
  options: { staticDir?: string } = {}
): Promise<{ httpServer: http.Server; wss: WebSocketServer; port: number; roomManager: RoomManager }> {
  const roomManager = new RoomManager();
  const cleanupInterval = setInterval(() => {
    roomManager.cleanInactiveRooms();
  }, 60000);
  cleanupInterval.unref?.();

  const staticDir = resolveStaticDir(options.staticDir);

  const server = http.createServer((req, res) => {
    const parsedUrl = new URL(req.url || '/', 'http://localhost');
    const pathname = parsedUrl.pathname;

    // Health check endpoint
    if (pathname === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok' }));
      return;
    }

    // Static SPA file serving
    if (staticDir) {
      const safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
      let targetFile = path.join(staticDir, safePath);

      // Security check: stay within staticDir
      if (!targetFile.startsWith(staticDir)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }

      // If directory or root requested, serve index.html
      if (fs.existsSync(targetFile) && fs.statSync(targetFile).isDirectory()) {
        targetFile = path.join(targetFile, 'index.html');
      }

      // SPA fallback: if file doesn't exist, fallback to index.html (e.g. /join/:roomCode)
      if (!fs.existsSync(targetFile)) {
        targetFile = path.join(staticDir, 'index.html');
      }

      if (fs.existsSync(targetFile) && fs.statSync(targetFile).isFile()) {
        const ext = path.extname(targetFile).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';
        const isAsset = pathname.startsWith('/assets/') || pathname.startsWith('/tibia/');
        const cacheControl = isAsset ? 'public, max-age=31536000, immutable' : 'no-cache';

        res.writeHead(200, {
          'Content-Type': contentType,
          'Cache-Control': cacheControl
        });
        fs.createReadStream(targetFile).pipe(res);
        return;
      }
    }

    res.writeHead(404);
    res.end('Not Found');
  });

  const wss = new WebSocketServer({ server });

  wss.on('error', (err) => {
    console.error('WebSocketServer error:', err);
  });

  server.on('close', () => {
    clearInterval(cleanupInterval);
    wss.close();
  });

  wss.on('connection', (ws: WebSocket) => {
    let currentRoomCode: string | null = null;
    let isHost = false;

    ws.on('error', (err) => {
      console.error('WebSocket connection error:', err);
    });

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
            if (!isHost || !currentRoomCode) return;
            roomManager.updateState(currentRoomCode, msg.hostToken, {
              status: msg.status,
              durationMs: msg.durationMs,
              remainingMs: msg.remainingMs,
              targetEndTime: msg.targetEndTime
            });
            break;
          }

          case 'HOST_CLOSE_ROOM': {
            if (!isHost || !currentRoomCode) return;
            roomManager.deleteRoom(currentRoomCode, msg.hostToken);
            currentRoomCode = null;
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

          default: {
            ws.send(JSON.stringify({ type: 'ERROR', message: `Unknown message type: ${msg.type}` }));
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
          roomManager.handleHostDisconnect(currentRoomCode);
        } else {
          roomManager.removeViewer(currentRoomCode, ws);
        }
      }
    });
  });

  return new Promise((resolve) => {
    server.listen(port, () => {
      const actualPort = (server.address() as any).port;
      resolve({ httpServer: server, wss, port: actualPort, roomManager });
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
