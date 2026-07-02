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
 */
export async function dbGet(path) {
  try {
    const res = await fetch(`${FIREBASE_URL}/${path}.json`);
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
 * DELETE  /path.json
 * Throws on non-2xx.
 */
export async function dbDelete(path) {
  const res = await fetch(`${FIREBASE_URL}/${path}.json`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}
