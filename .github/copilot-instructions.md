# GitHub Copilot Instructions — Fate City: 1999 / Wire

## Project Purpose

This is a **tabletop RPG companion app** for the Fate City: 1999 campaign, set in a custom cyberpunk world. It simulates the in-world smartphone ("Wire") that player characters carry. The goal is **atmospheric immersion**, not a production-grade application. Every design and code decision should prioritize the _feel_ of a real cyberpunk corporate device over technical correctness, feature completeness, or real-world practicality.

> "Smoke and mirrors" is a first-class design principle. If it _looks_ right and _feels_ right, it is right.

---

## The Four App Pillars

### 1. Wire — Messaging (`messages.html`, `gm-console.html`)

NPC-driven SMS-style messages. The GM uses `gm-console.html` to push messages from named NPC senders (defined in `js/data/senders.js`) to players in real time. Messages appear in a Wire-styled chat thread. Content should read like an in-world text from an actual person — terse, urgent, lore-appropriate.

### 2. O.N.C.E. (`once.html`, `intel.html`)

A shadowy encrypted messaging app. Two surfaces:

- **`once.html`** — A contact called **"Unknown / M"** (the Mysterious Benefactor) sends lore drops: intel on people, places, factions, and world events. Content should feel like a dead drop, not a wiki entry. Mysterious, fragmented, layered.
- **`intel.html`** — An in-world reference index covering items, services, and other world-building content. Still within the O.N.C.E. aesthetic; immersive over informational.

### 3. EverNear (`evernear.html`)

An in-world AI companion app by **Nexkin Inc.** featuring **ECHO-7**. It satirizes predatory gacha / companion app monetization (free tier locks, currencies like NP/BT/RS, "Memory Platinum", etc.). The tone is corporate-cute-sinister. Features are intentionally paywalled and absurd. The intro splash, currency HUD, ad banner rotation, and bond system are all flavor — they do not need to function as real systems.

### 4. Netrunner Email _(planned — not yet built)_

A future feature: immersive "hacked emails" or netrunning data dumps delivered to players when they breach systems in-game. Should look and feel like leaked corporate email threads or terminal readouts when eventually implemented. Do not create files for this feature unless explicitly asked.

---

## Tech Stack

- **Vanilla HTML, CSS, JavaScript** — no build toolchain, no frameworks
- **Web Components** — `wire-status-bar`, `wire-header`, `wire-home-bar` registered via `js/components/wire-chrome.js`. Import this barrel file to get all chrome elements on any page.
- **PWA** — `manifest.json`, `sw.js`, `sw-register.js`. App is installable on mobile as a home screen icon.
- **Firebase** — `functions/index.js` for any server-side / notification logic. `firebase.json` for hosting config.
- **No npm/bundler on the frontend** — keep all JS as native ES modules (`type="module"`).

---

## File Structure

```
index.html          Boot / splash screen
home.html           Wire home screen (notifications hub)
messages.html       Wire SMS-style messaging
once.html           O.N.C.E. encrypted channel (Mysterious Benefactor / "M")
intel.html          O.N.C.E. in-world intel index (items, services, lore)
evernear.html       EverNear AI companion app
locations.html      In-world map / location browser
persons.html        NPC dossiers
gacha.html          EverNear gacha pull — Agent ECHO-7™ banner
gacha-nyan.html     EverNear gacha pull — Nyan Nyan Racer banner
gm-console.html     GM-only tool: push messages, trigger events (not player-facing)
wire.css            Global Wire device stylesheet (shared by all pages)
device.css          Physical device frame CSS
js/
  wire-clock.js           Live clock displayed in the Wire status bar
  wire-notifications.js   Notification logic
  components/             Web Component definitions (wire-chrome barrel + individual)
  data/senders.js         Canonical NPC sender list (id, name, color, avatar)
functions/          Firebase Cloud Functions
sounds/             Ambient / UI audio assets
images/             NPC avatars, EverNear package art, etc.
```

---

## Aesthetic & Tone Rules

- **Cyberpunk corporate aesthetic**: dark backgrounds (`#0a0710`–`#0d1118`), neon accents (pink `#ff4d8e`, cyan `#4dd9ff`, purple `#a855f7`), uppercase micro-labels, tight letter-spacing.
- **Wire chrome** (`wire-status-bar` + `wire-header` + `wire-home-bar`) must appear on every player-facing page. It sells the "this is a phone" illusion.
- **EverNear tone**: corporate-cute with dark undertones. Nexkin Inc.'s tagline is _"Why be lonely, when you can be billed?"_ — that energy should permeate every feature.
- **O.N.C.E. tone**: cryptic, fragmented, urgent. M does not explain. M implies. Even `intel.html` should feel like recovered data, not a manual.
- **Wire messages**: brief, human, in-character. NPCs text like people, not like quest givers.
- **GM Console** (`gm-console.html`): functional clarity over aesthetics. This is a backstage tool.

---

## Copilot Guidance

### Do

- Lean into the immersive fiction. If a UI element makes the app feel more like a real cyberpunk phone, it belongs.
- Keep all pages consistent with `wire.css` and the established CSS custom properties (defined per-page in `:root`).
- Use the existing `wire-chrome` components — don't inline status bars or headers.
- Add new NPC senders to `js/data/senders.js` using the established schema (`id`, `name`, `color`, `avatar`).
- Keep JavaScript vanilla and modular (ES modules). No libraries unless absolutely unavoidable.
- Write copy and flavor text that fits the world. Nexkin Inc., EchoLink OS, S.K.AM Technologies, and Fate City are all established in-world nouns.

### Don't

- Don't suggest refactoring the wire-chrome Web Components — they are stable.
- Don't add real backend logic, auth, or databases beyond what Firebase already provides.
- Don't prioritize accessibility, SEO, or production hardening — this runs on one GM's device and a handful of player phones.
- Don't replace in-world flavor text with generic placeholder copy.
- Don't break the PWA install chain (`sw.js` / `manifest.json` / `sw-register.js`).
- Don't create files for the Netrunner Email feature unless explicitly asked.

---

## In-World Proper Nouns

| Term                | What it is                                                     |
| ------------------- | -------------------------------------------------------------- |
| Wire                | The in-world smartphone OS / device                            |
| O.N.C.E.            | Encrypted messaging / intel app on Wire                        |
| EverNear            | AI companion app by Nexkin Inc.                                |
| ECHO-7              | The AI companion character                                     |
| Nexkin Inc.         | Fictional corp behind EverNear                                 |
| EchoLink OS         | EverNear's OS layer branding                                   |
| S.K.AM Technologies | Infrastructure partner (network licensing)                     |
| NP / BT / RS        | EverNear currencies: NightPoints, BondTokens, Resonance Shards |
| M / Unknown         | The Mysterious Benefactor, O.N.C.E. contact                    |
| Fate City: 1999     | The campaign setting name                                      |
| MoodLog             | Nexkin Inc. emotional tracking feature (flavor only)           |
