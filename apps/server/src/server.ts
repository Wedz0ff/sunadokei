import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { RoomManager } from './roomManager.js';

export function createRelayServer(port = 8080): Promise<{ httpServer: http.Server; wss: WebSocketServer; port: number }> {
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

  wss.on('error', (err) => {
    console.error('WebSocketServer error:', err);
  });

  server.on('close', () => {
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
      resolve({ httpServer: server, wss, port: actualPort });
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
