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

// Pops an image full-screen for every connected client (players included),
// using Foundry's own built-in image-share mechanism — the same thing the
// "share with players" button on a normal image popout does. Auto-closes
// after `imagePopoutMs` (module setting) so it doesn't sit blocking the view;
// set that setting to 0 to leave it up until manually closed.
function shareImagePopout(src, title) {
  if (!src) return;
  const ImagePopoutCls = foundry.applications?.apps?.ImagePopout ?? ImagePopout;

  // Broadcast to everyone else connected (core Foundry behavior for this
  // socket event does not loop back to the sender).
  game.socket.emit('shareImage', { image: src, title: title || '', uuid: null });

  // Render locally too, so the GM sees it as well.
  const app = new ImagePopoutCls(src, { title: title || '' });
  app.render(true);

  const durationMs = game.settings.get(MODULE_ID, 'imagePopoutMs');
  if (durationMs > 0) {
    setTimeout(() => app.close?.(), durationMs);
  }
}

// Per-type visual side-effects beyond the chat message, e.g. popping art.
// Optional — most event types won't need one. Wrapped in try/catch by the
// caller so a failure here never blocks the chat message itself.
const VISUAL_HANDLERS = {
  'call.incoming': (payload) => {
    if (payload.callerAvatarUrl) {
      shareImagePopout(payload.callerAvatarUrl, payload.callerName || 'Incoming Call');
    }
  },
};

function dispatch(envelope) {
  if (!envelope || typeof envelope.type !== 'string') return;
  ChatMessage.create({
    content: formatEnvelope(envelope),
    speaker: { alias: 'Fate City Ops' },
  });

  const visualHandler = VISUAL_HANDLERS[envelope.type];
  if (visualHandler) {
    try {
      visualHandler(envelope.payload ?? {});
    } catch (err) {
      console.warn(`[${MODULE_ID}] visual handler for "${envelope.type}" threw:`, err);
    }
  }
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

  game.settings.register(MODULE_ID, 'imagePopoutMs', {
    name: 'Image Popout Duration (ms)',
    hint: 'How long shared images (e.g. an incoming caller\'s avatar) stay on screen before auto-closing. Set to 0 to leave them up until manually closed.',
    scope: 'world',
    config: true,
    type: Number,
    default: 8000,
  });
});

Hooks.once('ready', () => {
  if (!game.user.isGM) return;
  connect();
});
