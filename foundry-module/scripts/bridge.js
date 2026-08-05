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

function dispatch(envelope) {
  if (!envelope || typeof envelope.type !== 'string') return;
  ChatMessage.create({
    content: formatEnvelope(envelope),
    speaker: { alias: 'Fate City Ops' },
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
});

Hooks.once('ready', () => {
  if (!game.user.isGM) return;
  connect();
});
