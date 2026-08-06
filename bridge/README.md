# Fate City 1999 — Foundry bridge

Small LAN-only relay service. Run this on (or near) the desktop PC that hosts
Foundry VTT. It accepts event POSTs from the GM console (`ops-7e4f`, run from
the MacBook) and forwards them over a local WebSocket to the companion
Foundry module (`../foundry-module`), which is what actually posts into
Foundry chat.

```
[ops-7e4f, MacBook]  --HTTP POST (LAN)-->  [this service]  --WebSocket (localhost)-->  [Foundry module]
```

## Run it (Windows)

Double-click **`start-bridge.bat`**. First run installs dependencies (one-time,
takes a few seconds); every run after that starts immediately. Leave the
window open while you're playing — closing it stops the bridge.

You should see:

```
[bridge] listening on 0.0.0.0:8787 (HTTP + WebSocket)
```

The first time it binds, Windows may prompt to allow inbound network
connections — allow it, otherwise the MacBook won't be able to reach it over
the LAN.

### Start automatically on login (optional)

Right-click **`install-autostart.ps1`** → **Run with PowerShell**. This adds a
shortcut to your Windows Startup folder that launches the bridge (minimized)
every time you log in, so you don't have to remember to start it before a
session. If Windows blocks the script with an execution-policy error, open
PowerShell and run:

```powershell
powershell -ExecutionPolicy Bypass -File install-autostart.ps1
```

To undo, delete the shortcut the script tells you it created (in
`shell:startup`).

### Manual / other platforms

```bash
cd bridge
npm install
npm start
```

## Find the desktop's LAN IP

You'll need this to configure the bridge URL in the ops-7e4f **Foundry** tab.

- **Windows**: `ipconfig` → look for "IPv4 Address" under your active adapter.
- **macOS/Linux**: `ipconfig getifaddr en0` (or `hostname -I` on Linux).

Then the bridge URL is `http://<that-ip>:8787`.

## Config

- Port defaults to `8787`. Override with `PORT=1234 npm start`.
- No auth — this is intentionally LAN-only. Don't port-forward it to the
  internet.

## Verify it's working

- `GET http://<desktop-ip>:8787/health` → `{"ok":true,"foundryConnected":false}`
  before the Foundry module has connected, `foundryConnected:true` once it
  has (see `../foundry-module/README.md`).
- The "Test Connection" button in the ops-7e4f **Foundry** tab hits the same
  endpoint.
