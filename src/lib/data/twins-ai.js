// Twins AI device takeover — shared constants and helpers.
//
// RTDB shape at path `twinsTakeover`:
//   { [codenameKey]: { active, codename, seizedAt, intrusion: null | { startedAt, handle, deadlineMs } } }
//
// One shared cap constant and one pure count getter, read by both the GM
// console's roster UI and the phone's own meter simulation, so neither can
// drift from the other.

export const TAKEOVER_CAP = 4;

/** Firebase RTDB keys can't contain `. # $ [ ]` — sanitize a codename into a safe map key. */
export function codenameKey(codename) {
  return (codename || '')
    .trim()
    .toUpperCase()
    .replace(/[.#$[\]]/g, '_');
}

/** Count of currently-active takeovers in a raw `twinsTakeover` roster map. */
export function countActiveTakeovers(data) {
  return Object.values(data ?? {}).filter((v) => v?.active).length;
}

// ── Terminal commands ────────────────────────────────────────────────────
// PLACEHOLDER commands — a minimal, clearly reskinnable scaffold rather than
// invented Fate City netrunner lore. `help`/`status` are flavor/no-ops;
// `purge <HANDLE>` is the one meaningful command, resolving an active
// intrusion when its argument matches `entry.intrusion.handle`.
//
// Each handler receives (ctx, args) and returns either a plain string
// (printed as the command result) or { text, resolve: true } to signal
// that the caller should clear the active intrusion.
export const COMMANDS = new Map([
  ['help', {
    run: () => 'AVAILABLE: HELP, STATUS, PURGE <HANDLE>',
  }],
  ['status', {
    run: (ctx) => `LINK ACTIVE — ${ctx.codename ?? 'UNKNOWN'} — ${ctx.intrusion ? 'INTRUSION ACTIVE' : 'NOMINAL'}`,
  }],
  ['purge', {
    run: (ctx, args) => {
      if (!ctx.intrusion) return 'NO ACTIVE INTRUSION.';
      if (args[0]?.toUpperCase() === ctx.intrusion.handle?.toUpperCase()) {
        return { text: 'ROOT PURGED — CONTROL RESTORED', resolve: true };
      }
      return 'PURGE FAILED — INVALID TARGET';
    },
  }],
]);
