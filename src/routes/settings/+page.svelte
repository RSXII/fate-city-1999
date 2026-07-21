<script>
  import { base } from '$app/paths';
  import { browser } from '$app/environment';
  import { onMount, tick } from 'svelte';
  import { FIREBASE_CONFIG, FIREBASE_URL, VAPID_KEY, dbGet, dbPut } from '$lib/firebase-db.js';
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

  // ── Profile image ──────────────────────────────────────────────────────────
  let myCodename = null;
  let existingProfileImage = null;

  // Crop UI state
  let fileInput;
  let cropCanvas;
  let cropVisible = false;
  let cropImg = null;
  let cropScale = 1;
  let cropMinScale = 1;
  let cropOffsetX = 0;
  let cropOffsetY = 0;
  let cropDragging = false;
  let cropDragStartX = 0;
  let cropDragStartY = 0;
  let savingProfile = false;

  const CROP_SIZE = 260;
  const OUTPUT_SIZE = 150;

  async function loadProfile() {
    myCodename = getCodename();
    if (!myCodename) return;
    try {
      const data = await dbGet(`player-profiles/${myCodename}`);
      if (data?.imageUrl) existingProfileImage = data.imageUrl;
    } catch {}
  }

  function handleFileSelect(e) {
    const file = e.target.files[0];
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const img = new Image();
      img.onload = async () => {
        cropImg = img;
        cropMinScale = Math.max(CROP_SIZE / img.width, CROP_SIZE / img.height);
        cropScale = cropMinScale;
        cropOffsetX = 0;
        cropOffsetY = 0;
        cropVisible = true;
        await tick();
        drawCrop();
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  }

  function drawCrop() {
    if (!cropCanvas || !cropImg) return;
    const ctx = cropCanvas.getContext('2d');
    const size = CROP_SIZE;
    const cx = size / 2, cy = size / 2;
    const radius = size / 2 - 3;
    const w = cropImg.width * cropScale;
    const h = cropImg.height * cropScale;
    const imgX = cx - w / 2 + cropOffsetX;
    const imgY = cy - h / 2 + cropOffsetY;

    ctx.clearRect(0, 0, size, size);

    // Dim background showing full image context
    ctx.globalAlpha = 0.2;
    ctx.drawImage(cropImg, imgX, imgY, w, h);
    ctx.globalAlpha = 1;

    // Full-brightness image clipped to circle
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(cropImg, imgX, imgY, w, h);
    ctx.restore();

    // Circle border
    ctx.strokeStyle = 'rgba(106, 176, 212, 0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();
  }

  function onCropPointerDown(e) {
    cropDragging = true;
    const p = e.touches ? e.touches[0] : e;
    cropDragStartX = p.clientX - cropOffsetX;
    cropDragStartY = p.clientY - cropOffsetY;
    e.preventDefault();
  }

  function onCropPointerMove(e) {
    if (!cropDragging) return;
    const p = e.touches ? e.touches[0] : e;
    cropOffsetX = p.clientX - cropDragStartX;
    cropOffsetY = p.clientY - cropDragStartY;
    drawCrop();
    e.preventDefault();
  }

  function onCropPointerUp() { cropDragging = false; }

  function onCropWheel(e) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.92 : 1.08;
    cropScale = Math.max(cropMinScale, Math.min(cropScale * delta, cropMinScale * 8));
    drawCrop();
  }

  function onZoomSlider(e) {
    cropScale = parseFloat(e.target.value);
    drawCrop();
  }

  function getCroppedDataUrl() {
    const out = document.createElement('canvas');
    out.width = OUTPUT_SIZE;
    out.height = OUTPUT_SIZE;
    const ctx = out.getContext('2d');
    const f = OUTPUT_SIZE / CROP_SIZE;
    const w = cropImg.width * cropScale * f;
    const h = cropImg.height * cropScale * f;
    const cx = OUTPUT_SIZE / 2, cy = OUTPUT_SIZE / 2;
    ctx.beginPath();
    ctx.arc(cx, cy, OUTPUT_SIZE / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(cropImg, cx - w / 2 + cropOffsetX * f, cy - h / 2 + cropOffsetY * f, w, h);
    return out.toDataURL('image/jpeg', 0.85);
  }

  async function saveProfile() {
    if (!myCodename || savingProfile) return;
    savingProfile = true;
    try {
      const imageUrl = getCroppedDataUrl();
      await dbPut(`player-profiles/${myCodename}`, { imageUrl, updatedAt: Date.now() });
      existingProfileImage = imageUrl;
      cropVisible = false;
      cropImg = null;
      if (fileInput) fileInput.value = '';
    } catch (err) {
      console.error('Wire: save profile failed', err);
    }
    savingProfile = false;
  }

  function cancelCrop() {
    cropVisible = false;
    cropImg = null;
    if (fileInput) fileInput.value = '';
  }

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
    loadProfile();
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
  <!-- Profile section -->
  <div class="sg-section">
    <div class="sg-section-label">Wire Profile</div>

    <!-- Codename (read-only) -->
    <div class="sg-row">
      <div class="sg-row-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round">
          <rect x="2" y="5" width="20" height="14" rx="2"/>
          <path d="M16 10a2 2 0 1 1-4 0 2 2 0 0 1 4 0"/>
          <path d="M6 10h2M6 14h8"/>
        </svg>
      </div>
      <div class="sg-row-body">
        <div class="sg-row-title">{myCodename ?? '—'}</div>
        <div class="sg-row-desc">Your operative codename. Assigned by the GM.</div>
      </div>
    </div>

    <!-- Profile photo row -->
    <div class="sg-row">
      <div class="profile-avatar-wrap">
        {#if existingProfileImage}
          <img src={existingProfileImage} alt="Profile" class="profile-avatar-img" />
        {:else}
          <div class="profile-avatar-empty" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
          </div>
        {/if}
      </div>
      <div class="sg-row-body">
        <div class="sg-row-title">Profile Photo</div>
        <div class="sg-row-desc">{existingProfileImage ? 'Shown on your responses.' : 'No photo set. Tap to upload.'}</div>
      </div>
      <button class="profile-upload-btn" type="button" on:click={() => fileInput.click()}>
        {existingProfileImage ? 'Change' : 'Upload'}
      </button>
      <input
        type="file"
        accept="image/*"
        bind:this={fileInput}
        style="display:none"
        on:change={handleFileSelect}
      />
    </div>

    <!-- Crop UI -->
    {#if cropVisible}
      <div class="crop-area">
        <canvas
          width={CROP_SIZE}
          height={CROP_SIZE}
          bind:this={cropCanvas}
          class="crop-canvas"
          style="cursor:{cropDragging ? 'grabbing' : 'grab'}; touch-action:none;"
          on:mousedown={onCropPointerDown}
          on:mousemove={onCropPointerMove}
          on:mouseup={onCropPointerUp}
          on:mouseleave={onCropPointerUp}
          on:touchstart={onCropPointerDown}
          on:touchmove={onCropPointerMove}
          on:touchend={onCropPointerUp}
          on:wheel={onCropWheel}
        ></canvas>
        <div class="crop-hint">Drag to reposition · Scroll or slide to zoom</div>
        <input
          type="range"
          class="crop-zoom"
          min={cropMinScale}
          max={cropMinScale * 6}
          step="0.01"
          value={cropScale}
          on:input={onZoomSlider}
        />
        <div class="crop-actions">
          <button class="crop-btn crop-btn--cancel" type="button" on:click={cancelCrop}>Cancel</button>
          <button class="crop-btn crop-btn--save" type="button" disabled={savingProfile} on:click={saveProfile}>
            {savingProfile ? 'Saving…' : 'Save Photo'}
          </button>
        </div>
      </div>
    {/if}
  </div>

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

  /* ── Profile section ───────────────────────────────────────────────────── */
  .profile-avatar-wrap {
    flex-shrink: 0;
    width: 44px;
    height: 44px;
    border-radius: 50%;
    overflow: hidden;
    border: 1.5px solid rgba(106, 176, 212, 0.25);
  }
  .profile-avatar-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: 50%;
    display: block;
  }
  .profile-avatar-empty {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(106, 176, 212, 0.06);
    color: rgba(106, 176, 212, 0.35);
  }
  .profile-upload-btn {
    background: none;
    border: 1px solid rgba(106, 176, 212, 0.3);
    border-radius: 20px;
    color: rgba(106, 176, 212, 0.6);
    font-size: 10.5px;
    font-family: inherit;
    letter-spacing: 0.8px;
    padding: 5px 14px;
    cursor: pointer;
    flex-shrink: 0;
    text-transform: uppercase;
    transition: border-color 0.15s, color 0.15s;
  }
  .profile-upload-btn:hover {
    border-color: rgba(106, 176, 212, 0.6);
    color: #6ab0d4;
  }

  /* Crop UI */
  .crop-area {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 20px 20px 24px;
    background: rgba(0, 0, 0, 0.18);
    border-top: 1px solid #1a2030;
  }
  .crop-canvas {
    border-radius: 50%;
    display: block;
    width: 260px;
    height: 260px;
    user-select: none;
  }
  .crop-hint {
    font-size: 10px;
    color: rgba(106, 176, 212, 0.4);
    letter-spacing: 0.5px;
    text-align: center;
  }
  .crop-zoom {
    width: 200px;
    accent-color: #6ab0d4;
  }
  .crop-actions {
    display: flex;
    gap: 10px;
  }
  .crop-btn {
    border-radius: 20px;
    font-size: 11px;
    font-family: inherit;
    letter-spacing: 1px;
    padding: 7px 20px;
    cursor: pointer;
    text-transform: uppercase;
    transition: opacity 0.15s;
  }
  .crop-btn:disabled { opacity: 0.45; cursor: default; }
  .crop-btn--cancel {
    background: none;
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: rgba(200, 200, 200, 0.5);
  }
  .crop-btn--cancel:hover { border-color: rgba(255, 255, 255, 0.22); color: rgba(200,200,200,0.75); }
  .crop-btn--save {
    background: rgba(106, 176, 212, 0.12);
    border: 1px solid rgba(106, 176, 212, 0.4);
    color: #6ab0d4;
  }
  .crop-btn--save:hover:not(:disabled) {
    background: rgba(106, 176, 212, 0.2);
    border-color: rgba(106, 176, 212, 0.7);
  }
</style>
