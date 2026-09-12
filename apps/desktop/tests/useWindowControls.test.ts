import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWindowControls } from '../src/hooks/useWindowControls.js';

describe('useWindowControls', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('initializes with default settings', () => {
    const { result } = renderHook(() => useWindowControls());
    expect(result.current.alwaysOnTop).toBe(false);
    expect(result.current.decorations).toBe(true);
    expect(result.current.clickThrough).toBe(false);
    expect(result.current.compact).toBe(false);
    expect(result.current.ultraCompact).toBe(false);
  });

  it('toggles always on top and saves to localStorage', () => {
    const { result } = renderHook(() => useWindowControls());

    act(() => {
      result.current.toggleAlwaysOnTop();
    });

    expect(result.current.alwaysOnTop).toBe(true);
    expect(localStorage.getItem('brachio_always_on_top')).toBe('true');
  });

  it('toggles decorations and saves to localStorage', () => {
    const { result } = renderHook(() => useWindowControls());

    act(() => {
      result.current.toggleDecorations();
    });

    expect(result.current.decorations).toBe(false);
    expect(localStorage.getItem('brachio_decorations')).toBe('false');
  });

  it('toggles compact mode and saves to localStorage', () => {
    const { result } = renderHook(() => useWindowControls());

    act(() => {
      result.current.toggleCompact();
    });

    expect(result.current.compact).toBe(true);
    expect(localStorage.getItem('brachio_compact')).toBe('true');
  });

  it('toggles ultra-compact mode and saves to localStorage', () => {
    const { result } = renderHook(() => useWindowControls());

    act(() => {
      result.current.toggleUltraCompact();
    });

    expect(result.current.ultraCompact).toBe(true);
    expect(result.current.compact).toBe(false);
    expect(localStorage.getItem('brachio_ultra_compact')).toBe('true');

    act(() => {
      result.current.toggleCompact();
    });

    expect(result.current.compact).toBe(true);
    expect(result.current.ultraCompact).toBe(false);
  });

  it('toggles click-through mode and ensures always-on-top is active while ghosted', () => {
    const { result } = renderHook(() => useWindowControls());

    act(() => {
      result.current.toggleClickThrough();
    });

    expect(result.current.clickThrough).toBe(true);
    // When click-through is active, alwaysOnTop must be true
    expect(result.current.alwaysOnTop).toBe(true);

    act(() => {
      result.current.toggleClickThrough();
    });

    expect(result.current.clickThrough).toBe(false);
  });

});
