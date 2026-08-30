# Fate City 1999 — Phone

Foundry v12 module. Adds a scene-control button ("Wire Phone") that any
connected client — GM or player — can click to open the Wire app in a
window inside Foundry, instead of needing it running on a separate device.

It's just an iframe pointed at the already-deployed Wire build:

```
[this module]  --iframe-->  [https://rsxii.github.io/fate-city-1999/  (or your configured URL)]
```

## Install

1. Copy this whole `foundry-module-phone/` folder into your Foundry
   `Data/modules/` folder, renamed to `fc99-phone`:

   ```
   Data/modules/fc99-phone/
     module.json
     scripts/phone.js
     styles/phone.css
     templates/phone.html
   ```

2. Launch your world, open **Manage Modules**, enable **Fate City 1999 —
   Phone**, and reload if prompted.

3. Click the **Wire Phone** category icon (appended at the end of the left
   toolbar) to reveal its one tool, then click that to open/close the
   window — two clicks, same as any other scene-control category. Every
   connected client sees this button — there's no GM-only gating, since
   each player needs their own phone.

## Config

**Configure Settings → Module Settings → Wire URL** — defaults to the
public GitHub Pages build (`https://rsxii.github.io/fate-city-1999/`).
Point it at a LAN `npm run dev` address instead if you're testing
unreleased changes to the Wire app.

## How identity carries over

Wire has no login screen — it talks to its Firebase Realtime Database over
plain unauthenticated REST (see `../src/lib/firebase-db.js`), and whatever
per-device codename/settings a player already has lives in that origin's
`localStorage`. That means:

- If a player runs Foundry in the **same browser profile** they normally
  use for the standalone Wire PWA, the iframe picks up their existing
  device state automatically — nothing to configure.
- If it's the first time that browser has visited the Wire origin, they'll
  just go through Wire's own first-run setup once, inside the iframe, same
  as they would on a fresh device.

## Known limitations (v1)

- **No two-way state sync.** This just displays Wire — it doesn't make
  Foundry actor data and Wire's Firebase data the same source of truth.
  Event relay in the other direction (Wire → Foundry chat/overlays) is
  handled separately by `../foundry-module` (`fc99-bridge`); this module
  doesn't touch that.
- **Camera route.** The iframe requests `camera`/`microphone` permission
  (for Wire's in-fiction camera app) via its `allow` attribute, but whether
  that's actually granted depends on how Foundry itself is being run
  (regular browser tab vs. the Electron app) — not verified yet.
- **Fixed window size** (400×780, non-resizable), deliberately under
  Wire's own 620px "drop the decorative phone bezel" breakpoint (see
  `../device.css`) so it renders as a clean full-bleed phone screen instead
  of a phone-shaped bezel nested inside a Foundry window that already has
  its own chrome.
