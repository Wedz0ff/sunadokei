export interface ParseResult {
  valid: boolean;
  durationMs: number;
  error?: string;
}

export function parseTimeString(input: string): ParseResult {
  const clean = input.trim().toLowerCase();
  if (!clean) {
    return { valid: false, durationMs: 0, error: 'Empty input' };
  }

  // Check digital format HH:MM:SS or MM:SS
  const digitalMatch = clean.match(/^(\d+):([0-5]?\d)(?::([0-5]?\d))?$/);
  if (digitalMatch) {
    if (digitalMatch[3] !== undefined) {
      const hours = parseInt(digitalMatch[1], 10);
      const minutes = parseInt(digitalMatch[2], 10);
      const seconds = parseInt(digitalMatch[3], 10);
      const totalMs = (hours * 3600 + minutes * 60 + seconds) * 1000;
      return validateDuration(totalMs);
    } else {
      const minutes = parseInt(digitalMatch[1], 10);
      const seconds = parseInt(digitalMatch[2], 10);
      const totalMs = (minutes * 60 + seconds) * 1000;
      return validateDuration(totalMs);
    }
  }

  // Reject negative values
  if (clean.includes('-')) {
    return { valid: false, durationMs: 0, error: 'Negative values are not allowed' };
  }

  // Natural language units: e.g. "1h30m", "1min40s", "100s", "1.5m"
  const unitRegex = /(?:(\d+(?:\.\d+)?)\s*(hours?|hr|h))|(?:(\d+(?:\.\d+)?)\s*(minutes?|mins?|m))|(?:(\d+(?:\.\d+)?)\s*(seconds?|secs?|s))/g;
  
  // Check that only valid units and whitespace exist
  const remainder = clean.replace(unitRegex, '').trim();
  if (remainder.length > 0) {
    return { valid: false, durationMs: 0, error: 'Unrecognized time format' };
  }

  let totalMs = 0;
  let matches = 0;
  let match: RegExpExecArray | null;

  // Reset regex index for matching
  unitRegex.lastIndex = 0;
  while ((match = unitRegex.exec(clean)) !== null) {
    matches++;
    if (match[1]) totalMs += parseFloat(match[1]) * 3600 * 1000;
    if (match[3]) totalMs += parseFloat(match[3]) * 60 * 1000;
    if (match[5]) totalMs += parseFloat(match[5]) * 1000;
  }

  if (matches === 0) {
    return { valid: false, durationMs: 0, error: 'Unrecognized time format' };
  }

  return validateDuration(Math.round(totalMs));
}

function validateDuration(ms: number): ParseResult {
  if (ms <= 0) {
    return { valid: false, durationMs: 0, error: 'Duration must be greater than 0 seconds' };
  }
  if (ms > 86400000) {
    return { valid: false, durationMs: 0, error: 'Duration cannot exceed 24 hours' };
  }
  return { valid: true, durationMs: ms };
}

export function formatDuration(ms: number, forceHours = false): string {
  const totalSeconds = Math.ceil(Math.max(0, ms) / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const pad = (n: number) => n.toString().padStart(2, '0');

  if (hours > 0 || forceHours) {
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${pad(minutes)}:${pad(seconds)}`;
}
