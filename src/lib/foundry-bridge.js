// ── Foundry VTT bridge — fire-and-forget LAN notifier ───────────────────────
// Separate from firebase-db.js on purpose: different destination, different
// contract. notifyBridge() must NEVER throw or block its caller — the Foundry
// integration is a nice-to-have layered on top of the real game state writes,
// and a dead/unreachable bridge on the desktop PC must be invisible to the GM
// console's core flow.

import { base } from '$app/paths';

const STORAGE_KEY = 'fc99.foundryBridge';

// The source art in static/images/wire-profiles/ is full-resolution
// portrait/promo art, not pre-optimized for this — several hundred KB to
// multiple MB each (fcpd_wire.png alone is 3MB). The bridge's /event
// endpoint caps request bodies at 1MB total (see bridge/server.js), so
// embedding one of these as-is wouldn't just make a slow request, it would
// silently drop the *entire* call.incoming event, portrait and all. This is
// why toDataUrl() downscales and re-encodes rather than just reading the
// file — a plain fetch+base64 of the raw asset isn't viable here.
const MAX_AVATAR_DIMENSION = 480; // long edge, px — the call card only ever renders this at 260x360 CSS px, so this comfortably covers even a 2x-DPI display
const AVATAR_JPEG_QUALITY = 0.82;
const MAX_DATA_URL_CHARS = 400_000; // safety net after resizing — real headroom under the bridge's 1MB cap for the rest of the envelope

/**
 * Fetches a same-origin static asset (e.g. a contact avatar), downscales
 * and re-encodes it, and returns it as a base64 data URL — so the event
 * payload carries a right-sized copy of the image itself, not a link to
 * one and not the multi-megabyte source file untouched.
 *
 * Replaces an earlier approach (`toPublicAssetUrl`) that linked to this
 * app's GitHub Pages deployment instead — that depended on the Foundry
 * machine having internet access *and* that deployment being up to date
 * with whatever avatar was just picked, which contradicts this whole
 * bridge being intentionally LAN-only (see bridge/README.md: "No auth —
 * this is intentionally LAN-only"). Fetching same-origin means this works
 * identically whether the console is running via `npm run dev` or the
 * built site, online or fully offline, since it's just reading whatever
 * asset the console itself already has loaded/servable — no dependency on
 * a public deployment existing or being current.
 *
 * Re-encodes to JPEG regardless of the source format — the source art here
 * is photographic portraits, not icons with transparency to preserve, and
 * JPEG compresses that kind of content far better than PNG does, which is
 * the whole point of this step.
 *
 * @param {string|null|undefined} relativePath - e.g. 'images/wire-profiles/foo.png'
 * @returns {Promise<string|null>}
 */
export async function toDataUrl(relativePath) {
  if (!relativePath) return null;

  try {
    const res = await fetch(`${base}/${relativePath.replace(/^\/+/, '')}`);
    if (!res.ok) return null;
    const blob = await res.blob();

    const bitmap = await createImageBitmap(blob);
    const scale = Math.min(1, MAX_AVATAR_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.getContext('2d').drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();

    const dataUrl = canvas.toDataURL('image/jpeg', AVATAR_JPEG_QUALITY);
    if (dataUrl.length > MAX_DATA_URL_CHARS) {
      console.warn(
        `[foundry-bridge] avatar still too large after resize (${dataUrl.length} chars, max ${MAX_DATA_URL_CHARS}): ${relativePath}`,
      );
      return null;
    }
    return dataUrl;
  } catch (err) {
    console.warn('[foundry-bridge] toDataUrl failed:', err?.message || err);
    return null;
  }
}

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
