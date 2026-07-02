// ── Shared utilities ─────────────────────────────────────────────────────────
// Centralised helpers previously copy-pasted into every HTML page.

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
