# Audit: "Hack into an NPC's Wire device" — current architecture & what's needed

## Implementation status: built

The design below is implemented, not just planned:

- **`npcOnly` visibility fix** — [src/lib/firestore-db.js](../src/lib/firestore-db.js):
  `createMessage`/`deployMessage` accept `payload.npcOnly`, which skips the
  auto-`isBroadcast` behavior. New `sendAsNpc(convId, payload)` does a
  create-and-deploy-immediately write, always forcing `npcOnly: true`, for
  live impersonated replies.
- **No new GM authoring UI needed for secret NPC↔NPC threads** — confirmed the
  existing "Wire Groups" feature already builds membership from `contactList`
  (NPCs), with the target player as a separate optional field. A group of
  pure NPCs, no player target, already works. The only addition was an
  "NPC-only (hidden)" checkbox on the message composer
  ([ops-7e4f/+page.svelte](../src/routes/ops-7e4f/+page.svelte), "Wire" tab)
  that sets `npcOnly` and disables the recipient chips while checked, plus a
  guard so `notifyBridge('wire.deployed', ...)` never fires for an `npcOnly`
  deploy (it has no "whisper to nobody" mode — the only safe move is skipping
  the call, otherwise it'd default to a public Foundry chat announcement).
- **`device-accounts` management** — new "Hacked Devices" tab in the GM
  console, CRUD for `{ username, password, npcKey }`, `npcKey` chosen from
  the existing contacts list rather than free-typed.
- **`/hacked`** — terminal-style login (`src/routes/hacked/+page.svelte`),
  checks credentials against `device-accounts` client-side, then
  `goto()`s straight to `/hacked/[npcKey]/home` with no storage written.
- **`/hacked/[npcKey]/home`** and **`/hacked/[npcKey]/messages`** — a reduced
  home screen (Wire only — still the only app with real per-person data) and
  a Wire view adapted from the player-facing one: conversation list filtered
  by `npcMembers.includes(npcKey)` instead of `playerMembers`, message
  visibility using the same `staged !== false` gate (unbypassed, per
  decision 3), and the mine/theirs bubble split keyed on `sender === npcKey`
  instead of `type === 'player'` so impersonated replies land correctly.
- **A real bug caught and fixed during the build**: `sendAsNpc` forcing
  `npcOnly: true` on the *message* doesn't retroactively hide a conversation
  whose `isBroadcast`/`playerMembers` are already sticky-true from earlier
  messages — the player app's read filter never checks a message's `npcOnly`
  flag. Without a guard, replying through a hacked device into a Model-A
  "mirror" conversation (one real players can already see) would go live to
  them immediately, with zero staging step and no indication to the hacking
  player that it happened. Fixed by gating the compose box on
  `activeConv?.npcOnly` — impersonated replies only work inside conversations
  that are actually hidden; a Model-A thread renders read-only instead, with
  an explicit note explaining why.
- **Foundry** — `foundry-module-phone/scripts/phone.js` now has a second
  scene-control button, "Hacked Device," opening a second `WirePhoneApp`
  instance pointed at `<wireUrl>/hacked`. The two windows can be open
  simultaneously (separate per-instance `id`s). No credential or filtering
  logic was added to the Foundry module itself — it just opens a URL.
- **Global overlay suppression** — [src/routes/+layout.svelte](../src/routes/+layout.svelte):
  the real player's own incoming-call toast, timer panic/expired overlays,
  timer strip, and bottom nav bar are all suppressed under `/hacked`, the
  same way they already were under `/ops-7e4f`, since a hacked device isn't
  the real player's own phone.

Not built / still exactly as scoped in the "Open" sections below: the
optional GM/roll-triggered automatic popup via a `device.hacked` bridge
event (self-service login via credentials covers the primary case).

## The core insight (confirmed, not assumed)

You had it right: there is no per-user backend segmentation today. Confirmed from
[src/lib/firestore-db.js](../src/lib/firestore-db.js) and
[src/routes/messages/+page.svelte](../src/routes/messages/+page.svelte):

- `subscribeConversations()` queries **all** conversation documents, no `where`
  clause. Every client downloads every conversation.
- `subscribeMessages(convId)` queries **all** messages in a conversation, no
  `where` clause either.
- The "illusion" of a private inbox is a **client-side JS filter**, applied after
  the fact:
  ```js
  // messages/+page.svelte — conversation list
  fsConvsRaw = rawConvs.filter(c =>
    c.isBroadcast || (c.playerMembers ?? []).includes(myCodename)
  );
  // messages/+page.svelte — messages within a thread
  const visible = msgs.filter(m =>
    m.type === 'player' ||
    (m.staged !== false && (!m.recipients || m.recipients.includes(myCodename)))
  );
  ```
- `myCodename` itself comes from `getCodename()` in
  [src/lib/utils.js](../src/lib/utils.js), which just reads `localStorage`
  (`wire-codename`). Nothing server-side ties a session to an identity.

So: **any segmented view is just a different filter predicate over the same
global dataset.** That's good news — it means a "hacked device" view is mostly a
filtering problem, not a data-plumbing problem. It also means there's no real
security boundary here (nor does there need to be, for a small trusted table) —
worth being explicit that "hacking" is a narrative device, not an actual access
control.

## The gap: NPCs don't have a "device" today, only a "name"

Conversations track `npcMembers: string[]` and `playerMembers: string[]`
([firestore-db.js:43-56](../src/lib/firestore-db.js)), but `npcMembers` is just a
list of contact names that have sent messages into that thread — a bookkeeping
field for the GM console's conversation browser. It's not an addressable identity
with its own inbox the way a player's codename is. There's no `contacts` field
(checked the schema via `saveContact()` in
[ops-7e4f/+page.svelte:796](../src/routes/ops-7e4f/+page.svelte:796) — it's just
`name / number / subtitle / color / avatar`) marking an NPC as "has a device" or
giving it a stable identity to filter by.

That's fixable cheaply — an NPC's "device identity" can just *be* their contact
name, reused as the filter key, the same way a player's codename is. No new field
strictly required to make the mechanism work.

## The bigger gap: nothing can be truly hidden today

This is the one that actually matters for the narrative payoff. Look at
`deployMessage()` / `dualWriteMessage()`:

```js
if (!msg.recipients?.length) convUpdate.isBroadcast = true;
```

**Any message sent without explicit recipients automatically becomes visible to
every player.** There is currently no way for the GM to author an NPC-to-NPC
conversation that stays invisible to the whole party by default. The closest
thing today — a group message with no `recipients` — doesn't hide, it broadcasts.

This matters because it determines which of two very different features you're
actually building:

- **Model A — "mirror" view.** The hacked device just shows the *same*
  conversations that NPC already has with players, from their side instead of
  the player's side (their sent texts become "mine," the player's become
  "theirs"). Cheap — no new data, just a different filter + a flipped
  mine/theirs orientation. But narratively thin: players already know
  everything in those threads. Hacking a phone to see messages they already
  read isn't much of a reveal.
- **Model B — "secret chatter" view.** The hacked device reveals NPC-to-NPC (or
  NPC-to-unseen-third-party) conversations the party was never part of and
  never could have seen — actual new information. This is almost certainly what
  makes the beat land at the table. It requires the fix above: a real "hidden by
  default" conversation, not the current "no recipients → broadcast" behavior.

I'd plan for Model B and treat Model A as a free side effect of the same
mechanism (a device's own inbox would naturally include both kinds once the
identity-filter piece exists).

## What's already reusable

More than I expected going in:

1. **The message schema already supports this without new fields.** `type:
   'npc' | 'player'`, `sender`, `recipients[]`, `staged` — an NPC-to-NPC message
   is just `type: 'npc'` with a `sender` and no player `recipients`. The only
   missing piece is a visibility flag that isn't "broadcast."
2. **The Foundry-facing iframe already exists.**
   [foundry-module-phone/scripts/phone.js](../foundry-module-phone/scripts/phone.js)
   opens the deployed Wire app in a Foundry `Application` window via a plain
   `<iframe>`, using a configurable `wireUrl` setting. A "hacked device" viewer
   in Foundry is the same `WirePhoneApp` pattern pointed at a URL carrying the
   target NPC's identity, not a new integration.
3. **Per-player targeting is already solved, just in the other module.**
   [foundry-module/scripts/bridge.js](../foundry-module/scripts/bridge.js)'s
   `AUDIENCE` map + `resolveWhisperIds()` already does "which specific Foundry
   player(s) should see this" by mapping codenames → Foundry user IDs and
   whispering a `ChatMessage`. Triggering a hacked-device popup for *just the
   player who did the hacking* — not the whole table — is the same pattern:
   a new bridge event type (e.g. `device.hacked`) with an `AUDIENCE` entry.
4. **The contact directory already carries the presentation data** (color,
   avatar, subtitle/number) a device "profile" would want to show.

## Decided direction

Settled across discussion, superseding the first-draft "lock-screen PIN +
sessionStorage" idea below:

- **Terminal login, not a phone lock screen.** The Wire device isn't meant to be
  a literal phone replica, so the hacked-device entry point is a
  username/password login (styled as a computer/terminal login screen — also a
  nice visual break from the rest of the app's phone-y chrome, reinforcing "you
  are somewhere you're not supposed to be"), not a numeric PIN pad.
- **No storage of any kind — the URL is the only state.** Rejected
  `sessionStorage` explicitly: it creates sticky state with no way to switch to
  a second device without also building a logout affordance. Instead, a
  successful login redirects into a **nested route carrying the resolved
  identity in the URL itself** — recommended shape:
  `/hacked/[username]/home`, `/hacked/[username]/messages`, etc., with a
  `+layout` at the `[username]` level doing the credential check once (via
  `load`) and handing the resolved NPC identity down to every child page. This
  matches the existing app convention of driving view state off the URL rather
  than stored state (`?sender=`, `?thread=`, `?id=` elsewhere). Logging into a
  *different* device is then just navigating back to the login route and
  entering different credentials — no stale state to clear, because nothing was
  ever saved.
- **Credentials live in a separate `device-accounts` map, not on `contacts`.**
  Decouples the login identity from the NPC's public display name/avatar
  (which stays exactly as-is, edited the same way it is today) — thematically
  better too, since a hacked login being something like `lgoode_admin` rather
  than a contact's plain display name reads more like a real credential than a
  reused name. This map is new: `{ username: { password, npcKey } }` (or similar)
  — `npcKey` is whatever the message-filtering step below actually keys on.
- **Foundry's role stays minimal.** A second button on the existing scene
  controls, next to "Open Wire Phone" — same `WirePhoneApp` `Application`
  pattern, second instance, pointed at the login route instead of the player's
  own view. No credential checking or filtering logic duplicated into Foundry's
  plain JS; all of that stays in the Wire app itself.

Still to design, now that the entry point is settled:

**Mobile app** — the actual per-page filtering (in
[src/routes/messages/+page.svelte](../src/routes/messages/+page.svelte) and
wherever else ends up under `/hacked/[username]/...`):
- Swap the filter predicate from `playerMembers.includes(myCodename)` to
  `npcMembers.includes(npcKey)`, where `npcKey` is just the NPC's existing
  contact name (see decision 4 below) — the *exact same* predicate shape as
  today, just parameterized by a different identity.
- Flip the mine/theirs bubble orientation (currently hardcoded to
  `type === 'player'`) to be relative to whichever identity is active (real
  codename in normal mode, `npcKey` in hacked mode) instead of a fixed type.
- **Impersonated replies reuse the existing compose path**, generalized: today
  `sendResponse()` hardcodes `type: 'player', sender: myCodename`; it becomes
  `type: identity.type, sender: identity.name` (plus `color` for the NPC case),
  where `identity` comes from the real codename in normal mode or the
  `/hacked/[username]` route's resolved NPC in hacked mode. No new send
  pipeline — same `createMessage`-shaped write, same UI compose box, just no
  longer assuming "the sender is always the player."
- **Visibility filtering is unchanged, not bypassed.** Confirmed: `staged`
  keeps its current meaning (authored vs. sent) and the hacked view uses the
  exact same `staged !== false` check the player app already uses. Practically:
  the GM authors a hidden NPC↔NPC conversation as a `staged: false` draft ahead
  of time (per the "bigger gap" fix above), and it only becomes visible through
  a hack once the GM flips it live — same mental model as staging any other
  message today, just applied to hidden content instead of broadcast content.
  A live impersonated reply is naturally `staged: true` (sent) at write time,
  same as a normal player response.

**Data / GM console** — [src/lib/firestore-db.js](../src/lib/firestore-db.js) +
ops-7e4f — unchanged from the first draft:
- Add a real "hidden" visibility path so an NPC-only conversation doesn't
  auto-broadcast just because it has no player recipients (see "the bigger gap"
  above — this is still the prerequisite for the hack to reveal anything new).
- Add a GM console flow for authoring NPC↔NPC threads.

## Decided

1. **Model B** — real NPC↔NPC secret conversations, not a mirror of what
   players already saw.
2. **Impersonation is in** — players can reply as the compromised NPC, not
   just observe. Turns out to be low-cost: it's the existing reply pipeline
   with the sender identity swapped, not a new feature.
3. **`staged` keeps its current meaning and isn't bypassed** — it's an
   authored-vs-sent gate the GM already understands and will work around
   themselves; the hacked view just respects it exactly like the normal app
   does.
4. **`device-accounts`' `npcKey` is just the NPC's existing contact name** —
   no separate first-class device identity for now.

## Still open / optional

- Separately from self-service login: do you also want a GM- or
  roll-triggered *automatic* popup (a new `device.hacked` bridge event +
  bridge.js's existing `AUDIENCE`/whisper pattern) for moments where the
  fiction is "you're in" rather than "go type the credentials you found"? Not
  required for the core mechanism — the login route alone covers the primary
  case — but worth a yes/no whenever you're ready to talk Foundry-side
  triggering specifics.
