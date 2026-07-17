<script>
  import { base } from '$app/paths';
  import { browser } from '$app/environment';
  import { onMount } from 'svelte';
  import { FIREBASE_CONFIG, FIREBASE_URL, VAPID_KEY } from '$lib/firebase-db.js';
  import { getCodename } from '$lib/utils.js';

  const LS_KEY = 'wire-notif-sub'; // { pushId, token }

  // 'idle' | 'enabled' | 'denied'
  let notifState = 'idle';
  let supported = false;

  function getSub() {
    try { return JSON.parse(localStorage.getItem(LS_KEY)) || null; }
    catch { return null; }
  }
  function setSub(sub) {
    if (sub) localStorage.setItem(LS_KEY, JSON.stringify(sub));
    else localStorage.removeItem(LS_KEY);
  }

  function syncState(messaging) {
    const perm = Notification.permission;
    const sub = getSub();
    if (perm === 'denied') { setSub(null); notifState = 'denied'; }
    else if (perm === 'granted' && sub) { notifState = 'enabled'; }
    else { setSub(null); notifState = 'idle'; }
    return messaging;
  }

  let messaging = null;

  async function loadFirebase() {
    return new Promise((resolve, reject) => {
      // Load app-compat
      const s1 = document.createElement('script');
      s1.src = 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js';
      s1.onload = () => {
        const s2 = document.createElement('script');
        s2.src = 'https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js';
        s2.onload = () => resolve(window.firebase);
        s2.onerror = reject;
        document.head.appendChild(s2);
      };
      s1.onerror = reject;
      document.head.appendChild(s1);
    });
  }

  onMount(async () => {
    if (!browser) return;
    if (!('Notification' in window) || !('serviceWorker' in navigator)) return;
    supported = true;
    try {
      const fb = await loadFirebase();
      if (!fb.apps.length) fb.initializeApp(FIREBASE_CONFIG);
      messaging = fb.messaging();
      syncState(messaging);
    } catch (e) {
      console.warn('Wire: Firebase messaging unavailable', e);
    }
  });

  async function subscribe() {
    if (!messaging) return;
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') { notifState = perm === 'denied' ? 'denied' : 'idle'; return; }
      const swReg = await navigator.serviceWorker.ready;
      const token = await messaging.getToken({ vapidKey: VAPID_KEY, serviceWorkerRegistration: swReg });
      const codename = getCodename();
      const res = await fetch(`${FIREBASE_URL}/subscriptions.json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, ts: Date.now(), ...(codename ? { codename } : {}) }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setSub({ pushId: data.name, token });
      notifState = 'enabled';
    } catch (e) {
      console.error('Wire: subscribe failed', e);
      notifState = 'idle';
    }
  }

  async function unsubscribe() {
    const sub = getSub();
    if (sub?.pushId) {
      try {
        await fetch(`${FIREBASE_URL}/subscriptions/${sub.pushId}.json`, { method: 'DELETE' });
      } catch (e) {
        console.warn('Wire: server unsubscribe failed', e);
      }
    }
    setSub(null);
    notifState = 'idle';
  }

  function toggleNotif() {
    if (notifState === 'enabled') unsubscribe();
    else if (notifState !== 'denied') subscribe();
  }
</script>

<svelte:head>
  <title>Fate City: 1999 — Settings</title>
</svelte:head>

<wire-status-bar jail layout="flex"></wire-status-bar>
<wire-header back="{base}/home" title="Settings" layout="flex"></wire-header>

<div class="sg-scroll">
  <div class="sg-section">
    <div class="sg-section-label">Notifications</div>
    <div class="sg-row">
      <div class="sg-row-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
      </div>
      <div class="sg-row-body">
        <div class="sg-row-title">Push Alerts</div>
        <div class="sg-row-desc">Receive a notification when new messages arrive.</div>
      </div>
      {#if supported}
        <button
          class="hs-notif-toggle"
          class:enabled={notifState === 'enabled'}
          class:denied={notifState === 'denied'}
          disabled={notifState === 'denied'}
          type="button"
          on:click={toggleNotif}
        >
          <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          {#if notifState === 'enabled'}Alerts on
          {:else if notifState === 'denied'}Alerts blocked
          {:else}Enable alerts{/if}
        </button>
      {/if}
    </div>
  </div>
</div>

<style>
  .sg-scroll {
    flex: 1;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    padding: 28px 0 24px;
  }
  .sg-section { margin-bottom: 32px; }
  .sg-section-label {
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: rgba(201, 162, 39, 0.4);
    padding: 0 20px 10px;
  }
  .sg-row {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 14px 20px;
    background: rgba(255, 255, 255, 0.028);
    border-top: 1px solid #1a2030;
    border-bottom: 1px solid #1a2030;
  }
  .sg-row-icon {
    flex-shrink: 0;
    width: 36px;
    height: 36px;
    border-radius: 10px;
    background: rgba(201, 162, 39, 0.07);
    border: 1px solid rgba(201, 162, 39, 0.2);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #c9a227;
  }
  .sg-row-body { flex: 1; min-width: 0; }
  .sg-row-title { font-size: 13px; font-weight: 500; color: #e8dfc8; letter-spacing: 0.2px; }
  .sg-row-desc { font-size: 10.5px; color: #3a4a5a; margin-top: 3px; line-height: 1.4; }

  .hs-notif-toggle {
    background: none;
    border: 1px solid rgba(201, 162, 39, 0.3);
    border-radius: 20px;
    color: rgba(201, 162, 39, 0.55);
    font-size: 10.5px;
    font-family: inherit;
    letter-spacing: 0.8px;
    padding: 5px 14px 5px 10px;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    text-transform: uppercase;
    flex-shrink: 0;
    transition: border-color 0.15s, color 0.15s;
  }
  .hs-notif-toggle:hover {
    border-color: rgba(201, 162, 39, 0.6);
    color: #c9a227;
  }
  .hs-notif-toggle.enabled {
    border-color: rgba(99, 153, 34, 0.5);
    color: rgba(99, 153, 34, 0.8);
  }
  .hs-notif-toggle.denied {
    border-color: rgba(226, 75, 74, 0.4);
    color: rgba(226, 75, 74, 0.55);
    cursor: default;
  }
</style>
