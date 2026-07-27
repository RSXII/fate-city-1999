// ── Firestore — conversations & messages ──────────────────────────────────────
// Uses the Firebase JS SDK for real-time listeners (.onSnapshot).
// The existing firebase-db.js RTDB REST helpers are untouched — both databases
// coexist in the same Firebase project during the migration period.

import { initializeApp, getApps } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  arrayUnion,
} from 'firebase/firestore';
import { FIREBASE_CONFIG } from '$lib/firebase-db.js';

// Initialize once — safe to import from multiple modules
const app = getApps().length ? getApps()[0] : initializeApp(FIREBASE_CONFIG);
export const db = getFirestore(app);

// ── Conversations ─────────────────────────────────────────────────────────────

/**
 * Subscribe to all conversations, ordered by most-recently-active.
 * Returns an unsubscribe function — call it in onDestroy.
 *
 * @param {(conversations: object[]) => void} callback
 */
export function subscribeConversations(callback) {
  const q = query(collection(db, 'conversations'), orderBy('lastMessageAt', 'desc'));
  return onSnapshot(q, snapshot => {
    callback(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}

/**
 * Create a new conversation document.
 * @param {{ name: string|null, npcMembers: string[], playerMembers: string[], isBroadcast: boolean }} data
 */
export async function createConversation(data) {
  const now = Date.now();
  return addDoc(collection(db, 'conversations'), {
    name: data.name ?? null,
    npcMembers: data.npcMembers ?? [],
    playerMembers: data.playerMembers ?? [],
    isBroadcast: data.isBroadcast ?? false,
    createdAt: now,
    lastMessageAt: now,
    lastMessageText: '',
    lastMessageSender: '',
  });
}

/**
 * Update conversation metadata (members, name, last-message preview, etc.).
 */
export async function updateConversation(conversationId, data) {
  return updateDoc(doc(db, 'conversations', conversationId), data);
}

/**
 * Set a full conversation document by ID — used by the migration script
 * to write with a predictable ID rather than an auto-generated one.
 */
export async function setConversation(conversationId, data) {
  return setDoc(doc(db, 'conversations', conversationId), data);
}

// ── Messages ─────────────────────────────────────────────────────────────────

/**
 * Subscribe to all messages in a conversation, ordered oldest-first.
 * Returns an unsubscribe function — call it in onDestroy.
 *
 * @param {string} conversationId
 * @param {(messages: object[]) => void} callback
 */
export function subscribeMessages(conversationId, callback) {
  const q = query(
    collection(db, 'conversations', conversationId, 'messages'),
    orderBy('ts', 'asc')
  );
  return onSnapshot(q, snapshot => {
    callback(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}

/**
 * Add a message to a conversation and update the conversation's preview fields.
 *
 * @param {string} conversationId
 * @param {{
 *   type: 'npc' | 'player',
 *   sender: string,
 *   color?: string,
 *   text: string,
 *   ts: number,
 *   staged?: boolean,
 *   imageUrl?: string,
 *   status?: string,
 * }} messageData
 */
export async function addMessage(conversationId, messageData) {
  const ref = await addDoc(
    collection(db, 'conversations', conversationId, 'messages'),
    messageData
  );
  await updateDoc(doc(db, 'conversations', conversationId), {
    lastMessageAt: messageData.ts,
    lastMessageSender: messageData.sender,
    lastMessageText: messageData.imageUrl
      ? `📷 ${messageData.text || 'Photo'}`
      : (messageData.text || ''),
  });
  return ref;
}

/**
 * Set a message document by ID — used by the migration script.
 */
export async function setMessage(conversationId, messageId, data) {
  return setDoc(
    doc(db, 'conversations', conversationId, 'messages', messageId),
    data
  );
}

/**
 * Update a message (e.g. flip staged, set status).
 */
export async function updateMessage(conversationId, messageId, data) {
  return updateDoc(
    doc(db, 'conversations', conversationId, 'messages', messageId),
    data
  );
}

/**
 * Delete a message permanently.
 */
export async function deleteMessage(conversationId, messageId) {
  return deleteDoc(doc(db, 'conversations', conversationId, 'messages', messageId));
}

// ── Dual-write helpers (GM console → Firestore + RTDB) ───────────────────────

/**
 * Compute the stable Firestore conversation ID from a message or response object.
 *   NPC message:      { groupId?, sender }
 *   Player response:  { groupId?, context }
 */
export function convIdForMsg(msg) {
  if (msg.groupId) return `group_${msg.groupId}`;
  const name = msg.sender ?? msg.context ?? '';
  return 'sender_' + name.toLowerCase().trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

/**
 * Write a new NPC message to Firestore and upsert the parent conversation.
 * Call this immediately after every dbPost('messages', payload) in the GM console.
 *
 * @param {string} convId       — from convIdForMsg(payload)
 * @param {object} payload      — the same object sent to RTDB
 * @param {string} rtdbMsgId    — the push key returned by dbPost (result.name)
 */
export async function dualWriteMessage(convId, payload, rtdbMsgId) {
  const msgData = {
    type:   'npc',
    sender: payload.sender,
    color:  payload.color  || null,
    text:   payload.text   || '',
    ts:     payload.ts,
    staged: false,
  };
  if (payload.imageUrl)        msgData.imageUrl   = payload.imageUrl;
  if (payload.recipients?.length) msgData.recipients = payload.recipients;

  // Strip nulls before writing
  const cleanMsg = Object.fromEntries(
    Object.entries(msgData).filter(([, v]) => v !== null),
  );

  const convUpdate = {
    npcMembers:        arrayUnion(payload.sender),
    lastMessageAt:     payload.ts,
    lastMessageSender: payload.sender,
    lastMessageText:   payload.imageUrl
      ? `📷 ${payload.text || 'Photo'}`
      : (payload.text || ''),
  };
  // isBroadcast is sticky — only ever set to true, never cleared back to false
  if (!payload.recipients?.length) convUpdate.isBroadcast = true;
  if (payload.recipients?.length)  convUpdate.playerMembers = arrayUnion(...payload.recipients);
  if (payload.groupName)           convUpdate.name = payload.groupName;

  await setDoc(doc(db, 'conversations', convId), convUpdate, { merge: true });
  await setDoc(doc(db, 'conversations', convId, 'messages', rtdbMsgId), cleanMsg);
}

/**
 * Write a player response to Firestore and update the conversation preview.
 * Call this immediately after dbPost('player-responses', payload) on the player page.
 *
 * @param {string} convId     — from convIdForMsg({ groupId?, sender: activeSender })
 * @param {object} payload    — { codename, text, ts, groupId?, context? }
 * @param {string} rtdbMsgId  — push key returned by dbPost (result.name)
 */
// ── Phase 5: Firestore-only writes (RTDB fully removed) ──────────────────────

/**
 * Create a new NPC message in Firestore (no RTDB write).
 * Upserts the parent conversation and auto-generates the message doc ID.
 */
export async function createMessage(convId, payload) {
  const msgData = {
    type:   'npc',
    sender: payload.sender,
    color:  payload.color  || null,
    text:   payload.text   || '',
    ts:     payload.ts,
    staged: false,
  };
  if (payload.imageUrl)           msgData.imageUrl   = payload.imageUrl;
  if (payload.recipients?.length) msgData.recipients = payload.recipients;

  const cleanMsg = Object.fromEntries(
    Object.entries(msgData).filter(([, v]) => v !== null),
  );

  // Only update structural/membership fields — preview fields update on deploy, not on stage
  const convUpdate = { npcMembers: arrayUnion(payload.sender) };
  if (!payload.recipients?.length) convUpdate.isBroadcast = true;
  if (payload.recipients?.length)  convUpdate.playerMembers = arrayUnion(...payload.recipients);
  if (payload.groupName)           convUpdate.name = payload.groupName;

  await setDoc(doc(db, 'conversations', convId), convUpdate, { merge: true });
  return addDoc(collection(db, 'conversations', convId, 'messages'), cleanMsg);
}

/**
 * Deploy a staged NPC message: flip staged → true and update the conversation preview.
 */
export async function deployMessage(convId, messageId, msg) {
  await updateDoc(
    doc(db, 'conversations', convId, 'messages', messageId),
    { staged: true }
  );
  await setDoc(doc(db, 'conversations', convId), {
    lastMessageAt:     msg.ts,
    lastMessageSender: msg.sender,
    lastMessageText:   msg.imageUrl
      ? `📷 ${msg.text || 'Photo'}`
      : (msg.text || ''),
  }, { merge: true });
}

/**
 * Create a player response in Firestore (no RTDB write).
 * Auto-generates the message doc ID.
 */
export async function createResponse(convId, payload) {
  const msgData = {
    type:   'player',
    sender: payload.codename,
    text:   payload.text || '',
    ts:     payload.ts,
    staged: true,
  };

  const convUpdate = {
    lastMessageAt:     payload.ts,
    lastMessageSender: payload.codename,
    lastMessageText:   payload.text || '',
  };

  await setDoc(doc(db, 'conversations', convId), convUpdate, { merge: true });
  return addDoc(collection(db, 'conversations', convId, 'messages'), msgData);
}

export async function dualWriteResponse(convId, payload, rtdbMsgId) {
  const msgData = {
    type:   'player',
    sender: payload.codename,
    text:   payload.text || '',
    ts:     payload.ts,
    staged: true,
  };

  const convUpdate = {
    lastMessageAt:     payload.ts,
    lastMessageSender: payload.codename,
    lastMessageText:   payload.text || '',
  };

  await setDoc(doc(db, 'conversations', convId), convUpdate, { merge: true });
  await setDoc(doc(db, 'conversations', convId, 'messages', rtdbMsgId), msgData);
}
