#!/usr/bin/env node
// ── Migration: static dossier data → Firestore ───────────────────────────────
// Reads NPCS (persons.js), DISTRICTS + LOCATIONS (locations.js), and ENTRIES
// (intel.js) and writes each into its own Firestore collection, adding an
// `order` field so the original array order survives (Firestore collections
// aren't inherently ordered).
//
// Usage:
//   node scripts/migrate-content-to-firestore.mjs             # live run
//   node scripts/migrate-content-to-firestore.mjs --dry-run   # preview only, no writes
//
// Safe to re-run: doc ID = entry.id, so existing docs are overwritten rather
// than duplicated. The source data files are never modified.

import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, doc, setDoc } from 'firebase/firestore';

import { NPCS } from '../src/lib/data/persons.js';
import { DISTRICTS, LOCATIONS } from '../src/lib/data/locations.js';
import { ENTRIES } from '../src/lib/data/intel.js';

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

const app = getApps().length ? getApps()[0] : initializeApp(FIREBASE_CONFIG);
const db  = getFirestore(app);

async function migrateCollection(name, entries) {
  console.log(`${name} — ${entries.length} entries`);

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    if (!entry.id) {
      console.warn(`  ⚠  entry at index ${i} (${entry.name || '?'}) has no id — skipped`);
      continue;
    }
    console.log(`  ${DRY_RUN ? '(dry run) ' : ''}${name}/${entry.id}  order=${i}  "${entry.name}"`);
    if (!DRY_RUN) {
      await setDoc(doc(db, name, entry.id), { ...entry, order: i });
    }
  }
  console.log();
}

async function main() {
  if (DRY_RUN) {
    console.log('── DRY RUN ─ nothing will be written to Firestore ──\n');
  }

  await migrateCollection('persons', NPCS);
  await migrateCollection('districts', DISTRICTS);
  await migrateCollection('points_of_interest', LOCATIONS);
  await migrateCollection('intel', ENTRIES);

  const total = NPCS.length + DISTRICTS.length + LOCATIONS.length + ENTRIES.length;
  console.log(DRY_RUN
    ? `Dry run done. ${total} entries total across 4 collections.\nRe-run without --dry-run to write to Firestore.`
    : `Migration complete — ${total} entries written across 4 collections.`
  );

  process.exit(0);
}

main().catch(e => { console.error('\nMigration failed:', e); process.exit(1); });
