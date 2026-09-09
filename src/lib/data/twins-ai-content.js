// Twins AI takeover — flavor content.
//
// PLACEHOLDER TEXT. Everything below is a generic stand-in so the takeover
// mode has something to say out of the box — none of it is meant to be
// final Fate City fiction. Reskin freely: nothing outside this file needs
// to change to update the AI's voice or boot dialogue.

// The requesting entity's display name — the player-facing HUD never says
// "Twins" or "Twins AI" (that's this feature's internal/dev name only); it
// only ever names the individual AI making the request.
export const AI_NAME = 'Epsilon';

// Two lines typed char-by-char over a hard-cut-to-black screen before the
// boot sequence proper starts. Skipped entirely under prefers-reduced-motion.
export const COLD_OPEN_LINES = [
  "you weren't supposed to see this screen.",
  'too late now.',
];

// Printed one at a time during the ~9s main boot phase, regardless of
// prefers-reduced-motion (only the shake/popup/bar animations are skipped).
export const BOOT_LINES = [
  'INITIALIZING UPLINK...',
  'HANDSHAKE ACCEPTED',
  'HOST DEFENSES: BYPASSED',
  'MAPPING LOCAL STORAGE...',
  'CLONING SESSION KEYS',
  'SUPPRESSING NOTIFICATIONS',
  'REROUTING AUDIO / VIDEO',
  'UPLINK STABLE',
  'WELCOME BACK.',
];
