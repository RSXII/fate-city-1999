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

## Notification toast

`call.incoming` events also show a small card at the top of the screen for
every connected client (players included) — a circular caller avatar with a
pulsing ring, an "Incoming Call" label, and the caller's name. It auto-fades
after a few seconds by default; adjust or disable this under **Configure
Settings → Module Settings → Notification Duration (ms)** (`0` leaves it up
until the next event replaces it).

It rides along as a flag on the chat message itself
(`ChatMessage.create({..., flags: {'fc99-bridge': {envelope}}})`), and every
client — GM and players — reacts via a `createChatMessage` hook. This was
originally built on a custom `game.socket.emit('module.fc99-bridge', ...)`
broadcast, but that didn't reliably reach players (only the GM, who also ran
it locally, saw it) — chat message sync is one of Foundry's actual core,
always-relayed mechanisms, so it's the more reliable choice here.

## Targeting specific players

`call.incoming` (via `targetCodename`) and `wire.deployed` (via `recipients`)
only show up for the intended player(s) — whispered chat messages, so the
toast (driven off the same message) is naturally filtered the same way by
Foundry itself. Everything else is public (visible to the whole table).

**This depends on each player's Foundry display name starting with their
in-app codename** — e.g. a player with codename `MIRAE` should have a Foundry
User named `Mirae` or `Mirae (whatever nickname)`. If a codename doesn't
match any connected user, that event whispers to the GM only rather than
falling back to public — check the browser console for a
`no Foundry user matches codename "..."` warning if a call/message isn't
showing up for the player it should.

To make another event type audience-aware, add an entry to the `AUDIENCE`
object in `scripts/bridge.js` — a function that pulls codename(s) out of that
type's payload (return `null` for "everyone").

## Extending

New event types (wire messages, timer, date change, etc.) just need a new
entry in the `FORMATTERS` object in `scripts/bridge.js` — no other code
changes required. Until a formatter exists for a given `type`, unrecognized
events still post a generic chat message so nothing is silently dropped.

A type can also trigger a visual side-effect (like the toast above) by adding
an entry to the `VISUAL_HANDLERS` object — it receives the same `payload` as
the formatter and runs on every client via the `createChatMessage` hook.
