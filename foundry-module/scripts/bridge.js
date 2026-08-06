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

// Small top-of-screen card (see styles/bridge.css) — a circular avatar with
// a pulsing ring, a label, and a subtitle. Auto-fades after `notificationMs`
// (module setting); set that to 0 to leave it up until the next one replaces
// it. Purely cosmetic DOM, `pointer-events: none` so it never blocks canvas
// interaction underneath.
let activeToast = null;
function showToast({ imageUrl, icon, title, subtitle }) {
  activeToast?.remove();

  const el = document.createElement('div');
  el.className = 'fc99-toast';
  el.innerHTML = `
    <div class="fc99-toast-ring">
      ${imageUrl
        ? `<img class="fc99-toast-avatar" src="${imageUrl}" alt="">`
        : `<div class="fc99-toast-icon">${icon ?? '🔔'}</div>`}
    </div>
    <div class="fc99-toast-text">
      <div class="fc99-toast-title">${title ?? ''}</div>
      ${subtitle ? `<div class="fc99-toast-subtitle">${subtitle}</div>` : ''}
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
