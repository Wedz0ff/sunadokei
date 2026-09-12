import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createRelayServer } from '../apps/server/src/server.js';
import { parseTimeString } from '../packages/shared/src/parser.js';
import ws from '../apps/server/node_modules/ws/index.js';
import type { Server } from 'http';

const WebSocket = (ws as any).WebSocket || ws || globalThis.WebSocket;

describe('End-to-End Timer Broadcast Synchronization', () => {
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

  it('verifies parser, room creation, hotkey reset update, and viewer reception', async () => {
    // 1. Time string parser (1min40s -> 100,000ms)
    const parsed = parseTimeString('1min40s');
    expect(parsed.durationMs).toBe(100000);
    expect(parsed.valid).toBe(true);

    // 2. Dynamic relay server (connection verified)
    const host = new WebSocket(`ws://localhost:${port}`);
    await new Promise((r) => host.on('open', r));

    // 3. Host creates room (HOST_CREATE_ROOM)
    host.send(JSON.stringify({
      type: 'HOST_CREATE_ROOM',
      durationMs: parsed.durationMs,
      inputString: '1min40s'
    }));

    const created = await new Promise<any>((r) => {
      host.once('message', (d) => r(JSON.parse(d.toString())));
    });

    expect(created.type).toBe('ROOM_CREATED');
    expect(created.roomCode).toBeTruthy();
    expect(created.hostToken).toBeTruthy();
    expect(created.shareUrl).toBe(`/join/${created.roomCode}`);

    // 4. Web viewer joins room (VIEWER_JOIN) and receives snapshot
    const viewer = new WebSocket(`ws://localhost:${port}`);
    await new Promise((r) => viewer.on('open', r));

    viewer.send(JSON.stringify({
      type: 'VIEWER_JOIN',
      roomCode: created.roomCode
    }));

    const snapshot = await new Promise<any>((r) => {
      viewer.once('message', (d) => r(JSON.parse(d.toString())));
    });

    expect(snapshot.type).toBe('ROOM_SNAPSHOT');
    expect(snapshot.snapshot.durationMs).toBe(100000);
    expect(snapshot.snapshot.remainingMs).toBe(100000);
    expect(snapshot.snapshot.status).toBe('idle');
    expect(snapshot.viewerCount).toBe(1);

    // 5. Viewer performs SYNC_PING and receives SYNC_PONG for clock offset
    const clientSendTime = Date.now();
    viewer.send(JSON.stringify({
      type: 'SYNC_PING',
      clientSendTime
    }));

    const pong = await new Promise<any>((r) => {
      viewer.once('message', (d) => r(JSON.parse(d.toString())));
    });

    expect(pong.type).toBe('SYNC_PONG');
    expect(pong.clientSendTime).toBe(clientSendTime);
    expect(typeof pong.serverTime).toBe('number');
    const rtt = Date.now() - pong.clientSendTime;
    const estimatedServerTime = pong.serverTime + rtt / 2;
    const clockOffset = estimatedServerTime - Date.now();
    expect(Number.isFinite(clockOffset)).toBe(true);

    // 6. Host simulates reset-and-restart hotkey (HOST_UPDATE_STATE)
    const targetEndTime = Date.now() + 100000;
    host.send(JSON.stringify({
      type: 'HOST_UPDATE_STATE',
      hostToken: created.hostToken,
      status: 'running',
      durationMs: 100000,
      remainingMs: 100000,
      targetEndTime
    }));

    const update = await new Promise<any>((r) => {
      viewer.once('message', (d) => r(JSON.parse(d.toString())));
    });

    expect(update.type).toBe('STATE_CHANGED');
    expect(update.status).toBe('running');
    expect(update.remainingMs).toBe(100000);
    expect(update.targetEndTime).toBe(targetEndTime);

    // 7. Graceful disconnect and room teardown
    const hostStatusPromise = new Promise<any>((r) => {
      viewer.once('message', (d) => r(JSON.parse(d.toString())));
    });

    host.close();

    const hostStatus = await hostStatusPromise;
    expect(hostStatus.type).toBe('HOST_STATUS');
    expect(hostStatus.online).toBe(false);

    viewer.close();
  });

  it('synchronizes multiple concurrent viewers and broadcasts live viewer count to host', async () => {
    const host = new WebSocket(`ws://localhost:${port}`);
    await new Promise((r) => host.on('open', r));

    host.send(JSON.stringify({
      type: 'HOST_CREATE_ROOM',
      durationMs: 60000,
      inputString: '1m'
    }));

    const created = await new Promise<any>((r) => {
      host.once('message', (d) => r(JSON.parse(d.toString())));
    });

    // Viewer 1 joins
    const countPromise1 = new Promise<any>((r) => {
      host.once('message', (d) => r(JSON.parse(d.toString())));
    });

    const viewer1 = new WebSocket(`ws://localhost:${port}`);
    await new Promise((r) => viewer1.on('open', r));
    viewer1.send(JSON.stringify({ type: 'VIEWER_JOIN', roomCode: created.roomCode }));

    await new Promise<any>((r) => viewer1.once('message', (d) => r(JSON.parse(d.toString()))));
    const count1 = await countPromise1;
    expect(count1.type).toBe('VIEWER_COUNT');
    expect(count1.count).toBe(1);

    // Viewer 2 joins
    const countPromise2 = new Promise<any>((r) => {
      host.once('message', (d) => r(JSON.parse(d.toString())));
    });

    const viewer2 = new WebSocket(`ws://localhost:${port}`);
    await new Promise((r) => viewer2.on('open', r));
    viewer2.send(JSON.stringify({ type: 'VIEWER_JOIN', roomCode: created.roomCode }));

    const snapshot2 = await new Promise<any>((r) => viewer2.once('message', (d) => r(JSON.parse(d.toString()))));
    expect(snapshot2.viewerCount).toBe(2);

    const count2 = await countPromise2;
    expect(count2.type).toBe('VIEWER_COUNT');
    expect(count2.count).toBe(2);

    // Host updates state - verify both viewers receive the update
    const update1Promise = new Promise<any>((r) => viewer1.once('message', (d) => r(JSON.parse(d.toString()))));
    const update2Promise = new Promise<any>((r) => viewer2.once('message', (d) => r(JSON.parse(d.toString()))));

    const targetEndTime = Date.now() + 50000;
    host.send(JSON.stringify({
      type: 'HOST_UPDATE_STATE',
      hostToken: created.hostToken,
      status: 'running',
      durationMs: 60000,
      remainingMs: 50000,
      targetEndTime
    }));

    const [u1, u2] = await Promise.all([update1Promise, update2Promise]);
    expect(u1.type).toBe('STATE_CHANGED');
    expect(u1.status).toBe('running');
    expect(u1.remainingMs).toBe(50000);
    expect(u2.type).toBe('STATE_CHANGED');
    expect(u2.status).toBe('running');
    expect(u2.remainingMs).toBe(50000);

    // Viewer 2 leaves - verify host viewer count drops to 1
    const countPromise3 = new Promise<any>((r) => {
      host.once('message', (d) => r(JSON.parse(d.toString())));
    });
    viewer2.close();

    const count3 = await countPromise3;
    expect(count3.type).toBe('VIEWER_COUNT');
    expect(count3.count).toBe(1);

    host.close();
    viewer1.close();
  });

  it('broadcasts TIMER_FINISHED to all viewers when countdown completes', async () => {
    const host = new WebSocket(`ws://localhost:${port}`);
    await new Promise((r) => host.on('open', r));

    host.send(JSON.stringify({
      type: 'HOST_CREATE_ROOM',
      durationMs: 5000,
      inputString: '5s'
    }));

    const created = await new Promise<any>((r) => {
      host.once('message', (d) => r(JSON.parse(d.toString())));
    });

    const viewer = new WebSocket(`ws://localhost:${port}`);
    await new Promise((r) => viewer.on('open', r));
    viewer.send(JSON.stringify({ type: 'VIEWER_JOIN', roomCode: created.roomCode }));
    // Drain snapshot
    await new Promise<any>((r) => viewer.once('message', (d) => r(JSON.parse(d.toString()))));

    const messagesReceived: any[] = [];
    viewer.on('message', (d) => {
      messagesReceived.push(JSON.parse(d.toString()));
    });

    host.send(JSON.stringify({
      type: 'HOST_UPDATE_STATE',
      hostToken: created.hostToken,
      status: 'finished',
      durationMs: 5000,
      remainingMs: 0,
      targetEndTime: null
    }));

    await new Promise((r) => setTimeout(r, 60));

    expect(messagesReceived.some((m) => m.type === 'STATE_CHANGED' && m.status === 'finished')).toBe(true);
    expect(messagesReceived.some((m) => m.type === 'TIMER_FINISHED')).toBe(true);

    host.close();
    viewer.close();
  });

  it('handles explicit room teardown via HOST_CLOSE_ROOM and prevents subsequent joins', async () => {
    const host = new WebSocket(`ws://localhost:${port}`);
    await new Promise((r) => host.on('open', r));

    host.send(JSON.stringify({
      type: 'HOST_CREATE_ROOM',
      durationMs: 15000,
      inputString: '15s'
    }));

    const created = await new Promise<any>((r) => {
      host.once('message', (d) => r(JSON.parse(d.toString())));
    });

    const viewer = new WebSocket(`ws://localhost:${port}`);
    await new Promise((r) => viewer.on('open', r));
    viewer.send(JSON.stringify({ type: 'VIEWER_JOIN', roomCode: created.roomCode }));
    await new Promise<any>((r) => viewer.once('message', (d) => r(JSON.parse(d.toString()))));

    const hostStatusPromise = new Promise<any>((r) => {
      viewer.once('message', (d) => r(JSON.parse(d.toString())));
    });

    // Host explicitly closes room
    host.send(JSON.stringify({
      type: 'HOST_CLOSE_ROOM',
      hostToken: created.hostToken
    }));

    const hostStatus = await hostStatusPromise;
    expect(hostStatus.type).toBe('HOST_STATUS');
    expect(hostStatus.online).toBe(false);

    // Another viewer attempts to join the closed room
    const lateViewer = new WebSocket(`ws://localhost:${port}`);
    await new Promise((r) => lateViewer.on('open', r));
    lateViewer.send(JSON.stringify({ type: 'VIEWER_JOIN', roomCode: created.roomCode }));

    const errorMsg = await new Promise<any>((r) => {
      lateViewer.once('message', (d) => r(JSON.parse(d.toString())));
    });

    expect(errorMsg.type).toBe('ERROR');
    expect(errorMsg.message).toBe('Room not found');

    host.close();
    viewer.close();
    lateViewer.close();
  });
});
