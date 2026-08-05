// ── Foundry VTT bridge — fire-and-forget LAN notifier ───────────────────────
// Separate from firebase-db.js on purpose: different destination, different
// contract. notifyBridge() must NEVER throw or block its caller — the Foundry
// integration is a nice-to-have layered on top of the real game state writes,
// and a dead/unreachable bridge on the desktop PC must be invisible to the GM
// console's core flow.

const STORAGE_KEY = 'fc99.foundryBridge';

/**
 * @returns {{ url: string, enabled: boolean }}
 */
export function getBridgeConfig() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { url: '', enabled: false };
    const parsed = JSON.parse(raw);
    return {
      url: typeof parsed.url === 'string' ? parsed.url : '',
      enabled: !!parsed.enabled,
    };
  } catch {
    return { url: '', enabled: false };
  }
}

/**
 * @param {{ url: string, enabled: boolean }} config
 */
export function setBridgeConfig(config) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ url: config.url || '', enabled: !!config.enabled }),
    );
  } catch {
    // localStorage unavailable — nothing we can do, config just won't persist.
  }
}

function trimTrailingSlash(url) {
  return url.replace(/\/+$/, '');
}

/**
 * Fire-and-forget notify. Safe to call without awaiting; never throws.
 * No-ops silently if the bridge isn't configured/enabled.
 *
 * @param {string} type - e.g. 'call.incoming'
 * @param {object} payload
 */
export async function notifyBridge(type, payload) {
  const { url, enabled } = getBridgeConfig();
  if (!enabled || !url) return;

  try {
    await fetch(`${trimTrailingSlash(url)}/event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, ts: Date.now(), payload }),
      signal: AbortSignal.timeout(1500),
    });
  } catch (err) {
    console.warn('[foundry-bridge] notify failed:', err?.message || err);
  }
}

/**
 * @param {string} url
 * @returns {Promise<{ ok: boolean, foundryConnected?: boolean, error?: string }>}
 */
export async function testBridgeConnection(url) {
  if (!url) return { ok: false, error: 'No URL configured.' };

  try {
    const res = await fetch(`${trimTrailingSlash(url)}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(800),
    });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    const data = await res.json();
    return { ok: true, foundryConnected: !!data.foundryConnected };
  } catch (err) {
    return { ok: false, error: err?.message || 'Unreachable' };
  }
}
