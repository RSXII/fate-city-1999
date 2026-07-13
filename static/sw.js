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

// ── Caching strategy ──────────────────────────────────────────────────────────
// Bump CACHE_NAME on significant deploys to purge stale assets from all clients.
const CACHE_NAME = "wire-v2";

// Vite outputs content-hashed filenames here — safe to cache indefinitely.
const IMMUTABLE_RE = /\/_app\/immutable\//;

// Other static asset extensions worth caching (images, sounds, fonts, etc.)
const STATIC_EXTS = /\.(png|jpe?g|gif|webp|svg|css|js|mp3|woff2?)(\?.*)?$/i;

// Firebase REST, FCM, and CDN imports must never be served from cache.
const PASSTHROUGH = /firebaseio\.com|googleapis\.com|gstatic\.com/;

self.addEventListener("install", (e) => self.skipWaiting());

self.addEventListener("activate", (e) => {
  // Delete any old cache versions left over from previous SW installs.
  e.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);

  // Never cache Firebase REST calls or external CDN scripts — data must be fresh.
  if (PASSTHROUGH.test(url.hostname)) return;

  // Immutable assets: content-hash in filename means they're safe to cache forever.
  // Cache-first: respond instantly from cache if present, otherwise fetch & store.
  if (IMMUTABLE_RE.test(url.pathname)) {
    e.respondWith(
      caches.match(e.request).then(
        (hit) =>
          hit ||
          fetch(e.request).then((res) => {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(e.request, clone));
            return res;
          }),
      ),
    );
    return;
  }

  // Other static assets (images, sounds, wire-chrome JS, CSS):
  // Stale-while-revalidate — serve cached copy immediately, refresh in background.
  if (STATIC_EXTS.test(url.pathname)) {
    e.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        cache.match(e.request).then((hit) => {
          const networkFetch = fetch(e.request).then((res) => {
            cache.put(e.request, res.clone());
            return res;
          });
          return hit || networkFetch;
        }),
      ),
    );
    return;
  }

  // Navigation requests (HTML shells): network-first, fall back to cache so the
  // app opens offline after the first visit.
  if (e.request.mode === "navigate") {
    e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
  }
});
