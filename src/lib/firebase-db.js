// ── Firebase connection — single source of truth ────────────────────────────
// All pages that talk to Firebase import from here instead of declaring their
// own constants.  REST helpers return null / throw so callers can stay clean.

export const FIREBASE_URL =
  "https://cpr-wire-device-default-rtdb.firebaseio.com";

export const FIREBASE_CONFIG = {
  apiKey: "AIzaSyA7OmVO18bOequMLYUieWGhVabB4_vTlOs",
  authDomain: "cpr-wire-device.firebaseapp.com",
  databaseURL: "https://cpr-wire-device-default-rtdb.firebaseio.com",
  projectId: "cpr-wire-device",
  storageBucket: "cpr-wire-device.firebasestorage.app",
  messagingSenderId: "435892659027",
  appId: "1:435892659027:web:dbdffda17e128484a437a6",
};

export const VAPID_KEY =
  "BFefOJuvufeaGGn5xFw1459T68qdlzHRiaAm09QHQPOKieibhCmLPgSZAZvaahUva765ROwxya_hpRj8qblXVpo";

// ── REST helpers ─────────────────────────────────────────────────────────────

/**
 * GET  /path.json
 * Returns parsed JSON or null on any error (network or non-2xx).
 * Callers don't need a try-catch for the happy path.
 *
 * @param {string} path - Firebase database path (no leading slash).
 * @param {{ orderBy?: string, limitToLast?: number }} [opts] - Optional query
 *   params for the Firebase REST API.  Use `orderBy: '$key'` (auto-indexed, no
 *   rules change needed) to limit large collections by push order, which is
 *   chronologically equivalent to ordering by `ts` since all records use
 *   `ts: Date.now()` at push time.  `limitToLast` caps the number of results.
 */
export async function dbGet(path, opts = {}) {
  try {
    let url = `${FIREBASE_URL}/${path}.json`;
    if (opts.orderBy || opts.limitToLast) {
      const params = new URLSearchParams();
      if (opts.orderBy) params.set("orderBy", `"${opts.orderBy}"`);
      if (opts.limitToLast) params.set("limitToLast", String(opts.limitToLast));
      url += "?" + params.toString();
    }
    const res = await fetch(url);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

/**
 * POST  /path.json  with JSON body.
 * Returns parsed response JSON.  Throws on non-2xx.
 */
export async function dbPost(path, data) {
  const res = await fetch(`${FIREBASE_URL}/${path}.json`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/**
 * PUT  /path.json  with JSON body — replaces the value at that path.
 * Returns parsed response JSON.  Throws on non-2xx.
 */
export async function dbPut(path, data) {
  const res = await fetch(`${FIREBASE_URL}/${path}.json`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/**
 * PATCH  /path.json  with JSON body — merges fields without overwriting siblings.
 * Returns parsed response JSON.  Throws on non-2xx.
 */
export async function dbPatch(path, data) {
  const res = await fetch(`${FIREBASE_URL}/${path}.json`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/**
 * DELETE  /path.json
 * Throws on non-2xx.
 */
export async function dbDelete(path) {
  const res = await fetch(`${FIREBASE_URL}/${path}.json`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}
