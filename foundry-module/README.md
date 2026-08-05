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

## Extending

New event types (wire messages, timer, date change, etc.) just need a new
entry in the `FORMATTERS` object in `scripts/bridge.js` — no other code
changes required. Until a formatter exists for a given `type`, unrecognized
events still post a generic chat message so nothing is silently dropped.
