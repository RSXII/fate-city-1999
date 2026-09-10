// ── Firestore — dossier content (persons, districts, points of interest, intel) ──
// These collections replace the old hand-edited arrays in src/lib/data/{persons,
// locations,intel}.js. Same Firestore project/app as firestore-db.js.

import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
} from 'firebase/firestore';
import { db } from '$lib/firestore-db.js';

/**
 * Subscribe to a content collection, ordered by its `order` field.
 * Returns an unsubscribe function — return it from onMount for cleanup.
 *
 * @param {string} collectionName - 'persons' | 'districts' | 'points_of_interest' | 'intel'
 * @param {(entries: object[]) => void} callback
 */
export function subscribeContent(collectionName, callback) {
  const q = query(collection(db, collectionName), orderBy('order'));
  return onSnapshot(q, snapshot => {
    callback(snapshot.docs.map(d => ({ ...d.data(), id: d.id })));
  });
}

/**
 * Create or fully replace one entry.
 * @param {string} collectionName
 * @param {string} id
 * @param {object} data
 */
export async function setContentEntry(collectionName, id, data) {
  return setDoc(doc(db, collectionName, id), data);
}

/**
 * Merge a partial update into one entry (e.g. flipping `hidden`) without
 * touching the rest of the document.
 */
export async function updateContentEntry(collectionName, id, partialData) {
  return updateDoc(doc(db, collectionName, id), partialData);
}

/**
 * Delete one entry permanently.
 */
export async function deleteContentEntry(collectionName, id) {
  return deleteDoc(doc(db, collectionName, id));
}
