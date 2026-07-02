// Phase 2: Firebase Cloud Messaging service worker.
// importScripts must use the compat build — modular SDK does not work in SW scope.
importScripts(
  "https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js",
);
importScripts(
  "https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js",
);

firebase.initializeApp({
  apiKey: "AIzaSyA7OmVO18bOequMLYUieWGhVabB4_vTlOs",
  authDomain: "cpr-wire-device.firebaseapp.com",
  databaseURL: "https://cpr-wire-device-default-rtdb.firebaseio.com",
  projectId: "cpr-wire-device",
  storageBucket: "cpr-wire-device.firebasestorage.app",
  messagingSenderId: "435892659027",
  appId: "1:435892659027:web:dbdffda17e128484a437a6",
});

const messaging = firebase.messaging();

// Background messages (app not in foreground).
// When webpush.notification is present in the FCM payload, the Firebase SDK
// automatically displays that notification. Calling showNotification here too
// would produce a second (duplicate) notification. Only show manually for
// data-only messages (no notification block) so a single alert is shown.
messaging.onBackgroundMessage((payload) => {
  if (payload.notification) return;

  const title = (payload.data && payload.data.title) || "New Wire Message";
  const body = (payload.data && payload.data.body) || "";
  return self.registration.showNotification(title, {
    body,
    icon: "images/icon-192.png",
  });
});

self.addEventListener("install", (e) => self.skipWaiting());
self.addEventListener("activate", (e) => self.clients.claim());
self.addEventListener("fetch", (e) => {
  // Pass-through: no caching — Firebase message data must always be fresh.
});
