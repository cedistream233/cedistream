// Accepts a number (seconds) or a string like "M:SS" or "H:MM:SS" and
// returns a formatted duration string.
// By default returns H:MM:SS when >= 1 hour, otherwise M:SS.
// If options.human === true it returns a compact human readable form like "1h 30m" or "3m 05s".
export default function formatDuration(value, options = {}) {
  const { human = false } = options || {};

  // Normalize input to seconds (number). If it's already a number, use it.
  let seconds = null;
  if (typeof value === 'number' && isFinite(value)) {
    seconds = Math.max(0, Math.floor(value));
  } else if (typeof value === 'string') {
    // Accept strings like "3:45" (M:SS) or "1:02:30" (H:MM:SS)
    const parts = value.split(':').map(p => Number(p));
    if (parts.every(p => Number.isFinite(p))) {
      if (parts.length === 1) seconds = Math.max(0, Math.floor(parts[0]));
      else if (parts.length === 2) seconds = Math.max(0, parts[0] * 60 + parts[1]);
      else if (parts.length === 3) seconds = Math.max(0, parts[0] * 3600 + parts[1] * 60 + parts[2]);
    }
  }

  if (!Number.isFinite(seconds)) return '0:00';

  if (human) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) {
      if (m === 0) return `${h}h`;
      return `${h}h ${m}m`;
    }
    if (m > 0) {
      if (s === 0) return `${m}m`;
      return `${m}m ${s}s`;
    }
    return `${s}s`;
  }

  // Default: H:MM:SS for >= 1 hour, otherwise M:SS
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}
