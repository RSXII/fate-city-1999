// Fate City 1999 — Foundry bridge
//
// Small LAN-only relay: accepts event POSTs from the GM console (ops-7e4f,
// running on the MacBook) and forwards them over a local WebSocket to the
// Foundry module (running inside a live Foundry world on this machine).
//
// No auth, no persistence, no queueing — LAN-only tool, events sent while
// nothing is connected are simply dropped. See bridge/README.md.

import { createServer } from 'node:http';
import { WebSocketServer } from 'ws';

const PORT = Number(process.env.PORT) || 8787;

let foundrySocket = null;

function withCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 1_000_000) {
        reject(new Error('Body too large'));
        req.destroy();
      }
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

const server = createServer(async (req, res) => {
  withCors(res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === 'GET' && req.url === '/health') {
    sendJson(res, 200, {
      ok: true,
      uptime: process.uptime(),
      foundryConnected: !!foundrySocket && foundrySocket.readyState === foundrySocket.OPEN,
    });
    return;
  }

  if (req.method === 'POST' && req.url === '/event') {
    let envelope;
    try {
      const raw = await readBody(req);
      envelope = JSON.parse(raw);
    } catch (err) {
      sendJson(res, 400, { error: `Invalid JSON body: ${err.message}` });
      return;
    }

    if (!envelope || typeof envelope.type !== 'string') {
      sendJson(res, 400, { error: "Envelope must include a string 'type'." });
      return;
    }

    if (foundrySocket && foundrySocket.readyState === foundrySocket.OPEN) {
      foundrySocket.send(JSON.stringify(envelope));
      console.log(`[bridge] relayed "${envelope.type}" to Foundry`);
      sendJson(res, 202, { relayed: true });
    } else {
      console.log(`[bridge] dropped "${envelope.type}" — no Foundry module connected`);
      sendJson(res, 202, { relayed: false, reason: 'no foundry module connected' });
    }
    return;
  }

  sendJson(res, 404, { error: 'Not found' });
});

const wss = new WebSocketServer({ server });

wss.on('connection', (socket) => {
  console.log('[bridge] Foundry module connected');
  foundrySocket = socket;

  socket.on('close', () => {
    console.log('[bridge] Foundry module disconnected');
    if (foundrySocket === socket) foundrySocket = null;
  });

  socket.on('error', (err) => {
    console.warn('[bridge] Foundry socket error:', err.message);
  });
});

// Bind 0.0.0.0, not localhost — the MacBook needs to reach this over the LAN.
server.listen(PORT, '0.0.0.0', () => {
  console.log(`[bridge] listening on 0.0.0.0:${PORT} (HTTP + WebSocket)`);
});
