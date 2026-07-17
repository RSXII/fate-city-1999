// ── Shared utilities ─────────────────────────────────────────────────────────
// Centralised helpers previously copy-pasted into every HTML page.

const CODENAME_KEY = "wire-codename";
const DEVICE_ID_KEY = "wire-device-id";

/**
 * Returns this device's persistent UUID, generating one on first call.
 * Stored in localStorage — stable for the lifetime of the browser profile.
 */
export function getDeviceId() {
  try {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  } catch {
    return "unknown";
  }
}

/** Returns the stored operative codename, or null if not yet set. */
export function getCodename() {
  try {
    return localStorage.getItem(CODENAME_KEY) || null;
  } catch {
    return null;
  }
}

/** Persists the operative codename to localStorage. */
export function setCodename(name) {
  try {
    localStorage.setItem(CODENAME_KEY, name.trim());
  } catch {
    /* storage unavailable */
  }
}

/** Overwrites the stored device ID — used by the Jack In recovery flow. */
export function setDeviceId(id) {
  try {
    localStorage.setItem(DEVICE_ID_KEY, id);
  } catch {
    /* storage unavailable */
  }
}

/**
 * Safely HTML-escape a value for use inside element text content.
 */
export function escapeHtml(s) {
  var d = document.createElement("div");
  d.textContent = s == null ? "" : String(s);
  return d.innerHTML;
}

/**
 * Safely escape a value for use inside an HTML attribute (double-quoted).
 */
export function escapeAttr(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Human-readable relative time from a Unix-ms timestamp.
 */
export function relTime(ts) {
  var diff = Math.max(0, Date.now() - ts);
  var s = Math.floor(diff / 1000);
  if (s < 10) return "now";
  if (s < 60) return s + "s ago";
  var m = Math.floor(s / 60);
  if (m < 60) return m + "m ago";
  var h = Math.floor(m / 60);
  if (h < 24) return h + "h ago";
  return Math.floor(h / 24) + "d ago";
}

/**
 * Firebase stores pushed arrays as numeric-keyed objects — normalise them back
 * to a plain array sorted by insertion order.
 */
export function normMessages(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  return Object.keys(raw)
    .sort(function (a, b) {
      return parseInt(a, 10) - parseInt(b, 10);
    })
    .map(function (k) {
      return raw[k];
    });
}

/**
 * Drop-in replacement for setInterval that automatically pauses when the
 * browser tab is hidden and resumes (with an immediate catch-up call) when it
 * becomes visible again.  Saves Firebase quota and battery on backgrounded
 * devices.
 *
 * @param {Function} fn - The function to call on each tick.
 * @param {number} ms   - Interval in milliseconds.
 * @returns {Function}  - A stop() function; call it in onDestroy.
 */
export function visibilityAwareInterval(fn, ms) {
  var id = setInterval(fn, ms);
  function onVisibility() {
    if (document.hidden) {
      clearInterval(id);
      id = null;
    } else {
      fn(); // immediate catch-up fetch on resume
      id = setInterval(fn, ms);
    }
  }
  document.addEventListener("visibilitychange", onVisibility);
  return function stop() {
    clearInterval(id);
    document.removeEventListener("visibilitychange", onVisibility);
  };
}
