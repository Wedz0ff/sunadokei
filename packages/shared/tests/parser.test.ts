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
    expect(parseTimeString('').valid).toBe(false);
    expect(parseTimeString('   ').valid).toBe(false);
    expect(parseTimeString('25h').valid).toBe(false);
    expect(parseTimeString('10s extra').valid).toBe(false);
  });

  it('handles boundary duration of 24h', () => {
    expect(parseTimeString('24h')).toEqual({ valid: true, durationMs: 86400000 });
  });
});

describe('formatDuration', () => {
  it('formats milliseconds to MM:SS or HH:MM:SS', () => {
    expect(formatDuration(100000)).toBe('01:40');
    expect(formatDuration(5400000)).toBe('01:30:00');
    expect(formatDuration(9000)).toBe('00:09');
    expect(formatDuration(0)).toBe('00:00');
  });

  it('supports forceHours parameter', () => {
    expect(formatDuration(100000, true)).toBe('00:01:40');
  });
});
