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
    const entries = Object.entries(subs)
      .filter(([, val]) => val && typeof val.token === "string")
      .map(([pushId, val]) => ({ pushId, token: val.token }));

    if (!entries.length) {
      console.log("No valid tokens found — skipping push.");
      return null;
    }

    // Notification payload: the webpush.notification block lets the browser
    // display the alert natively when the PWA is closed or backgrounded,
    // which is required for iOS Safari 16.4+ and more reliable on Android.
    // data is kept alongside so onMessage/onBackgroundMessage still receive it.
    const response = await admin.messaging().sendEachForMulticast({
      tokens: entries.map((e) => e.token),
      data: { title, body },
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
        ` (${entries.length} total subscriptions).`,
    );

    // Remove tokens that are no longer registered. Check every response
    // explicitly — don't rely on passive cleanup happening eventually.
    const staleDeletes = [];
    response.responses.forEach((result, i) => {
      if (!result.success) {
        const code = result.error && result.error.code;
        console.warn(`Token[${i}] pushId=${entries[i].pushId} failed: ${code}`);
        if (code === "messaging/registration-token-not-registered") {
          staleDeletes.push(
            admin
              .database()
              .ref(`/subscriptions/${entries[i].pushId}`)
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
