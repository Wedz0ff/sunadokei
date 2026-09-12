import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { App } from '../src/App';

// Mock WebSocket
class MockWebSocket {
  static instances: MockWebSocket[] = [];
  url: string;
  readyState = 0;
  sent: string[] = [];
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: ((err: unknown) => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  simulateOpen() {
    this.readyState = 1;
    if (this.onopen) this.onopen();
  }

  send(data: string) {
    this.sent.push(data);
  }

  close() {
    this.readyState = 3;
    if (this.onclose) this.onclose();
  }

  simulateMessage(data: unknown) {
    if (this.onmessage) {
      this.onmessage({ data: JSON.stringify(data) });
    }
  }
}

describe('App component', () => {
  const originalWebSocket = globalThis.WebSocket;

  beforeEach(() => {
    MockWebSocket.instances = [];
    (globalThis as unknown as { WebSocket: typeof MockWebSocket }).WebSocket = MockWebSocket;
    window.location.pathname = '/';
    window.location.search = '';
    window.location.hash = '';
  });

  afterEach(() => {
    (globalThis as unknown as { WebSocket: typeof originalWebSocket }).WebSocket = originalWebSocket;
  });

  it('renders landing page with room code input when no room in URL', () => {
    render(<App />);

    expect(screen.getByText('Brachio Hourglass Viewer')).toBeDefined();
    expect(screen.getByPlaceholderText('e.g. TRK-892')).toBeDefined();
    expect(screen.getByRole('button', { name: /join live viewer/i })).toBeDefined();
  });

  it('allows user to enter room code and join', () => {
    render(<App />);

    const input = screen.getByPlaceholderText('e.g. TRK-892');
    fireEvent.change(input, { target: { value: 'test99' } });

    const joinBtn = screen.getByRole('button', { name: /join live viewer/i });
    fireEvent.click(joinBtn);

    expect(screen.getByText(/ROOM:/i)).toBeDefined();
    expect(screen.getByText('TEST99')).toBeDefined();
  });

  it('renders active room viewer with controls and audio toggle', () => {
    window.location.pathname = '/join/ROOM42';
    render(<App />);

    expect(screen.getByText('ROOM42')).toBeDefined();
    expect(screen.getByText('Muted')).toBeDefined();

    const muteBtn = screen.getByRole('button', { name: /unmute alerts/i });
    fireEvent.click(muteBtn);

    expect(screen.getByText('Audio On')).toBeDefined();

    const leaveBtn = screen.getByRole('button', { name: /change room/i });
    fireEvent.click(leaveBtn);

    expect(screen.getByText('Brachio Hourglass Viewer')).toBeDefined();
  });
});
