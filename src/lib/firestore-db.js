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
 * Rename a conversation, overriding its computed default name.
 * Pass `name: null` to clear the override and revert to the computed default
 * (see `defaultConversationName`).
 */
export async function renameConversation(conversationId, name) {
  return setDoc(doc(db, 'conversations', conversationId), { name: name || null }, { merge: true });
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

// ── Conversation identity ─────────────────────────────────────────────────────

function slugify(name) {
  return (name ?? '').toLowerCase().trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

/**
 * Compute a conversation's stable Firestore ID from its exact participant set.
 * A conversation's identity IS its participants — the same NPC(s) sending to
 * the same audience always land in the same thread; a different audience (or
 * a different NPC roster) is a different thread, deliberately, so ad-hoc
 * recipient picks get their own persistent conversation instead of being
 * lumped into whichever thread that NPC happened to use last.
 *
 * `npcOnly` gets its own ID namespace (prefix), not a suffix on the shared
 * shape — this guarantees a hidden NPC-only "hacked device" thread can never
 * collide with a public thread, even if the same NPC roster / recipient list
 * is reused, and even if a GM picks a saved Group preset and the "Hidden —
 * NPC-only" toggle at the same time.
 *
 * @param {{ npcNames: string[], recipients?: string[], npcOnly?: boolean }} params
 */
export function conversationKey({ npcNames, recipients, npcOnly }) {
  const npcPart = [...new Set(npcNames)].map(slugify).sort().join('+');
  if (npcOnly) return `conv_npcOnly_${npcPart}`;
  const audiencePart = recipients?.length
    ? [...new Set(recipients)].map(slugify).sort().join('+')
    : 'everyone';
  return `conv_${npcPart}__${audiencePart}`;
}

/**
 * Compute a conversation's default display name from its participants, e.g.
 * "Dave @Everyone", "Dave, Regi, Val", "Dave, Sam @Everyone". Callers should
 * prefer an explicit override first: `conv.name ?? defaultConversationName(conv)`.
 */
export function defaultConversationName({ npcMembers = [], playerMembers = [], isBroadcast }) {
  const npcPart = npcMembers.join(', ');
  if (isBroadcast) return `${npcPart} @Everyone`;
  return [...npcMembers, ...playerMembers].join(', ');
}

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
  if (payload.locationRequest)    msgData.locationRequest = true;
  if (payload.npcOnly)            msgData.npcOnly = true;
  if (payload.timeLabel)          msgData.timeLabel = payload.timeLabel;

  const cleanMsg = Object.fromEntries(
    Object.entries(msgData).filter(([, v]) => v !== null),
  );

  // lastMessageAt is required for the subscribeConversations orderBy to include this doc.
  // Membership/preview fields are withheld until deploy so players don't see empty conversations.
  const npcRoster = payload.npcMembers?.length ? payload.npcMembers : [payload.sender];
  const convUpdate = {
    npcMembers:    arrayUnion(...npcRoster),
    lastMessageAt: payload.ts,
  };
  // Sticky, cosmetic marker for the GM console's own conversation browser — the
  // actual player-side invisibility comes from never setting isBroadcast/
  // playerMembers below, not from this flag.
  if (payload.npcOnly)   convUpdate.npcOnly = true;

  await setDoc(doc(db, 'conversations', convId), convUpdate, { merge: true });
  return addDoc(collection(db, 'conversations', convId, 'messages'), cleanMsg);
}

/**
 * Deploy a staged NPC message: flip staged → true, update the conversation preview,
 * and set membership fields so players can now see the conversation.
 *
 * `msg.npcOnly` opts a message out of the recipients-empty-means-broadcast
 * default below — used for NPC↔NPC conversations that must stay invisible to
 * every player (see docs/npc-device-hack-audit.md) rather than becoming a
 * broadcast just because no player recipients were named.
 */
export async function deployMessage(convId, messageId, msg) {
  await updateDoc(
    doc(db, 'conversations', convId, 'messages', messageId),
    { staged: true }
  );
  const convUpdate = {
    lastMessageAt:     msg.ts,
    lastMessageSender: msg.sender,
    lastMessageText:   msg.imageUrl
      ? `📷 ${msg.text || 'Photo'}`
      : (msg.text || ''),
  };
  if (!msg.recipients?.length && !msg.npcOnly) convUpdate.isBroadcast = true;
  if (msg.recipients?.length)  convUpdate.playerMembers = arrayUnion(...msg.recipients);
  await setDoc(doc(db, 'conversations', convId), convUpdate, { merge: true });
}

/**
 * Create-and-immediately-deploy an NPC message in one call — used for live
 * replies sent through a hacked-device view (src/routes/hacked), where the
 * message is "sent" the instant it's typed rather than staged for a later
 * GM deploy step. Always `npcOnly` — anything written through a hacked
 * device must never leak into the normal broadcast/targeted player inbox.
 *
 * @param {string} convId
 * @param {{ sender: string, color?: string, text: string, ts: number }} payload
 */
export async function sendAsNpc(convId, payload) {
  const full = { ...payload, npcOnly: true };
  const ref = await createMessage(convId, full);
  await deployMessage(convId, ref.id, full);
  return ref;
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

/**
 * Record a player's Share/Decline response to a `locationRequest` message.
 * Adds a response bubble to the thread and, on share, flips the
 * conversation's `locationSharing` flag on.
 *
 * @param {string} convId
 * @param {{ requestMessageId: string, codename: string, choice: 'share'|'decline' }} payload
 */
export async function respondLocationShare(convId, { requestMessageId, codename, choice }) {
  const ts = Date.now();
  const text = choice === 'share' ? 'Shared location.' : 'Declined to share location.';
  const msgData = {
    type:          'player',
    sender:        codename,
    text,
    ts,
    staged:        true,
    respondsTo:    requestMessageId,
    locationChoice: choice,
  };

  const convUpdate = {
    lastMessageAt:     ts,
    lastMessageSender: codename,
    lastMessageText:   text,
  };
  if (choice === 'share') convUpdate.locationSharing = { enabled: true, ts, by: codename };

  await setDoc(doc(db, 'conversations', convId), convUpdate, { merge: true });
  return addDoc(collection(db, 'conversations', convId, 'messages'), msgData);
}

/**
 * Turn off active location sharing for a conversation.
 */
export async function cancelLocationShare(convId, codename) {
  const ts = Date.now();
  return setDoc(
    doc(db, 'conversations', convId),
    { locationSharing: { enabled: false, ts, by: codename } },
    { merge: true }
  );
}
