"use strict";

const { onValueCreated } = require("firebase-functions/v2/database");
const admin = require("firebase-admin");

admin.initializeApp();

/**
 * Fires when a new message is written to /messages/{messageId}.
 * Sends an FCM push to every token in /subscriptions, then immediately
 * removes any entry whose token is no longer registered.
 */
exports.notifyOnNewMessage = onValueCreated(
  {
    ref: "/messages/{messageId}",
    instance: "cpr-wire-device-default-rtdb",
    region: "us-central1",
  },
  async (event) => {
    const message = event.data.val();
    if (!message) return null;

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
      return null;
    }

    // Build { pushId, token } pairs. pushId is the Firebase-generated key
    // stored in localStorage on the client so it can be deleted on unsubscribe.
    // Deduplicate by token: if the same FCM token was stored under multiple
    // pushIds (e.g. the user re-subscribed after clearing localStorage),
    // sending to each entry would deliver multiple notifications to one device.
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
      return null;
    }

    // If the message targets specific recipients, only notify those players.
    const recipients = Array.isArray(message.recipients) ? message.recipients : null;
    const targets = recipients
      ? entries.filter((e) => e.codename && recipients.includes(e.codename))
      : entries;

    if (!targets.length) {
      console.log("No matching subscriber tokens for recipients — skipping push.");
      return null;
    }

    // Notification payload: the webpush.notification block lets the browser
    // display the alert natively when the PWA is closed or backgrounded,
    // which is required for iOS Safari 16.4+ and more reliable on Android.
    // data is kept alongside so onMessage/onBackgroundMessage still receive it.
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

    // Remove tokens that are no longer registered. Check every response
    // explicitly — don't rely on passive cleanup happening eventually.
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

    return null;
  },
);
