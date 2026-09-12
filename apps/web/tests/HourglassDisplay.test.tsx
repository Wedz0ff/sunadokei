import { describe, it, expect } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { HourglassDisplay } from '../src/components/HourglassDisplay';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('HourglassDisplay component', () => {
  it('renders formatted time and status badge', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        <HourglassDisplay
          formattedTime="01:40"
          progressPercent={75}
          status="Live"
        />
      );
    });

    const timeElement = container.querySelector('[data-testid="digital-time"]');
    expect(timeElement?.textContent).toBe('01:40');

    const statusElement = container.querySelector('[data-testid="status-badge"]');
    expect(statusElement?.textContent).toBe('Live');

    const drainBackground = container.querySelector('[data-testid="drain-background"]') as HTMLElement;
    expect(drainBackground.style.height).toBe('75%');

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('renders with 0% progress when finished', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        <HourglassDisplay
          formattedTime="00:00"
          progressPercent={0}
          status="Finished"
        />
      );
    });

    const drainBackground = container.querySelector('[data-testid="drain-background"]') as HTMLElement;
    expect(drainBackground.style.height).toBe('0%');

    const statusElement = container.querySelector('[data-testid="status-badge"]');
    expect(statusElement?.textContent).toBe('Finished');

    act(() => {
      root.unmount();
    });
    container.remove();
  });
});
