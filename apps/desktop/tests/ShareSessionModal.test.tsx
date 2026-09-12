import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ShareSessionModal } from '../src/components/ShareSessionModal';

describe('ShareSessionModal component', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    isLive: false,
    roomCode: null,
    viewerCount: 0,
    onStartLive: vi.fn(),
    onStopLive: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when isOpen is false', () => {
    const { container } = render(<ShareSessionModal {...defaultProps} isOpen={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders start session view when not live', () => {
    render(<ShareSessionModal {...defaultProps} />);

    expect(screen.getByText('Live Session Sharing')).toBeDefined();
    expect(
      screen.getByText(/Open a live session so remote viewers can watch your countdown/i)
    ).toBeDefined();

    const startButton = screen.getByRole('button', { name: /Start Live Room/i });
    fireEvent.click(startButton);
    expect(defaultProps.onStartLive).toHaveBeenCalledTimes(1);

    const closeButton = screen.getByRole('button', { name: /Close/i });
    fireEvent.click(closeButton);
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('renders live session details when live', () => {
    render(
      <ShareSessionModal
        {...defaultProps}
        isLive={true}
        roomCode="TEST99"
        viewerCount={4}
      />
    );

    expect(screen.getByText('TEST99')).toBeDefined();
    expect(screen.getByText('4 viewers')).toBeDefined();

    const input = screen.getByDisplayValue('http://localhost:5173/join/TEST99');
    expect(input).toBeDefined();

    const stopButton = screen.getByRole('button', { name: /Stop Live Session/i });
    fireEvent.click(stopButton);
    expect(defaultProps.onStopLive).toHaveBeenCalledTimes(1);
  });

  it('copies shareable URL to clipboard when Copy button is clicked', () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextMock },
      configurable: true,
      writable: true
    });

    render(
      <ShareSessionModal
        {...defaultProps}
        isLive={true}
        roomCode="TEST99"
        viewerCount={1}
      />
    );

    expect(screen.getByText('1 viewer')).toBeDefined();

    const copyButton = screen.getByRole('button', { name: /Copy/i });
    fireEvent.click(copyButton);

    expect(writeTextMock).toHaveBeenCalledWith('http://localhost:5173/join/TEST99');
    expect(screen.getByText('Copied')).toBeDefined();
  });

  it('closes modal when Escape key is pressed', () => {
    render(<ShareSessionModal {...defaultProps} />);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });
});
