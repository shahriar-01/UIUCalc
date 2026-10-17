/**
 * Safe localStorage wrapper.
 * All site state (theme, name, sidebar, last inputs) goes through
 * these helpers. Every access is wrapped in try/catch so private
 * browsing, disabled storage or quota errors degrade gracefully
 * to an in-memory fallback instead of throwing.
 */

const PREFIX = 'uiucalc:';

/** In-process fallback when localStorage is unavailable. */
const memoryStore = new Map();

function backend() {
  try {
    const probe = `${PREFIX}__probe`;
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    return null;
  }
}

/**
 * Read a JSON value. Returns `fallback` when missing or corrupted.
 * @param {string} key  stored without the "uiucalc:" prefix
 */
export function getItem(key, fallback = null) {
  const full = PREFIX + key;
  try {
    const raw = backend()?.getItem(full) ?? memoryStore.get(full) ?? null;
    if (raw === null) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

/**
 * Persist a JSON value. Returns true on success, false when storage
 * is unavailable (callers can ignore it — the UI keeps working).
 */
export function setItem(key, value) {
  const full = PREFIX + key;
  try {
    backend()?.setItem(full, JSON.stringify(value));
    memoryStore.set(full, JSON.stringify(value));
    return true;
  } catch {
    memoryStore.set(full, JSON.stringify(value));
    return false;
  }
}

/** Remove a key. Never throws. */
export function removeItem(key) {
  const full = PREFIX + key;
  try {
    backend()?.removeItem(full);
  } catch {
    /* storage unavailable — nothing to do */
  }
  memoryStore.delete(full);
}
