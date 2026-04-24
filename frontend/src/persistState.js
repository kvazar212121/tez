export const STORAGE_KEY = 'taxi-free-v1';

export function loadPersistedState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (p.version !== 1) return null;
    return p;
  } catch {
    return null;
  }
}

export function savePersistedState(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, ...data }));
  } catch (e) {
    console.warn('persistState', e);
  }
}

export function clearPersistedState() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
