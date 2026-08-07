// Fate City 1999 — Foundry bridge module
//
// Connects out to the local bridge service (see ../../bridge) over
// WebSocket and turns incoming events into chat messages. Only the GM
// client connects, to avoid every connected player tab posting duplicates.

const MODULE_ID = 'fc99-bridge';

const RECONNECT_MIN_MS = 1000;
const RECONNECT_MAX_MS = 30000;

// Per-type chat formatters. Add a key here for each new event type as it's
// wired up on the bridge side — everything else (connect/reconnect/dispatch)
// stays the same. Unknown types fall back to a generic message below.
const FORMATTERS = {
  'call.incoming': (payload) => {
    const caller = payload.callerName ?? 'Unknown';
    const subtitle = payload.callerSubtitle ? ` — ${payload.callerSubtitle}` : '';
    const target = payload.targetCodename ?? '?';
    return `📞 Incoming call: <b>${caller}</b>${subtitle} → ${target}`;
  },

  'wire.deployed': (payload) => {
    const from = payload.sender ?? 'Unknown';
    const group = payload.groupName ? ` (${payload.groupName})` : '';
    const photo = payload.hasImage ? ' 📷' : '';
    return `💬 Wire message from <b>${from}</b>${group}${photo}`;
  },

  'once.deployed': (payload) => {
    const preview = payload.preview ? `: “${payload.preview}”` : '';
    return `📡 O.N.C.E. transmission from M${preview}`;
  },

  'timer.started': (payload) => {
    const mins = payload.durationSec != null ? Math.round(payload.durationSec / 60) : null;
    return `⏱️ Countdown started${mins != null ? ` — ${mins} min` : ''}`;
  },

  'timer.extended': (payload) => {
    const secs = payload.addedSec ?? null;
    return `⏱️ Countdown extended${secs != null ? ` +${secs}s` : ''}`;
  },

  'timer.stopped': () => `⏱️ Countdown cleared`,

  'calendar.changed': (payload) => {
    const { monthName, day, year } = payload;
    return `📅 Date changed: <b>${monthName ?? '?'} ${day ?? '?'}, ${year ?? '?'}</b>`;
  },

  'contact.added': (payload) => {
    const name = payload.name ?? 'Unknown';
    const subtitle = payload.subtitle ? ` — ${payload.subtitle}` : '';
    return `👤 New contact added: <b>${name}</b>${subtitle}`;
  },

  'job.deployed': (payload) => {
    const title = payload.title ?? 'Untitled job';
    const fileNo = payload.fileNo ? ` [${payload.fileNo}]` : '';
    return `📋 Job posted: <b>${title}</b>${fileNo}`;
  },

  'email.deployed': (payload) => {
    const kind = payload.type ? payload.type[0].toUpperCase() + payload.type.slice(1) : 'Message';
    const subject = payload.subject ?? '(no subject)';
    return `📧 New ${kind}: <b>${subject}</b>`;
  },

  'briefing.deployed': (payload) => {
    const label = payload.sectionLabel ?? payload.section ?? 'Briefing';
    const name = payload.name ?? 'Untitled';
    const fileNo = payload.fileNo ? ` [${payload.fileNo}]` : '';
    return `🗂️ ${label} file added: <b>${name}</b>${fileNo}`;
  },
};

// Per-type audience extractors. Returns an array of codenames the event is
// meant for, or null for "everyone" (a normal public chat message). Only
// types that already carry recipient info in their payload need an entry —
// everything else defaults to public.
const AUDIENCE = {
  'call.incoming': (payload) => (payload.targetCodename ? [payload.targetCodename] : null),
  'wire.deployed': (payload) => (payload.recipients?.length ? payload.recipients : null),
};

// Matches codenames to connected Foundry Users by display name, on the
// convention that a player's Foundry name starts with their codename (e.g.
// Foundry user "Mirae (deez/nuts)" for codename "MIRAE"). Codenames that
// don't match any user are dropped silently (logged) rather than falling
// back to public — better a message goes missing than leaks to the table.
function resolveWhisperIds(codenames) {
  const ids = new Set();
  for (const codename of codenames) {
    const needle = String(codename ?? '').trim().toLowerCase();
    if (!needle) continue;
    const match = game.users.contents.find((u) => u.name.toLowerCase().startsWith(needle));
    if (match) {
      ids.add(match.id);
    } else {
      console.warn(`[${MODULE_ID}] no Foundry user matches codename "${codename}" — whispering to GM only`);
    }
  }
  return Array.from(ids);
}

function formatEnvelope(envelope) {
  const { type, payload } = envelope;
  const formatter = FORMATTERS[type];
  if (formatter) {
    try {
      return formatter(payload ?? {});
    } catch (err) {
      console.warn(`[${MODULE_ID}] formatter for "${type}" threw:`, err);
    }
  }
  return `<b>${type}</b><br>${JSON.stringify(payload ?? {})}`;
}

// Mirrors the Wire app's own initials() (src/routes/messages/+page.svelte) so
// a sender without an avatar image gets the same two-letter badge in Foundry
// as they'd show in the phone UI.
function initials(name) {
  const clean = String(name ?? '').replace(/^The\s+/i, '').replace(/\./g, '');
  const parts = clean.split(/[\s-]+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

// Mirrors the Wire app's hexToRgba() — used to tint a sender's own contact
// color onto the toast avatar the same way contact bubbles are tinted in
// the phone UI (src/routes/messages/+page.svelte).
function hexToRgba(hex, a) {
  const h = String(hex ?? '').replace('#', '');
  if (h.length !== 6) return `rgba(154, 111, 217, ${a})`;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

// Small top-of-screen card (see styles/bridge.css) — a circular avatar with
// a pulsing ring, a label, and a subtitle. Auto-fades after `notificationMs`
// (module setting); set that to 0 to leave it up until the next one replaces
// it. Purely cosmetic DOM, `pointer-events: none` so it never blocks canvas
// interaction underneath.
//
// `variant` selects a re-skin (see bridge.css `.fc99-toast--<variant>`) —
// e.g. 'once' mirrors the mobile app's violet O.N.C.E. channel styling, and
// 'wire' mirrors the phone's Wire messenger, so each notification reads as
// visually distinct from a plain incoming call.
let activeToast = null;
function showToast({ imageUrl, icon, title, subtitle, preview, variant, color }) {
  activeToast?.remove();

  const el = document.createElement('div');
  el.className = `fc99-toast${variant ? ` fc99-toast--${variant}` : ''}`;
  if (color) el.style.setProperty('--fc99-accent', color);
  const iconStyle = color
    ? ` style="background:${hexToRgba(color, 0.16)};border-color:${color};color:${color}"`
    : '';
  el.innerHTML = `
    ${variant === 'once' ? '<div class="fc99-toast-scanline" aria-hidden="true"></div>' : ''}
    <div class="fc99-toast-ring">
      ${imageUrl
        ? `<img class="fc99-toast-avatar" src="${imageUrl}" alt="">`
        : `<div class="fc99-toast-icon"${iconStyle}>${icon ?? '🔔'}</div>`}
    </div>
    <div class="fc99-toast-text">
      <div class="fc99-toast-title">${title ?? ''}</div>
      ${subtitle ? `<div class="fc99-toast-subtitle">${subtitle}</div>` : ''}
      ${preview ? `<div class="fc99-toast-preview">${preview}</div>` : ''}
    </div>
  `;
  document.body.appendChild(el);
  activeToast = el;
  requestAnimationFrame(() => el.classList.add('fc99-toast-visible'));

  const durationMs = game.settings.get(MODULE_ID, 'notificationMs');
  if (durationMs > 0) {
    setTimeout(() => {
      el.classList.remove('fc99-toast-visible');
      setTimeout(() => {
        if (activeToast === el) activeToast = null;
        el.remove();
      }, 400); // matches the CSS transition duration
    }, durationMs);
  }
}

// ── Operation Timer HUD ──────────────────────────────────────────────────
// Persistent on-screen countdown (as opposed to the auto-fading toast
// above) — mirrors the mobile app's own timer treatment: the amber
// bottom strip while running (src/routes/+layout.svelte .timer-strip),
// escalating into the last-10-seconds red strobe (.timer-panic) once
// ≤10s remain. Kept as a small corner card rather than the phone's
// full-screen takeover — unlike the phone, Foundry's screen is shared
// table real estate the GM and players still need to see the canvas
// through, and `pointer-events: none` (styles/bridge.css) keeps it from
// ever intercepting clicks either way.
//
// Ticks off `timerEndsAt` with its own requestAnimationFrame loop, same
// approach the mobile app uses, rather than trusting a stream of ticks
// over the wire — the bridge only pushes state changes (started/extended/
// stopped), not a tick per frame.
let timerEndsAt = null;
let timerRafId = null;
let timerEl = null;

function ensureTimerEl() {
  if (timerEl) return;
  timerEl = document.createElement('div');
  timerEl.className = 'fc99-timer';
  timerEl.innerHTML = `
    <div class="fc99-timer-eyebrow"><span class="fc99-timer-dot"></span>// OPERATION TIMER</div>
    <div class="fc99-timer-clock">
      <span class="fc99-timer-main">00:00</span><span class="fc99-timer-ms">.000</span>
    </div>
  `;
  document.body.appendChild(timerEl);
}

// ── Operation Timer screen frame ─────────────────────────────────────────
// A full-viewport inset bezel to go with the corner clock above — the
// "state overlay" visual language: a fixed double ring + cardinal ticks +
// corner dots (mirroring the game's own token-frame art), with a single
// glowing segment (blurred halo + crisp core, sharing one dash position)
// orbiting the frame and breathing in brightness as it travels. Recolors
// gold → red and speeds up at the same ≤10s threshold as the digit clock.
// See docs/state-overlay-design-system.md for the full pattern — this is
// the reference implementation other overlays (police chase, netrunning,
// etc.) are meant to copy.
//
// Built with the Web Animations API rather than CSS @keyframes because the
// orbit distance is the frame's actual on-screen perimeter, which changes
// whenever the Foundry window is resized — a plain CSS keyframe can't
// consume a per-element runtime value like that without registering a
// typed custom property, so JS just computes and re-issues the animation.
const FRAME_INSET = 14;
const FRAME_RADIUS = 10;
const FRAME_DASH_LEN = 90;
const ORBIT_MS_RUNNING = 3600;
const ORBIT_MS_PANIC = 1500;

let timerFrameEl = null;
let timerFrameAnims = [];
let timerFrameResizeTimer = null;

function frameGeometry() {
  const w = window.innerWidth, h = window.innerHeight;
  const rw = w - FRAME_INSET * 2, rh = h - FRAME_INSET * 2;
  const perim = 2 * (rw - 2 * FRAME_RADIUS) + 2 * (rh - 2 * FRAME_RADIUS) + 2 * Math.PI * FRAME_RADIUS;
  return { w, h, rw, rh, perim };
}

function timerFrameMarkup(g) {
  const x = FRAME_INSET, y = FRAME_INSET;
  const { rw, rh, w, h, perim } = g;
  const cx = w / 2, cy = h / 2;
  const gapLen = Math.max(perim - FRAME_DASH_LEN, 10);
  const corner = 34;
  return `
    <rect class="ring-outer" x="${x}" y="${y}" width="${rw}" height="${rh}" rx="${FRAME_RADIUS}"/>
    <rect class="ring-inner" x="${x + 5}" y="${y + 5}" width="${rw - 10}" height="${rh - 10}" rx="${Math.max(FRAME_RADIUS - 2, 0)}"/>
    <rect class="arc-glow" x="${x}" y="${y}" width="${rw}" height="${rh}" rx="${FRAME_RADIUS}" stroke-dasharray="${FRAME_DASH_LEN} ${gapLen}"/>
    <rect class="arc-core" x="${x}" y="${y}" width="${rw}" height="${rh}" rx="${FRAME_RADIUS}" stroke-dasharray="${FRAME_DASH_LEN} ${gapLen}"/>
    <line class="tick" x1="${cx}" y1="${y - 6}" x2="${cx}" y2="${y + 9}"/>
    <line class="tick" x1="${cx}" y1="${y + rh - 9}" x2="${cx}" y2="${y + rh + 6}"/>
    <line class="tick" x1="${x - 6}" y1="${cy}" x2="${x + 9}" y2="${cy}"/>
    <line class="tick" x1="${x + rw - 9}" y1="${cy}" x2="${x + rw + 6}" y2="${cy}"/>
    <circle class="dot" cx="${x + corner}" cy="${y + corner}" r="2.6"/>
    <circle class="dot" cx="${x + rw - corner}" cy="${y + corner}" r="2.6"/>
    <circle class="dot" cx="${x + corner}" cy="${y + rh - corner}" r="2.6"/>
    <circle class="dot" cx="${x + rw - corner}" cy="${y + rh - corner}" r="2.6"/>
  `;
}

// Dash length + gap == the frame's exact perimeter, so the single segment
// wraps corners and returns to its start with zero seam or jump — the loop
// only reads as seamless because the dash pattern's period matches the
// path length exactly.
function startOrbitAnimations(perim, durationMs) {
  timerFrameAnims.forEach((a) => a.cancel());
  timerFrameAnims = [];
  if (!timerFrameEl) return;
  timerFrameEl.querySelectorAll('.arc-glow, .arc-core').forEach((el) => {
    timerFrameAnims.push(el.animate(
      [{ strokeDashoffset: '0px' }, { strokeDashoffset: `${-perim}px` }],
      { duration: durationMs, iterations: Infinity, easing: 'linear' }
    ));
  });
}

function layoutTimerFrame() {
  if (!timerFrameEl) return;
  const g = frameGeometry();
  const panic = timerFrameEl.classList.contains('fc99-timer-frame--panic');
  timerFrameEl.setAttribute('viewBox', `0 0 ${g.w} ${g.h}`);
  timerFrameEl.innerHTML = timerFrameMarkup(g);
  startOrbitAnimations(g.perim, panic ? ORBIT_MS_PANIC : ORBIT_MS_RUNNING);
}

function scheduleFrameRelayout() {
  clearTimeout(timerFrameResizeTimer);
  timerFrameResizeTimer = setTimeout(layoutTimerFrame, 150);
}

function ensureTimerFrame() {
  if (timerFrameEl) return;
  timerFrameEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  timerFrameEl.setAttribute('class', 'fc99-timer-frame');
  document.body.appendChild(timerFrameEl);
  window.addEventListener('resize', scheduleFrameRelayout);
  layoutTimerFrame();
}

function setTimerFramePanic(isPanic) {
  if (!timerFrameEl) return;
  const wasPanic = timerFrameEl.classList.contains('fc99-timer-frame--panic');
  if (isPanic === wasPanic) return;
  timerFrameEl.classList.toggle('fc99-timer-frame--panic', isPanic);
  startOrbitAnimations(frameGeometry().perim, isPanic ? ORBIT_MS_PANIC : ORBIT_MS_RUNNING);
}

function clearTimerFrame() {
  clearTimeout(timerFrameResizeTimer);
  window.removeEventListener('resize', scheduleFrameRelayout);
  timerFrameAnims.forEach((a) => a.cancel());
  timerFrameAnims = [];
  timerFrameEl?.remove();
  timerFrameEl = null;
}

function tickTimer() {
  if (!timerEl || timerEndsAt == null) { timerRafId = null; return; }

  const rem = timerEndsAt - Date.now();
  const mainEl = timerEl.querySelector('.fc99-timer-main');
  const msEl = timerEl.querySelector('.fc99-timer-ms');

  if (rem <= 0) {
    mainEl.textContent = '00:00';
    msEl.textContent = '.000';
    timerEl.classList.remove('fc99-timer--panic');
    timerEl.classList.add('fc99-timer--expired');
    setTimerFramePanic(true); // sits red until timer.stopped, same as the digit clock
    timerRafId = null; // nothing left to count down — sits at TIME'S UP until timer.stopped
    return;
  }

  const totalSec = Math.floor(rem / 1000);
  mainEl.textContent = `${String(Math.floor(totalSec / 60)).padStart(2, '0')}:${String(totalSec % 60).padStart(2, '0')}`;
  msEl.textContent = `.${String(Math.floor(rem % 1000)).padStart(3, '0')}`;
  const isPanic = rem <= 10000;
  timerEl.classList.toggle('fc99-timer--panic', isPanic);
  timerEl.classList.remove('fc99-timer--expired');
  setTimerFramePanic(isPanic);

  timerRafId = requestAnimationFrame(tickTimer);
}

function setTimerEndsAt(endsAt) {
  timerEndsAt = endsAt;
  ensureTimerEl();
  ensureTimerFrame();
  if (!timerRafId) timerRafId = requestAnimationFrame(tickTimer);
}

function clearTimerDisplay() {
  timerEndsAt = null;
  if (timerRafId) cancelAnimationFrame(timerRafId);
  timerRafId = null;
  timerEl?.remove();
  timerEl = null;
  clearTimerFrame();
}

// Per-type visual side-effects beyond the chat message, e.g. the toast
// above. Optional — most event types won't need one. Wrapped in try/catch
// by the caller so a failure here never blocks the chat message itself.
const VISUAL_HANDLERS = {
  'call.incoming': (payload) => {
    showToast({
      imageUrl: payload.callerAvatarUrl,
      icon: '📞',
      title: 'Incoming Call',
      subtitle: payload.callerName ?? 'Unknown',
    });
  },

  'once.deployed': (payload) => {
    showToast({
      variant: 'once',
      icon: 'M',
      title: 'Encrypted Transmission',
      subtitle: payload.preview ? `“${payload.preview}”` : 'Sender unverified',
    });
  },

  // Whisper-scoped by `dispatch()` below via the AUDIENCE map, same as the
  // chat message itself — a group wire sent to only some of a group's
  // players never reaches the others' clients, so this toast can't leak
  // to them either.
  'wire.deployed': (payload) => {
    const sender = payload.sender ?? 'Unknown';
    let preview = payload.preview ?? null;
    if (payload.hasImage) preview = preview ? `📷 ${preview}` : '📷 Photo';
    showToast({
      variant: 'wire',
      icon: initials(sender),
      color: payload.color || null,
      title: payload.groupName || 'Wire Message',
      subtitle: sender,
      preview,
    });
  },

  'timer.started': (payload) => {
    if (payload.endsAt != null) setTimerEndsAt(payload.endsAt);
  },

  'timer.extended': (payload) => {
    if (payload.endsAt != null) setTimerEndsAt(payload.endsAt);
  },

  'timer.stopped': () => clearTimerDisplay(),
};

// Runs the visual side-effect (e.g. the toast) for one event. Called via the
// createChatMessage hook below on every connected client — GM and players
// alike — since chat message creation is one of Foundry's core documents
// and is always reliably synced to everyone, unlike a raw custom socket
// event, which isn't guaranteed to be relayed between clients.
function handleEnvelope(envelope) {
  if (!envelope || typeof envelope.type !== 'string') return;

  const visualHandler = VISUAL_HANDLERS[envelope.type];
  if (visualHandler) {
    try {
      visualHandler(envelope.payload ?? {});
    } catch (err) {
      console.warn(`[${MODULE_ID}] visual handler for "${envelope.type}" threw:`, err);
    }
  }
}

function dispatch(envelope) {
  if (!envelope || typeof envelope.type !== 'string') return;

  // If this event's payload names an audience, whisper to just those
  // players (Foundry filters both the chat message and the createChatMessage
  // hook — and therefore the toast — to whisper recipients + GM only). No
  // AUDIENCE entry, or a null return, means it's a public event for everyone.
  const audience = AUDIENCE[envelope.type]?.(envelope.payload ?? {}) ?? null;
  let whisper;
  if (audience) {
    const ids = resolveWhisperIds(audience);
    whisper = ids.length ? ids : [game.user.id]; // fail closed: GM-only if no match
  }

  // The envelope rides along as a flag on the chat message itself — every
  // client picks it up via the createChatMessage hook, so no separate
  // broadcast channel is needed.
  ChatMessage.create({
    content: formatEnvelope(envelope),
    speaker: { alias: 'Fate City Ops' },
    flags: { [MODULE_ID]: { envelope } },
    ...(whisper ? { whisper } : {}),
  });
}

let reconnectDelay = RECONNECT_MIN_MS;
let socket = null;

function connect() {
  const url = game.settings.get(MODULE_ID, 'wsUrl');
  socket = new WebSocket(url);

  socket.onopen = () => {
    console.log(`[${MODULE_ID}] connected to ${url}`);
    reconnectDelay = RECONNECT_MIN_MS;
  };

  socket.onmessage = (event) => {
    try {
      dispatch(JSON.parse(event.data));
    } catch (err) {
      console.warn(`[${MODULE_ID}] failed to parse message:`, err);
    }
  };

  socket.onclose = () => {
    scheduleReconnect();
  };

  socket.onerror = (err) => {
    console.warn(`[${MODULE_ID}] socket error:`, err);
  };
}

function scheduleReconnect() {
  setTimeout(connect, reconnectDelay);
  reconnectDelay = Math.min(reconnectDelay * 2, RECONNECT_MAX_MS);
}

Hooks.once('init', () => {
  game.settings.register(MODULE_ID, 'wsUrl', {
    name: 'Bridge WebSocket URL',
    hint: 'Address of the fc99 bridge service (see bridge/README.md). Default assumes the bridge runs on this same machine.',
    scope: 'world',
    config: true,
    type: String,
    default: 'ws://localhost:8787',
  });

  game.settings.register(MODULE_ID, 'notificationMs', {
    name: 'Notification Duration (ms)',
    hint: 'How long the on-screen toast (e.g. an incoming call card) stays up before auto-fading. Set to 0 to leave it up until the next event replaces it.',
    scope: 'world',
    config: true,
    type: Number,
    default: 6000,
  });
});

// Every client — GM and players alike — reacts when a bridge-originated
// chat message syncs in, and runs that event's visual side-effect (if any).
Hooks.on('createChatMessage', (message) => {
  const envelope = message.getFlag(MODULE_ID, 'envelope');
  if (envelope) handleEnvelope(envelope);
});

Hooks.once('ready', () => {
  // Only the GM client owns the actual connection to the bridge service.
  if (!game.user.isGM) return;
  connect();
});
