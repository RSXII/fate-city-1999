"use strict";

const { onValueCreated, onValueUpdated } = require("firebase-functions/v2/database");
const admin = require("firebase-admin");

admin.initializeApp();

const RTDB_CONFIG = {
  instance: "cpr-wire-device-default-rtdb",
  region: "us-central1",
};

/**
 * Shared FCM dispatch logic.
 * @param {object} message - The message object from RTDB.
 */
async function dispatchNotification(message) {
  const title = String(message.sender || "Wire");
  const body = message.imageUrl
    ? message.text
      ? message.text + " 📷"
      : "📷 Photo"
    : String(message.text || "");

  // Load all subscription entries from RTDB.
  const subsSnap = await admin.database().ref("/subscriptions").once("value");
  const subs = subsSnap.val();

  if (!subs) {
    console.log("No subscriptions — skipping push.");
    return;
  }

  // Build { pushId, token } pairs. Deduplicate by token to avoid multiple
  // notifications on a device that re-subscribed after clearing localStorage.
  const seenTokens = new Set();
  const entries = Object.entries(subs)
    .filter(([, val]) => val && typeof val.token === "string")
    .filter(([, val]) => {
      if (seenTokens.has(val.token)) return false;
      seenTokens.add(val.token);
      return true;
    })
    .map(([pushId, val]) => ({ pushId, token: val.token, codename: val.codename || null }));

  if (!entries.length) {
    console.log("No valid tokens found — skipping push.");
    return;
  }

  // If the message targets specific recipients, only notify those players.
  const recipients = Array.isArray(message.recipients) ? message.recipients : null;
  const targets = recipients
    ? entries.filter((e) => e.codename && recipients.includes(e.codename))
    : entries;

  if (!targets.length) {
    console.log("No matching subscriber tokens for recipients — skipping push.");
    return;
  }

  // Notification payload: the webpush.notification block lets the browser
  // display the alert natively when the PWA is closed or backgrounded,
  // which is required for iOS Safari 16.4+ and more reliable on Android.
  const response = await admin.messaging().sendEachForMulticast({
    tokens: targets.map((e) => e.token),
    webpush: {
      headers: { Urgency: "high" },
      notification: {
        title,
        body,
        icon: "/images/icon-192.png",
        badge: "/images/icon-192.png",
      },
    },
  });

  console.log(
    `FCM: ${response.successCount} delivered, ${response.failureCount} failed` +
      ` (${targets.length} targeted, ${entries.length} total subscriptions).`,
  );

  // Remove tokens that are no longer registered.
  const staleDeletes = [];
  response.responses.forEach((result, i) => {
    if (!result.success) {
      const code = result.error && result.error.code;
      console.warn(`Token[${i}] pushId=${targets[i].pushId} failed: ${code}`);
      if (code === "messaging/registration-token-not-registered") {
        staleDeletes.push(
          admin
            .database()
            .ref(`/subscriptions/${targets[i].pushId}`)
            .remove(),
        );
      }
    }
  });

  if (staleDeletes.length) {
    await Promise.all(staleDeletes);
    console.log(`Cleaned up ${staleDeletes.length} stale subscription(s).`);
  }
}

/**
 * Fires when a new message is written to /messages/{messageId}.
 * Skips staged messages (staged === false) — those need GM approval before
 * players are notified.
 */
exports.notifyOnNewMessage = onValueCreated(
  { ref: "/messages/{messageId}", ...RTDB_CONFIG },
  async (event) => {
    const message = event.data.val();
    if (!message) return null;

    // staged === false means the GM queued this for later — don't notify yet.
    if (message.staged === false) {
      console.log("Message is staged — deferring notification until deployed.");
      return null;
    }

    await dispatchNotification(message);
    return null;
  },
);

/**
 * Fires when an existing message is updated.
 * Sends notifications only when staged transitions false → true (i.e. the GM
 * deploys a previously-staged message). All other updates are ignored.
 */
exports.notifyOnMessageDeployed = onValueUpdated(
  { ref: "/messages/{messageId}", ...RTDB_CONFIG },
  async (event) => {
    const before = event.data.before.val();
    const after = event.data.after.val();

    // Only act when the message transitions from staged to live.
    if (before?.staged !== false || after?.staged !== true) return null;

    console.log(`Message ${event.params.messageId} deployed — sending notifications.`);
    await dispatchNotification(after);
    return null;
  },
);
