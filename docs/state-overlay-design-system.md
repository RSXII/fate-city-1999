# Fate City: 1999 — State Overlay Design System

Design language and technical pattern for **game-state HUD overlays** in the Foundry
client: persistent, non-blocking on-screen indicators that broadcast from the mobile
GM app to the tabletop, so players see at a glance what state the scene is in — a
countdown, a chase, a netrunning sequence — without a chat message being the only
signal.

The Operation Timer (`foundry-module/scripts/bridge.js`, search "Operation Timer
screen frame") is the first and, as of this writing, only implementation. It's meant
to be the reference other overlays copy, whether they end up in this same module or
in a new sibling plugin.

## Origin

The visual language is lifted directly from the game's own token-frame art (circular
character portrait bezels used on tokens/contacts): a thin double ring, small
perpendicular tick marks at the cardinal points, small dot accents near the
corners, and a soft colored glow halo around the whole thing. The Operation Timer
reframes that same vocabulary as a rectangular bezel inset from the Foundry window's
edges, instead of a circle around a portrait.

## Core visual vocabulary

- **Double ring** — an outer solid stroke (opacity ~0.85) plus an inner solid stroke
  inset ~5–6px (opacity ~0.4). This is the fixed "bezel line," always visible.
- **Fixed reference marks** — short perpendicular tick lines at the four edge
  midpoints, and small filled dots near the four corners. Static; they don't move or
  animate. These read as the frame's engraved scale, not part of the "live" signal.
- **One moving element, not a marquee** — the state is communicated by exactly one
  glowing segment orbiting the frame, built from two layers sharing the same dash
  position: a blurred colored halo (the glow) and a crisp bright core riding on top
  of it. A separate "breathing" opacity pulse (independent of the orbit motion) is
  layered on both, so the segment visibly brightens and dims as it travels. A
  repeating dash pattern (several segments marching around at once) was tried first
  and rejected — it read as "muted" and busy. One bright segment reads clearly at a
  glance.
- **Urgency scales through speed and color, not by adding a flicker layer** — going
  from a calm to an alarmed state means shortening the orbit duration and the pulse
  duration and swapping the color, not switching to a hard on/off strobe. (The
  Operation Timer's *digit clock* — a separate, older element — does use a hard
  `steps(1)` flicker for its own last-10-seconds state; the frame deliberately does
  it differently, and reads better for it. If a future overlay wants the harder
  alarm treatment instead, that's a legitimate choice — just make it a choice, not a
  default.)
- **Monospace HUD label convention** — Courier New, small caps, letter-spaced,
  prefixed with `// ` (e.g. `// OPERATION TIMER`), with a small pulsing dot before
  the text. Reused from the mobile app's own `.timer-eyebrow` / `.msg-header-sub`
  styling.

### Established palette — reuse before inventing a new color

| Color | Hex | Meaning elsewhere in the game |
|---|---|---|
| Gold / amber | `#c9a227` | Operational / neutral-positive. Wire app accents, Operation Timer's running state. |
| Red (bright) | `#ff2424` | Danger / alarm / panic. Operation Timer's last-10s and expired state. |
| Red (burnt) | `#e05a3a` | The persistent bottom timer-strip in the mobile layout — a slightly duller red than panic red. |
| Teal | `#5b9e8f` | Group chats / allies (Wire app group default color, seen on player token rings). |
| Violet | `#7c3aed` / `#a855f7` | O.N.C.E. — the encrypted/supernatural channel. |

Two colors are needed for the overlays mentioned as "coming next" and don't have an
established value yet — **check the mobile app for an existing precedent before
picking one**, rather than inventing something new that then has to be
reconciled later:

- **Police chase** — wants a genuine red/blue alternation (a "wig-wag" light bar
  effect), not a single fixed hue. This is a deliberate departure from "one state,
  one color" and should alternate the ring's stroke + glow color on an interval.
- **Netrunning** — cyberpunk genre convention points toward green/cyan
  (matrix/terminal), but confirm there isn't already a netrunning-specific color in
  the mobile app's UI before assuming that. Also worth a real decision: does
  netrunning use this *same* clean bezel language, or does it deliberately break
  from it into a glitchier register (scanlines, RGB-split, hard flicker) the way
  hacking UIs conventionally do? That's a genre-contrast call, not just a color
  swap — decide it up front rather than defaulting into the bezel out of momentum.

## The seamless-orbit technique

The moving segment is a `<rect>` (or `<circle>`/arbitrary closed `<path>`) stroked
with `stroke-dasharray: <dashLen> <gapLen>`, animated via `stroke-dashoffset`. Two
things make it read as one clean segment orbiting seamlessly, instead of a jumpy
marquee:

1. **`dashLen + gapLen` must equal the shape's exact perimeter.** This guarantees
   there's only ever one visible segment (the gap swallows the rest of the loop),
   and — because the dash pattern's period exactly matches the path length — the
   segment wraps around corners and back to its start with **zero visible seam**,
   for any starting offset. If the period doesn't match the perimeter, you either
   get multiple segments (period too short) or a visible snap once per lap (if
   you're animating offset by a value that isn't a multiple of the *period*, e.g.
   naively animating by the path length when the two differ).

   Perimeter of a rounded rect: `2*(w - 2r) + 2*(h - 2r) + 2*π*r`

2. **Animate with a duration equal to how long a full-perimeter offset should
   take**, `from { strokeDashoffset: 0 } to { strokeDashoffset: -perimeter }`,
   `linear`, `infinite`.

If the frame's size is static (fixed dimensions, doesn't need to track a resizable
window), plain CSS `@keyframes` work fine for this — see
`foundry-module/scripts/bridge.js`'s git history for the throwaway sandbox version
that did it that way. If the frame needs to hug a **resizable** window (the
Operation Timer's real case — the Foundry window can be resized), CSS keyframes
can't easily consume a per-element runtime value like a computed perimeter without
registering a typed custom property (`@property`) and fighting with `var()`
interpolation. It's simpler and more robust to just use the **Web Animations API**
(`element.animate([...], { duration, iterations: Infinity, easing: 'linear' })`),
compute the perimeter in JS on layout/resize, and re-issue the animation. That's
what the Operation Timer implementation does — see `startOrbitAnimations()` /
`layoutTimerFrame()` in bridge.js.

## Reusable transport architecture (from fc99-bridge)

The plumbing already built for the Operation Timer (and calls, wire messages,
O.N.C.E. transmissions, etc.) is generic and worth reusing rather than
reinventing for a new overlay:

```
mobile app  →  local WebSocket bridge service (bridge/)  →  Foundry GM client
            (only the GM client holds the actual socket connection)
                          │
                          ▼
       ChatMessage.create({ flags: { 'fc99-bridge': { envelope } } })
                          │
        (Foundry syncs/whispers this document to the right clients)
                          │
                          ▼
   every receiving client's `createChatMessage` hook fires
                          │
                          ▼
        a per-event-type handler runs the actual visual side effect
             (toast, persistent HUD, screen frame, whatever)
```

Key properties worth keeping if a new overlay (or a whole new plugin) reuses this:

- **Reliable multi-client delivery for free.** A raw custom socket event isn't
  guaranteed to reach every connected client the same way a core Foundry document
  is. Riding along as a flag on a `ChatMessage` means Foundry's own sync guarantees
  do the work.
- **Per-player targeting for free.** An `AUDIENCE` map (see `bridge.js`) can resolve
  an event's payload to specific codenames, which get mapped to Foundry `User` ids
  and passed as the `ChatMessage`'s `whisper` list. Foundry only delivers a
  whispered chat message's create-document event to the whisper list + GM at the
  socket level — non-recipients' clients never see it, so a scoped overlay (e.g. a
  netrunning HUD that should only appear for the player currently jacked in) is
  just an `AUDIENCE` entry away, not new plumbing. See `wire.deployed`'s
  `recipients` handling for the existing pattern.
- **Reconnect handling, settings UI, etc.** already exist and don't need
  reinventing.

**Recommendation for the next overlay(s):** build it as a *second, small Foundry
module* (its own `module.json` + script) that listens to the **same** bridge
WebSocket / chat-envelope convention — `Hooks.on('createChatMessage', ...)`, read
the same flag namespace, filter to its own event types — rather than standing up a
second transport. That keeps it toggle-able independently of `fc99-bridge` (useful
if it's genuinely a separate concern, like a police-chase module a different table
might not want) while reusing everything proven here. Only build a fully separate
transport if the new tool needs to run somewhere Foundry/this bridge doesn't reach
at all.

## State overlay spec — fill this in per new overlay

| Field | Operation Timer (built) | Police Chase (proposed) | Netrunning (proposed) |
|---|---|---|---|
| Trigger events | `timer.started` / `timer.extended` / `timer.stopped` | ? (manual GM toggle vs. tied to a heat/mechanic value) | ? |
| Color(s) | gold → red at ≤10s | red/blue alternating (wig-wag) — confirm exact blue | tbd — confirm against mobile app before picking |
| Motion | orbit 3.6s → 1.5s, pulse 1.3s → 0.55s | ? — probably alternation *is* the motion, separate from any orbit | ? |
| Visual register | clean bezel (this doc's default) | clean bezel, but two-color alternation is a new mechanic to add | tbd — bezel vs. deliberate glitch/scanline break |
| HUD label | `// OPERATION TIMER` | `// [something]` | `// [something]` |
| Extra readout | mm:ss.mmm digit clock (separate element, corner-anchored) | none obviously needed | maybe — a "connection strength" or similar readout? |
| Audience | everyone | probably everyone (it's a whole-scene state) | probably scoped to the netrunning player only, via `AUDIENCE` |

## Open questions before building the next one

1. Confirm the exact blue for police lights — check whether the mobile app already
   uses one anywhere before inventing a new hex value.
2. Decide netrunning's visual identity deliberately: same bezel language for
   consistency, or an intentional break into a "hacking" register (scanlines,
   glitch, RGB-split) for genre contrast. Both are valid; pick one on purpose.
3. Confirm per-overlay audience scoping needs (whole table vs. one player) before
   building — it changes whether an `AUDIENCE` entry is needed.
4. Confirm the module boundary: extend `fc99-bridge` directly, or ship as a sibling
   module per the recommendation above.
