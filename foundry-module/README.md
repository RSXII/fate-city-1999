# Fate City 1999 — Foundry bridge module

Foundry v12 module. Connects (as the GM client only) to the local bridge
service (`../bridge`) over WebSocket, and turns incoming events into Foundry
chat messages.

```
[bridge service]  --WebSocket (localhost)-->  [this module, inside your GM's Foundry browser tab]
```

## Install

1. Copy this whole `foundry-module/` folder into your Foundry `Data/modules/`
   folder, on the desktop PC, renamed to `fc99-bridge`:

   ```
   Data/modules/fc99-bridge/
     module.json
     scripts/bridge.js
   ```

2. Launch your world (or reload it), open **Manage Modules**, enable
   **Fate City 1999 — Bridge**, and reload again if prompted.

3. Make sure the `bridge/` service (see `../bridge/README.md`) is running on
   the same machine. By default the module connects to
   `ws://localhost:8787` — matching the bridge's default port. If you changed
   the bridge's port, update the **Bridge WebSocket URL** setting under this
   module's config (Configure Settings → Module Settings).

## Verify

- Check the bridge's own console output — you should see
  `[bridge] Foundry module connected` once the world finishes loading.
- `GET http://localhost:8787/health` (from the desktop) should show
  `"foundryConnected": true`.
- Only the GM client connects — if you have multiple people logged in as GM
  simultaneously in separate tabs, each would connect and each would post a
  duplicate chat message. Not handled in v1; just don't do that.

## Image popouts

`call.incoming` events also share the caller's avatar full-screen to every
connected client (players included) using Foundry's built-in image-share
mechanism — the same thing the "share with players" button does on a normal
image popout. It auto-closes after a few seconds by default; adjust or
disable this under **Configure Settings → Module Settings → Image Popout
Duration (ms)** (`0` leaves it open until manually closed).

This relies on documented core Foundry v12 behavior (`game.socket.emit('shareImage', ...)`)
but hasn't been exercised against a live world yet — if it doesn't show up
for players, or double-pops for the GM, check `shareImagePopout()` in
`scripts/bridge.js` first.

## Extending

New event types (wire messages, timer, date change, etc.) just need a new
entry in the `FORMATTERS` object in `scripts/bridge.js` — no other code
changes required. Until a formatter exists for a given `type`, unrecognized
events still post a generic chat message so nothing is silently dropped.

A type can also trigger a visual side-effect (like the image popout above) by
adding an entry to the `VISUAL_HANDLERS` object — it receives the same
`payload` as the formatter and runs after the chat message is posted.
