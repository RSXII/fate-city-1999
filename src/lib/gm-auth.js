// ── GM PIN gate ────────────────────────────────────────────────────────────
// Single shared passphrase protecting every GM-only surface (the desktop
// console, and GM mode inside the normal Wire messages view). One source of
// truth so the PIN only has to change in one place.

export const GM_PIN = 'fc99-ops'; // change this to your preferred passphrase
const AUTH_KEY = 'gm-auth-7e4f';

/** True if this browser already unlocked a GM surface before. */
export function isGmAuthenticated() {
  try {
    return localStorage.getItem(AUTH_KEY) === GM_PIN;
  } catch {
    return false;
  }
}

/** Persists a successful PIN entry so future visits skip the gate. */
export function setGmAuthenticated() {
  try {
    localStorage.setItem(AUTH_KEY, GM_PIN);
  } catch {
    /* storage unavailable */
  }
}

/** Drops GM mode on this device — back to the normal player experience. */
export function clearGmAuthenticated() {
  try {
    localStorage.removeItem(AUTH_KEY);
  } catch {
    /* storage unavailable */
  }
}
