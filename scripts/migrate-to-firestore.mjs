#!/usr/bin/env node
// ── Migration: RTDB → Firestore ──────────────────────────────────────────────
// Reads wire messages, player responses, and groups from Firebase RTDB and
// writes them into Firestore conversations with a messages subcollection.
//
// Usage:
//   node scripts/migrate-to-firestore.mjs             # live run
//   node scripts/migrate-to-firestore.mjs --dry-run   # preview only, no writes
//
// Safe to re-run: stable document IDs mean existing Firestore docs are
// overwritten rather than duplicated.  RTDB is never modified.
//
// Requires Node.js 18+ (built-in fetch).

import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, doc, setDoc } from 'firebase/firestore';

const DRY_RUN = process.argv.includes('--dry-run');

// ── Firebase config (mirrors src/lib/firebase-db.js) ─────────────────────────
const FIREBASE_CONFIG = {
  apiKey:            'AIzaSyA7OmVO18bOequMLYUieWGhVabB4_vTlOs',
  authDomain:        'cpr-wire-device.firebaseapp.com',
  databaseURL:       'https://cpr-wire-device-default-rtdb.firebaseio.com',
  projectId:         'cpr-wire-device',
  storageBucket:     'cpr-wire-device.firebasestorage.app',
  messagingSenderId: '435892659027',
  appId:             '1:435892659027:web:dbdffda17e128484a437a6',
};

const RTDB_URL = 'https://cpr-wire-device-default-rtdb.firebaseio.com';

// ── Firebase init ─────────────────────────────────────────────────────────────
const app = getApps().length ? getApps()[0] : initializeApp(FIREBASE_CONFIG);
const db  = getFirestore(app);

// ── Helpers ───────────────────────────────────────────────────────────────────

async function rtdbGet(path) {
  const res = await fetch(`${RTDB_URL}/${path}.json`);
  if (!res.ok) throw new Error(`RTDB GET /${path} → HTTP ${res.status}`);
  return res.json();
}

// URL-safe slug from an NPC sender name for use as a Firestore doc ID.
function senderSlug(name) {
  return 'sender_' + String(name).toLowerCase().trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

// Strip null/undefined before writing — Firestore accepts them but they clutter the console.
function clean(obj) {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== null && v !== undefined)
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  if (DRY_RUN) {
    console.log('── DRY RUN ─ nothing will be written to Firestore ──\n');
  }

  // 1. Read everything from RTDB
  console.log('Reading RTDB…');
  const [rawMsgs, rawResponses, rawGroups] = await Promise.all([
    rtdbGet('messages'),
    rtdbGet('player-responses'),
    rtdbGet('groups'),
  ]);

  const messages  = Object.entries(rawMsgs       || {}).map(([id, m]) => ({ _id: id, ...m }));
  const responses = Object.entries(rawResponses  || {}).map(([id, r]) => ({ _id: id, ...r }));
  const groups    = rawGroups || {};

  console.log(`  ${messages.length} NPC messages`);
  console.log(`  ${responses.length} player responses`);
  console.log(`  ${Object.keys(groups).length} groups\n`);

  // 2. Build conversation map keyed by stable Firestore doc ID
  //    • group_<rtdbGroupId>  for group threads
  //    • sender_<slug>        for 1:1 / broadcast threads
  const convMap = {};

  for (const m of messages) {
    let convId;

    if (m.groupId) {
      convId = `group_${m.groupId}`;
      if (!convMap[convId]) {
        const grp = groups[m.groupId] ?? {};
        convMap[convId] = {
          name:          m.groupName || grp.name || 'Group Chat',
          npcMembers:    new Set(grp.members ?? []),
          playerMembers: new Set(grp.targetCodename ? [grp.targetCodename] : []),
          isBroadcast:   false,
          createdAt:     m.ts,
          lastTs:        0,
          items:         [],
        };
      }
    } else {
      convId = senderSlug(m.sender);
      if (!convMap[convId]) {
        convMap[convId] = {
          name:          null,
          npcMembers:    new Set(),
          playerMembers: new Set(),
          isBroadcast:   false,
          createdAt:     m.ts,
          lastTs:        0,
          items:         [],
        };
      }
    }

    const c = convMap[convId];
    c.npcMembers.add(m.sender);

    if (m.recipients?.length) {
      m.recipients.forEach(r => c.playerMembers.add(r));
    } else {
      c.isBroadcast = true;
    }

    if (m.ts < c.createdAt) c.createdAt = m.ts;
    if (m.ts > c.lastTs)    c.lastTs    = m.ts;

    c.items.push(clean({
      _rtdbId:       m._id,
      type:          'npc',
      sender:        m.sender,
      color:         m.color         || null,
      text:          m.text          || '',
      ts:            m.ts,
      staged:        m.staged !== false,  // true = live on player devices
      imageUrl:      m.imageUrl      || null,
      attachmentUrl: m.attachmentUrl || null,
      recipients:    m.recipients?.length ? m.recipients : null,
    }));
  }

  for (const r of responses) {
    let convId;
    if (r.groupId)      convId = `group_${r.groupId}`;
    else if (r.context) convId = senderSlug(r.context);
    else {
      console.warn(`  ⚠  Response ${r._id} has no groupId or context — skipped`);
      continue;
    }

    if (!convMap[convId]) {
      console.warn(`  ⚠  Response ${r._id} references unknown conv "${r.context ?? r.groupId}" — skipped`);
      continue;
    }

    const c = convMap[convId];
    if (!c.isBroadcast) c.playerMembers.add(r.codename);
    if (r.ts > c.lastTs) c.lastTs = r.ts;

    c.items.push(clean({
      _rtdbId: r._id,
      type:    'player',
      sender:  r.codename,
      text:    r.text   || '',
      ts:      r.ts,
      staged:  true,
      status:  r.status || null,
    }));
  }

  // 3. Write to Firestore
  const convEntries = Object.entries(convMap);
  console.log(`Found ${convEntries.length} conversation(s):\n`);

  let convCount = 0;
  let msgCount  = 0;

  for (const [convId, c] of convEntries) {
    c.items.sort((a, b) => a.ts - b.ts);
    const last = c.items[c.items.length - 1];

    const npcMembers    = [...c.npcMembers];
    const playerMembers = c.isBroadcast ? [] : [...c.playerMembers];
    const memberLabel   = c.isBroadcast
      ? '@Everyone'
      : playerMembers.map(p => `@${p}`).join(' ') || '(no players yet)';

    const convDoc = clean({
      name:              c.name,
      npcMembers,
      playerMembers,
      isBroadcast:       c.isBroadcast,
      createdAt:         c.createdAt,
      lastMessageAt:     c.lastTs,
      lastMessageSender: last?.sender || '',
      lastMessageText:   last
        ? (last.imageUrl ? `📷 ${last.text || 'Photo'}` : (last.text || ''))
        : '',
    });

    console.log(`  ${convId}`);
    console.log(`    NPCs:     ${npcMembers.join(', ')}`);
    console.log(`    Players:  ${memberLabel}`);
    console.log(`    Messages: ${c.items.length}`);

    if (!DRY_RUN) {
      await setDoc(doc(db, 'conversations', convId), convDoc);

      for (const item of c.items) {
        const { _rtdbId, ...msgData } = item;
        await setDoc(
          doc(db, 'conversations', convId, 'messages', _rtdbId),
          msgData
        );
      }
      console.log(`    ✓ written`);
    } else {
      console.log(`    (dry run — skipped)`);
    }

    console.log();
    convCount++;
    msgCount += c.items.length;
  }

  console.log(DRY_RUN
    ? `Dry run done. ${convCount} conversations, ${msgCount} messages total.\nRe-run without --dry-run to write to Firestore.`
    : `Migration complete — ${convCount} conversations, ${msgCount} messages written to Firestore.\nRTDB data was NOT modified.`
  );

  process.exit(0);
}

main().catch(e => { console.error('\nMigration failed:', e); process.exit(1); });
