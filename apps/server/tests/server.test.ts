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
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
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

  it('handles state updates from host and broadcasts to viewers', async () => {
    const hostWs = new WebSocket(`ws://localhost:${port}`);
    await new Promise((res) => hostWs.on('open', res));

    hostWs.send(JSON.stringify({ type: 'HOST_CREATE_ROOM', durationMs: 30000, inputString: '30s' }));
    const roomData = await new Promise<any>((res) => {
      hostWs.once('message', (msg) => res(JSON.parse(msg.toString())));
    });

    const viewerWs = new WebSocket(`ws://localhost:${port}`);
    await new Promise((res) => viewerWs.on('open', res));

    viewerWs.send(JSON.stringify({ type: 'VIEWER_JOIN', roomCode: roomData.roomCode }));
    // Wait for snapshot
    await new Promise<any>((res) => {
      viewerWs.once('message', (msg) => res(JSON.parse(msg.toString())));
    });

    // Now host sends state update
    const statePromise = new Promise<any>((res) => {
      viewerWs.once('message', (msg) => res(JSON.parse(msg.toString())));
    });

    hostWs.send(JSON.stringify({
      type: 'HOST_UPDATE_STATE',
      hostToken: roomData.hostToken,
      status: 'running',
      durationMs: 30000,
      remainingMs: 25000,
      targetEndTime: Date.now() + 25000
    }));

    const stateChange = await statePromise;
    expect(stateChange.type).toBe('STATE_CHANGED');
    expect(stateChange.status).toBe('running');
    expect(stateChange.remainingMs).toBe(25000);

    hostWs.close();
    viewerWs.close();
  });

  it('handles clock synchronization via SYNC_PING and SYNC_PONG', async () => {
    const ws = new WebSocket(`ws://localhost:${port}`);
    await new Promise((res) => ws.on('open', res));

    const clientSendTime = Date.now();
    ws.send(JSON.stringify({ type: 'SYNC_PING', clientSendTime }));

    const pong = await new Promise<any>((res) => {
      ws.once('message', (msg) => res(JSON.parse(msg.toString())));
    });

    expect(pong.type).toBe('SYNC_PONG');
    expect(pong.clientSendTime).toBe(clientSendTime);
    expect(typeof pong.serverTime).toBe('number');

    ws.close();
  });

  it('notifies host about viewer count changes', async () => {
    const hostWs = new WebSocket(`ws://localhost:${port}`);
    await new Promise((res) => hostWs.on('open', res));

    hostWs.send(JSON.stringify({ type: 'HOST_CREATE_ROOM', durationMs: 10000, inputString: '10s' }));
    const roomData = await new Promise<any>((res) => {
      hostWs.once('message', (msg) => res(JSON.parse(msg.toString())));
    });

    const viewerCountPromise1 = new Promise<any>((res) => {
      hostWs.once('message', (msg) => res(JSON.parse(msg.toString())));
    });

    const viewerWs = new WebSocket(`ws://localhost:${port}`);
    await new Promise((res) => viewerWs.on('open', res));
    viewerWs.send(JSON.stringify({ type: 'VIEWER_JOIN', roomCode: roomData.roomCode }));

    const countMsg1 = await viewerCountPromise1;
    expect(countMsg1.type).toBe('VIEWER_COUNT');
    expect(countMsg1.count).toBe(1);

    const viewerCountPromise2 = new Promise<any>((res) => {
      hostWs.once('message', (msg) => res(JSON.parse(msg.toString())));
    });

    viewerWs.close();
    const countMsg2 = await viewerCountPromise2;
    expect(countMsg2.type).toBe('VIEWER_COUNT');
    expect(countMsg2.count).toBe(0);

    hostWs.close();
  });

  it('notifies viewers when host disconnects', async () => {
    const hostWs = new WebSocket(`ws://localhost:${port}`);
    await new Promise((res) => hostWs.on('open', res));

    hostWs.send(JSON.stringify({ type: 'HOST_CREATE_ROOM', durationMs: 10000, inputString: '10s' }));
    const roomData = await new Promise<any>((res) => {
      hostWs.once('message', (msg) => res(JSON.parse(msg.toString())));
    });

    const viewerWs = new WebSocket(`ws://localhost:${port}`);
    await new Promise((res) => viewerWs.on('open', res));
    viewerWs.send(JSON.stringify({ type: 'VIEWER_JOIN', roomCode: roomData.roomCode }));

    // Consume ROOM_SNAPSHOT
    await new Promise<any>((res) => {
      viewerWs.once('message', (msg) => res(JSON.parse(msg.toString())));
    });

    const hostStatusPromise = new Promise<any>((res) => {
      viewerWs.once('message', (msg) => res(JSON.parse(msg.toString())));
    });

    hostWs.close();

    const hostStatus = await hostStatusPromise;
    expect(hostStatus.type).toBe('HOST_STATUS');
    expect(hostStatus.online).toBe(false);

    viewerWs.close();
  });

  it('returns ERROR when viewer tries to join non-existent room', async () => {
    const viewerWs = new WebSocket(`ws://localhost:${port}`);
    await new Promise((res) => viewerWs.on('open', res));

    viewerWs.send(JSON.stringify({ type: 'VIEWER_JOIN', roomCode: 'NONEXISTENT' }));
    const errorMsg = await new Promise<any>((res) => {
      viewerWs.once('message', (msg) => res(JSON.parse(msg.toString())));
    });

    expect(errorMsg.type).toBe('ERROR');
    expect(errorMsg.message).toBe('Room not found');

    viewerWs.close();
  });

  it('handles HOST_CLOSE_ROOM and prevents subsequent joins', async () => {
    const hostWs = new WebSocket(`ws://localhost:${port}`);
    await new Promise((res) => hostWs.on('open', res));

    hostWs.send(JSON.stringify({ type: 'HOST_CREATE_ROOM', durationMs: 10000, inputString: '10s' }));
    const roomData = await new Promise<any>((res) => {
      hostWs.once('message', (msg) => res(JSON.parse(msg.toString())));
    });

    const viewerWs = new WebSocket(`ws://localhost:${port}`);
    await new Promise((res) => viewerWs.on('open', res));
    viewerWs.send(JSON.stringify({ type: 'VIEWER_JOIN', roomCode: roomData.roomCode }));
    await new Promise<any>((res) => {
      viewerWs.once('message', (msg) => res(JSON.parse(msg.toString())));
    });

    const hostStatusPromise = new Promise<any>((res) => {
      viewerWs.once('message', (msg) => res(JSON.parse(msg.toString())));
    });

    hostWs.send(JSON.stringify({ type: 'HOST_CLOSE_ROOM', hostToken: roomData.hostToken }));
    const hostStatus = await hostStatusPromise;
    expect(hostStatus.type).toBe('HOST_STATUS');
    expect(hostStatus.online).toBe(false);

    // Another viewer tries to join after close
    const lateViewerWs = new WebSocket(`ws://localhost:${port}`);
    await new Promise((res) => lateViewerWs.on('open', res));
    lateViewerWs.send(JSON.stringify({ type: 'VIEWER_JOIN', roomCode: roomData.roomCode }));
    const errorMsg = await new Promise<any>((res) => {
      lateViewerWs.once('message', (msg) => res(JSON.parse(msg.toString())));
    });
    expect(errorMsg.type).toBe('ERROR');
    expect(errorMsg.message).toBe('Room not found');

    hostWs.close();
    viewerWs.close();
    lateViewerWs.close();
  });

  it('broadcasts TIMER_FINISHED when status changes to finished', async () => {
    const hostWs = new WebSocket(`ws://localhost:${port}`);
    await new Promise((res) => hostWs.on('open', res));

    hostWs.send(JSON.stringify({ type: 'HOST_CREATE_ROOM', durationMs: 5000, inputString: '5s' }));
    const roomData = await new Promise<any>((res) => {
      hostWs.once('message', (msg) => res(JSON.parse(msg.toString())));
    });

    const viewerWs = new WebSocket(`ws://localhost:${port}`);
    await new Promise((res) => viewerWs.on('open', res));
    viewerWs.send(JSON.stringify({ type: 'VIEWER_JOIN', roomCode: roomData.roomCode }));
    await new Promise<any>((res) => {
      viewerWs.once('message', (msg) => res(JSON.parse(msg.toString())));
    });

    const messagesReceived: any[] = [];
    viewerWs.on('message', (msg) => {
      messagesReceived.push(JSON.parse(msg.toString()));
    });

    hostWs.send(JSON.stringify({
      type: 'HOST_UPDATE_STATE',
      hostToken: roomData.hostToken,
      status: 'finished',
      durationMs: 5000,
      remainingMs: 0,
      targetEndTime: null
    }));

    await new Promise((res) => setTimeout(res, 50));
    expect(messagesReceived.some((m) => m.type === 'STATE_CHANGED' && m.status === 'finished')).toBe(true);
    expect(messagesReceived.some((m) => m.type === 'TIMER_FINISHED')).toBe(true);

    hostWs.close();
    viewerWs.close();
  });

  it('handles invalid JSON payload gracefully', async () => {
    const ws = new WebSocket(`ws://localhost:${port}`);
    await new Promise((res) => ws.on('open', res));

    ws.send('not valid json');
    const err = await new Promise<any>((res) => {
      ws.once('message', (msg) => res(JSON.parse(msg.toString())));
    });
    expect(err.type).toBe('ERROR');
    expect(err.message).toBe('Invalid payload');

    ws.close();
  });

  it('handles unknown message type gracefully', async () => {
    const ws = new WebSocket(`ws://localhost:${port}`);
    await new Promise((res) => ws.on('open', res));

    ws.send(JSON.stringify({ type: 'UNKNOWN_TYPE' }));
    const err = await new Promise<any>((res) => {
      ws.once('message', (msg) => res(JSON.parse(msg.toString())));
    });
    expect(err.type).toBe('ERROR');
    expect(err.message).toContain('Unknown message type');

    ws.close();
  });

  it('ignores HOST_UPDATE_STATE with invalid hostToken', async () => {
    const hostWs = new WebSocket(`ws://localhost:${port}`);
    await new Promise((res) => hostWs.on('open', res));

    hostWs.send(JSON.stringify({ type: 'HOST_CREATE_ROOM', durationMs: 10000, inputString: '10s' }));
    const roomData = await new Promise<any>((res) => {
      hostWs.once('message', (msg) => res(JSON.parse(msg.toString())));
    });

    const viewerWs = new WebSocket(`ws://localhost:${port}`);
    await new Promise((res) => viewerWs.on('open', res));
    viewerWs.send(JSON.stringify({ type: 'VIEWER_JOIN', roomCode: roomData.roomCode }));
    await new Promise<any>((res) => {
      viewerWs.once('message', (msg) => res(JSON.parse(msg.toString())));
    });

    let stateChangedReceived = false;
    viewerWs.on('message', (msg) => {
      const parsed = JSON.parse(msg.toString());
      if (parsed.type === 'STATE_CHANGED') {
        stateChangedReceived = true;
      }
    });

    // Send update with wrong hostToken
    hostWs.send(JSON.stringify({
      type: 'HOST_UPDATE_STATE',
      hostToken: 'wrong-token',
      status: 'running',
      durationMs: 10000,
      remainingMs: 9000,
      targetEndTime: Date.now() + 9000
    }));

    await new Promise((res) => setTimeout(res, 50));
    expect(stateChangedReceived).toBe(false);

    hostWs.close();
    viewerWs.close();
  });

  it('rejects HOST_UPDATE_STATE if sender is not host', async () => {
    const hostWs = new WebSocket(`ws://localhost:${port}`);
    await new Promise((res) => hostWs.on('open', res));

    hostWs.send(JSON.stringify({ type: 'HOST_CREATE_ROOM', durationMs: 10000, inputString: '10s' }));
    const roomData = await new Promise<any>((res) => {
      hostWs.once('message', (msg) => res(JSON.parse(msg.toString())));
    });

    const viewerWs = new WebSocket(`ws://localhost:${port}`);
    await new Promise((res) => viewerWs.on('open', res));
    viewerWs.send(JSON.stringify({ type: 'VIEWER_JOIN', roomCode: roomData.roomCode }));
    await new Promise<any>((res) => {
      viewerWs.once('message', (msg) => res(JSON.parse(msg.toString())));
    });

    let stateChangedReceived = false;
    hostWs.on('message', (msg) => {
      const parsed = JSON.parse(msg.toString());
      if (parsed.type === 'STATE_CHANGED') {
        stateChangedReceived = true;
      }
    });

    // Viewer sends HOST_UPDATE_STATE even if it knew the hostToken
    viewerWs.send(JSON.stringify({
      type: 'HOST_UPDATE_STATE',
      hostToken: roomData.hostToken,
      status: 'running',
      durationMs: 10000,
      remainingMs: 8000,
      targetEndTime: Date.now() + 8000
    }));

    await new Promise((res) => setTimeout(res, 50));
    expect(stateChangedReceived).toBe(false);

    hostWs.close();
    viewerWs.close();
  });

  it('responds with 200 ok on /health endpoint', async () => {
    const res = await fetch(`http://localhost:${port}/health`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ status: 'ok' });
  });

  it('cleans up room immediately when host closes connection without viewers', async () => {
    const hostWs = new WebSocket(`ws://localhost:${port}`);
    await new Promise((res) => hostWs.on('open', res));

    hostWs.send(JSON.stringify({ type: 'HOST_CREATE_ROOM', durationMs: 15000, inputString: '15s' }));
    const roomData = await new Promise<any>((res) => {
      hostWs.once('message', (msg) => res(JSON.parse(msg.toString())));
    });

    // Close host without any viewer joined
    hostWs.close();
    await new Promise((res) => setTimeout(res, 50));

    // Subsequent viewer attempt should fail
    const viewerWs = new WebSocket(`ws://localhost:${port}`);
    await new Promise((res) => viewerWs.on('open', res));
    viewerWs.send(JSON.stringify({ type: 'VIEWER_JOIN', roomCode: roomData.roomCode }));

    const errMsg = await new Promise<any>((res) => {
      viewerWs.once('message', (msg) => res(JSON.parse(msg.toString())));
    });
    expect(errMsg.type).toBe('ERROR');
    expect(errMsg.message).toBe('Room not found');

    viewerWs.close();
  });

  it('reaps inactive rooms past TTL via cleanInactiveRooms', async () => {
    const hostWs = new WebSocket(`ws://localhost:${port}`);
    await new Promise((res) => hostWs.on('open', res));

    hostWs.send(JSON.stringify({ type: 'HOST_CREATE_ROOM', durationMs: 20000, inputString: '20s' }));
    const roomData = await new Promise<any>((res) => {
      hostWs.once('message', (msg) => res(JSON.parse(msg.toString())));
    });

    const viewerWs = new WebSocket(`ws://localhost:${port}`);
    await new Promise((res) => viewerWs.on('open', res));
    viewerWs.send(JSON.stringify({ type: 'VIEWER_JOIN', roomCode: roomData.roomCode }));
    await new Promise<any>((res) => {
      viewerWs.once('message', (msg) => res(JSON.parse(msg.toString())));
    });

    // Host disconnects while viewer is still connected
    hostWs.close();
    await new Promise((res) => setTimeout(res, 50));

    // Retrieve roomManager from server
    const serverInstance = await createRelayServer(0);
    const rm = serverInstance.roomManager;
    // Test reaper method on roomManager directly
    const dummySocket = {} as any;
    const { roomCode } = rm.createRoom(dummySocket, 10000, '10s');
    const room = rm.getRoom(roomCode)!;
    room.disconnectedAt = Date.now() - 5000;
    const cleaned = rm.cleanInactiveRooms(1000);
    expect(cleaned).toBe(1);
    expect(rm.getRoom(roomCode)).toBeUndefined();

    await new Promise<void>((resolve) => serverInstance.httpServer.close(() => resolve()));
    viewerWs.close();
  });
});
