<script>
  import { base } from '$app/paths';
  import { browser } from '$app/environment';
  import { onMount, onDestroy } from 'svelte';
  import { dbGet } from '$lib/firebase-db.js';
  import { getCodename, setCodename } from '$lib/utils.js';

  const LAST_SEEN_KEY = 'wire-last-seen-map';

  // ── Codename modal ─────────────────────────────────────────────────────────
  let showCodenameModal = false;
  let codenameInput = '';
  let codenameError = '';
  let codenameInputEl;

  function submitCodename() {
    const val = codenameInput.trim();
    if (!val) { codenameError = 'CODENAME REQUIRED'; return; }
    if (val.length > 24) { codenameError = 'MAX 24 CHARACTERS'; return; }
    setCodename(val);
    showCodenameModal = false;
  }

  function onCodenameKey(e) {
    if (e.key === 'Enter') submitCodename();
    else codenameError = '';
  }
  const TOTAL_PAGES = 2;

  let currentPage = 0;
  let touchStartX = 0;
  let touchStartY = 0;
  let carouselEl;

  let unreadCount = 0;
  let toastVisible = false;
  let toastText = 'New message';
  let toastTimer;
  let isFirstPoll = true;
  let lastUnreadCount = 0;
  let pollInterval;

  function getLastSeenMap() {
    try { return JSON.parse(localStorage.getItem(LAST_SEEN_KEY) ?? '{}'); }
    catch { return {}; }
  }

  async function pollUnread() {
    try {
      const data = await dbGet('messages');
      const map = getLastSeenMap();
      let unread = 0;
      if (data) {
        Object.keys(data).forEach(k => {
          const m = data[k];
          if (!m) return;
          const seen = map[m.sender] || 0;
          if (m.ts > seen) unread++;
        });
      }
      if (!isFirstPoll && unread > lastUnreadCount) {
        const delta = unread - lastUnreadCount;
        toastText = delta === 1 ? 'New message' : `${delta} new messages`;
        toastVisible = true;
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => { toastVisible = false; }, 4000);
      }
      unreadCount = unread;
      lastUnreadCount = unread;
      isFirstPoll = false;
    } catch {
      // network hiccup — retry next interval
    }
  }

  function goToPage(n) {
    currentPage = Math.max(0, Math.min(TOTAL_PAGES - 1, n));
    if (carouselEl) carouselEl.style.transform = `translateX(${-100 * currentPage}%)`;
  }

  function onTouchStart(e) {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
  }

  function onTouchEnd(e) {
    const dx = e.changedTouches[0].clientX - touchStartX;
    const dy = e.changedTouches[0].clientY - touchStartY;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 40) {
      goToPage(currentPage + (dx < 0 ? 1 : -1));
    }
  }

  onMount(() => {
    if (!browser) return;
    if (!getCodename()) {
      showCodenameModal = true;
      // focus input after DOM settles
      setTimeout(() => codenameInputEl?.focus(), 80);
    }
    pollUnread();
    pollInterval = setInterval(pollUnread, 5000);
  });

  onDestroy(() => {
    clearInterval(pollInterval);
    clearTimeout(toastTimer);
  });
</script>

<svelte:head>
  <title>Fate City: 1999 — Wire</title>
</svelte:head>

<wire-status-bar jail layout="flex"></wire-status-bar>

<!-- Unread toast -->
<a class="wire-toast" class:show={toastVisible} href="{base}/messages">
  <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <rect x="3" y="5.5" width="18" height="13" rx="1.5" />
    <path d="M3.6 6.8l8.4 6.3 8.4-6.3" />
  </svg>
  <span>{toastText}</span>
</a>

<h1 class="sr-only">Fate City: 1999 Wire home screen</h1>

<div class="hs-wrap">
  <!-- Swipeable carousel -->
  <div class="hs-stage"
    on:touchstart|passive={onTouchStart}
    on:touchend|passive={onTouchEnd}
    role="region"
    aria-label="App pages"
  >
    <div class="hs-carousel" bind:this={carouselEl}>

      <!-- ── Page 1 ── -->
      <div class="hs-page">
        <div class="hs-row">
          <a class="hs-icon" href="{base}/messages">
            <div class="hs-icon-tile" class:has-unread={unreadCount > 0}>
              <svg viewBox="0 0 24 24" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9l-4 3v-3H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z" />
              </svg>
              {#if unreadCount > 0}<span class="msg-badge" aria-hidden="true"></span>{/if}
            </div>
            <span class="hs-icon-label">Messages</span>
          </a>
          <div class="hs-icon">
            <div class="hs-icon-tile">
              <svg viewBox="0 0 24 24" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M6.7 4h2.7l1.4 3.8-2 1.6a12.3 12.3 0 0 0 5.8 5.8l1.6-2 3.8 1.4v2.7a2 2 0 0 1-2 2C10.8 19.3 4.7 13.2 4.7 6a2 2 0 0 1 2-2z" />
              </svg>
            </div>
            <span class="hs-icon-label">Phone</span>
          </div>
          <div class="hs-icon">
            <div class="hs-icon-tile">
              <svg viewBox="0 0 24 24" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <rect x="4" y="5" width="16" height="15" rx="1.5" />
                <line x1="4" y1="9.5" x2="20" y2="9.5" />
                <line x1="8" y1="3" x2="8" y2="6.2" />
                <line x1="16" y1="3" x2="16" y2="6.2" />
                <text x="12" y="16.3" font-size="6.5" text-anchor="middle" fill="currentColor" stroke="none" font-family="Arial, sans-serif" font-weight="700">31</text>
              </svg>
            </div>
            <span class="hs-icon-label">Calendar</span>
          </div>
        </div>

        <div class="hs-row">
          <div class="hs-icon">
            <div class="hs-icon-tile">
              <svg viewBox="0 0 24 24" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <rect x="5.5" y="3" width="13" height="18" rx="1.5" />
                <rect x="7.5" y="5.3" width="9" height="3.4" rx="0.5" />
                <circle cx="8.4" cy="13" r="0.85" fill="currentColor" stroke="none" />
                <circle cx="12" cy="13" r="0.85" fill="currentColor" stroke="none" />
                <circle cx="15.6" cy="13" r="0.85" fill="currentColor" stroke="none" />
                <circle cx="8.4" cy="16.2" r="0.85" fill="currentColor" stroke="none" />
                <circle cx="12" cy="16.2" r="0.85" fill="currentColor" stroke="none" />
                <circle cx="15.6" cy="16.2" r="0.85" fill="currentColor" stroke="none" />
              </svg>
            </div>
            <span class="hs-icon-label">Calculator</span>
          </div>
          <div class="hs-icon">
            <div class="hs-icon-tile">
              <div class="hs-plat-glyph">P</div>
            </div>
            <span class="hs-icon-label">Plat</span>
          </div>
          <a class="hs-icon" href="{base}/once">
            <div class="hs-icon-tile once-tile">
              <span class="once-badge" aria-hidden="true"></span>
              <svg viewBox="0 0 24 24" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="8.2" />
                <circle cx="12" cy="12" r="4.6" />
                <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
              </svg>
            </div>
            <span class="hs-icon-label">O.N.C.E.</span>
          </a>
        </div>

        <div class="hs-row">
          <div class="hs-icon">
            <div class="hs-icon-tile">
              <svg viewBox="0 0 24 24" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <rect x="3" y="7.5" width="18" height="12.5" rx="2" />
                <path d="M8.3 7.5l1.3-2.3h4.8l1.3 2.3" />
                <circle cx="12" cy="13.7" r="3.3" />
              </svg>
            </div>
            <span class="hs-icon-label">Camera</span>
          </div>
          <a class="hs-icon" href="{base}/emails">
            <div class="hs-icon-tile">
              <svg viewBox="0 0 24 24" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <rect x="3" y="5.5" width="18" height="13" rx="1.5" />
                <path d="M3.6 6.8l8.4 6.3 8.4-6.3" />
              </svg>
            </div>
            <span class="hs-icon-label">Email</span>
          </a>
          <a class="hs-icon" href="{base}/settings">
            <div class="hs-icon-tile">
              <svg viewBox="0 0 24 24" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="3.8" />
                <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
                <line x1="12" y1="2.3" x2="12" y2="5.3" />
                <line x1="12" y1="18.7" x2="12" y2="21.7" />
                <line x1="2.3" y1="12" x2="5.3" y2="12" />
                <line x1="18.7" y1="12" x2="21.7" y2="12" />
                <line x1="5.1" y1="5.1" x2="7.2" y2="7.2" />
                <line x1="16.8" y1="16.8" x2="18.9" y2="18.9" />
                <line x1="5.1" y1="18.9" x2="7.2" y2="16.8" />
                <line x1="16.8" y1="7.2" x2="18.9" y2="5.1" />
              </svg>
            </div>
            <span class="hs-icon-label">Settings</span>
          </a>
        </div>

        <div class="hs-row">
          <!-- Rides -->
          <div class="hs-icon">
            <div class="hs-icon-tile">
              <svg viewBox="0 0 24 24" fill="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <!-- Porsche 911 side profile: low nose, sweeping fastback roofline -->
                <path d="M1.5 14 Q2 13 4.5 12.5 Q6 10 9 8.5 Q13 8 16 9.5 L19.5 12 L21.5 13 L22 14" />
                <!-- Underbody with wheel arch gaps -->
                <path d="M1.5 14 L4.5 14 M9.5 14 L15 14 M19.5 14 L22 14" />
                <!-- Wheels -->
                <circle cx="7" cy="15.8" r="2" />
                <circle cx="17.2" cy="15.8" r="2" />
              </svg>
            </div>
            <span class="hs-icon-label">Rides</span>
          </div>

          <!-- HouseKit -->
          <div class="hs-icon">
            <div class="hs-icon-tile">
              <svg viewBox="0 0 24 24" fill="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <!-- Roof -->
                <path d="M3 11.5 L12 4 L21 11.5" />
                <!-- Walls -->
                <path d="M5.5 10 L5.5 20 L18.5 20 L18.5 10" />
                <!-- Arch-top door -->
                <path d="M10 20 L10 15.5 Q10 13.5 12 13.5 Q14 13.5 14 15.5 L14 20" />
                <!-- HomeKit-style signal arcs inside house -->
                <path d="M8.5 13 Q8.5 9.5 12 9.5 Q15.5 9.5 15.5 13" />
                <path d="M10 13 Q10 11 12 11 Q14 11 14 13" />
                <circle cx="12" cy="12.8" r="0.8" fill="currentColor" stroke="none" />
              </svg>
            </div>
            <span class="hs-icon-label">HouseKit</span>
          </div>

          <!-- FateStaGram -->
          <div class="hs-icon">
            <div class="hs-icon-tile">
              <svg viewBox="0 0 24 24" fill="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <!-- IG-style rounded square -->
                <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
                <!-- Camera lens -->
                <circle cx="12" cy="12" r="4.2" />
                <!-- Crosshair reticle inside lens (Fate City twist) -->
                <line x1="12" y1="9.2" x2="12" y2="14.8" />
                <line x1="9.2" y1="12" x2="14.8" y2="12" />
                <!-- Viewfinder dot top-right -->
                <circle cx="17.5" cy="6.5" r="1.2" fill="currentColor" stroke="none" />
              </svg>
            </div>
            <span class="hs-icon-label">FateStaGram</span>
          </div>
        </div>
      </div>
      <!-- /page 1 -->

      <!-- ── Page 2 ── -->
      <div class="hs-page">
        <div class="hs-row" aria-hidden="true" style="visibility:hidden">
          <div class="hs-icon"><div class="hs-icon-tile"></div><span class="hs-icon-label">&nbsp;</span></div>
          <div class="hs-icon"><div class="hs-icon-tile"></div><span class="hs-icon-label">&nbsp;</span></div>
          <div class="hs-icon"><div class="hs-icon-tile"></div><span class="hs-icon-label">&nbsp;</span></div>
        </div>
        <div class="hs-row">
          <a class="hs-icon" href="{base}/evernear">
            <div class="hs-icon-tile evernear-tile">
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <defs>
                  <linearGradient id="en-ring" x1="4" y1="12" x2="20" y2="12" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stop-color="#d946ef" />
                    <stop offset="100%" stop-color="#38bdf8" />
                  </linearGradient>
                </defs>
                <circle cx="12" cy="11.5" r="7.8" style="stroke: url(#en-ring); fill: none" stroke-width="1.6" />
                <rect x="9.2" y="8.8" width="2" height="3.2" rx="1" style="fill: white; stroke: none" />
                <rect x="12.8" y="8.8" width="2" height="3.2" rx="1" style="fill: white; stroke: none" />
                <path d="M9.8 14.2 Q12 15.9 14.2 14.2" style="stroke: white; fill: none" stroke-width="1.2" stroke-linecap="round" />
              </svg>
            </div>
            <span class="hs-icon-label">EverNear</span>
          </a>
          <div class="hs-icon" aria-hidden="true" style="visibility:hidden"><div class="hs-icon-tile"></div><span class="hs-icon-label">&nbsp;</span></div>
          <div class="hs-icon" aria-hidden="true" style="visibility:hidden"><div class="hs-icon-tile"></div><span class="hs-icon-label">&nbsp;</span></div>
        </div>
        <div class="hs-row" aria-hidden="true" style="visibility:hidden">
          <div class="hs-icon"><div class="hs-icon-tile"></div><span class="hs-icon-label">&nbsp;</span></div>
          <div class="hs-icon"><div class="hs-icon-tile"></div><span class="hs-icon-label">&nbsp;</span></div>
          <div class="hs-icon"><div class="hs-icon-tile"></div><span class="hs-icon-label">&nbsp;</span></div>
        </div>
        <div class="hs-row" aria-hidden="true" style="visibility:hidden">
          <div class="hs-icon"><div class="hs-icon-tile"></div><span class="hs-icon-label">&nbsp;</span></div>
          <div class="hs-icon"><div class="hs-icon-tile"></div><span class="hs-icon-label">&nbsp;</span></div>
          <div class="hs-icon"><div class="hs-icon-tile"></div><span class="hs-icon-label">&nbsp;</span></div>
        </div>
      </div>
      <!-- /page 2 -->

    </div>
    <!-- /carousel -->
  </div>
  <!-- /stage -->

  <!-- Page dots -->
  <div class="hs-dots" aria-hidden="true">
    {#each {length: TOTAL_PAGES} as _, i}
      <button class="hs-dot" class:active={i === currentPage} on:click={() => goToPage(i)} tabindex="-1"></button>
    {/each}
  </div>
</div>

<!-- ── Codename registration modal ────────────────────────────────────────── -->
{#if showCodenameModal}
<div class="cn-overlay" role="dialog" aria-modal="true" aria-label="Codename registration">
  <div class="cn-panel">
    <div class="cn-scanline" aria-hidden="true"></div>

    <p class="cn-sys">// SIGNAL ORIGIN: UNKNOWN — CHANNEL ENCRYPTED</p>
    <div class="cn-divider" aria-hidden="true"></div>

    <h2 class="cn-title">ASSIGN OPERATIVE CODENAME</h2>
    <p class="cn-sub">This device has been hardened and is routing outside monitored infrastructure. Assign a codename. It will be used to identify you across encrypted channels.<br><br>Choose carefully.</p>

    <div class="cn-field-wrap">
      <span class="cn-prompt" aria-hidden="true">&gt;_</span>
      <input
        class="cn-input"
        type="text"
        maxlength="24"
        placeholder="ENTER CODENAME"
        bind:value={codenameInput}
        bind:this={codenameInputEl}
        on:keydown={onCodenameKey}
        autocomplete="off"
        autocorrect="off"
        spellcheck="false"
      />
    </div>

    {#if codenameError}
      <p class="cn-error" role="alert">{codenameError}</p>
    {/if}

    <button class="cn-confirm" on:click={submitCodename}>CONFIRM IDENTITY</button>

    <p class="cn-legal">This device is not registered. Traffic is obfuscated. No logs. No carrier. You are not here.</p>
  </div>
</div>
{/if}

<style>
  .sr-only {
    position: absolute;
    width: 1px; height: 1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
  }

  /* Toast */
  .wire-toast {
    position: fixed;
    top: 44px;
    left: 50%;
    transform: translateX(-50%) translateY(-10px);
    background: #1a1530;
    border: 1px solid rgba(201, 162, 39, 0.4);
    color: #e8dfc8;
    font-size: 11px;
    font-weight: 600;
    padding: 10px 16px;
    border-radius: 20px;
    display: flex;
    align-items: center;
    gap: 6px;
    z-index: 300;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.3s ease, transform 0.3s ease;
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.45);
    white-space: nowrap;
    font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif;
    text-decoration: none;
    cursor: pointer;
  }
  .wire-toast.show {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
    pointer-events: auto;
  }

  /* Home screen wrap */
  .hs-wrap {
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    max-width: 420px;
    width: 100%;
    margin: 0 auto;
    padding: 18px 0 0;
  }

  /* Carousel */
  .hs-stage {
    flex: 1;
    overflow: hidden;
    touch-action: pan-y;
    display: flex;
    flex-direction: column;
  }
  .hs-carousel {
    display: flex;
    flex-wrap: nowrap;
    transition: transform 0.35s cubic-bezier(0.4, 0, 0.2, 1);
    touch-action: pan-y;
    flex: 1;
  }
  .hs-page {
    flex: 0 0 100%;
    min-width: 100%;
    display: flex;
    flex-direction: column;
    justify-content: space-evenly;
    padding-bottom: 14px;
  }

  /* Icon rows */
  .hs-row {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    padding: 0 22px;
  }
  @media (max-width: 420px) {
    .hs-row { padding: 0 16px; }
  }

  .hs-icon {
    flex: 1 1 0;
    max-width: 110px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    text-decoration: none;
  }
  .hs-icon-tile {
    width: 100%;
    max-width: 78px;
    aspect-ratio: 1;
    margin: 0 auto;
    border: 1px solid rgba(201, 162, 39, 0.35);
    border-radius: 16px;
    background: rgba(255, 255, 255, 0.025);
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
  }
  .hs-icon-tile :global(svg) {
    width: 36px;
    height: 36px;
    stroke: #c9a227;
    fill: none;
  }

  /* Unread badge on Messages tile */
  .msg-badge {
    position: absolute;
    top: 6px; right: 6px;
    width: 7px; height: 7px;
    border-radius: 50%;
    background: #c9a227;
    box-shadow: 0 0 6px rgba(201, 162, 39, 0.8);
  }

  /* O.N.C.E. tile */
  .once-tile {
    border-color: rgba(124, 58, 237, 0.6);
    box-shadow: 0 0 14px rgba(124, 58, 237, 0.3), inset 0 0 8px rgba(124, 58, 237, 0.1);
    animation: once-pulse 2.8s ease-in-out infinite;
  }
  .once-tile :global(svg) { stroke: #7c3aed; }
  .once-badge {
    position: absolute;
    top: 6px; right: 6px;
    width: 7px; height: 7px;
    border-radius: 50%;
    background: #7c3aed;
    box-shadow: 0 0 6px rgba(124, 58, 237, 0.8);
  }
  @keyframes once-pulse {
    0%, 100% { box-shadow: 0 0 14px rgba(124, 58, 237, 0.3), inset 0 0 8px rgba(124, 58, 237, 0.1); }
    50%       { box-shadow: 0 0 24px rgba(124, 58, 237, 0.55), inset 0 0 14px rgba(124, 58, 237, 0.2); }
  }

  /* EverNear tile */
  .evernear-tile {
    border-color: rgba(217, 70, 239, 0.45);
    box-shadow: 0 0 14px rgba(56, 189, 248, 0.2), inset 0 0 8px rgba(217, 70, 239, 0.1);
  }

  /* Plat glyph */
  .hs-plat-glyph {
    position: relative;
    font-family: 'Georgia', 'Times New Roman', serif;
    font-size: 28px;
    font-weight: 700;
    color: #c9a227;
    line-height: 1;
  }
  .hs-plat-glyph::after {
    content: '';
    position: absolute;
    left: -7px; right: -7px;
    top: 50%;
    height: 2px;
    background: #c9a227;
    transform: rotate(-30deg);
  }

  .hs-icon-label {
    font-size: 9px;
    letter-spacing: 1.1px;
    text-transform: uppercase;
    color: #b8902f;
    text-align: center;
  }

  /* Page dots */
  .hs-dots {
    display: flex;
    justify-content: center;
    gap: 7px;
    margin-top: 22px;
    margin-bottom: 8px;
  }
  .hs-dot {
    width: 6px; height: 6px;
    border-radius: 50%;
    background: rgba(201, 162, 39, 0.3);
    border: none;
    padding: 0;
    cursor: pointer;
    transition: background 0.2s;
  }
  .hs-dot.active { background: #c9a227; }

  /* ── Codename modal ──────────────────────────────────────────────────────── */
  .cn-overlay {
    position: fixed;
    inset: 0;
    z-index: 900;
    background: rgba(5, 3, 12, 0.92);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    backdrop-filter: blur(4px);
  }
  .cn-panel {
    position: relative;
    width: 100%;
    max-width: 360px;
    background: #0a0710;
    border: 1px solid rgba(255, 77, 142, 0.5);
    border-radius: 4px;
    padding: 28px 24px 22px;
    box-shadow: 0 0 40px rgba(255, 77, 142, 0.18), 0 0 80px rgba(77, 217, 255, 0.08);
    overflow: hidden;
  }
  /* CRT scanline shimmer */
  .cn-scanline {
    position: absolute;
    inset: 0;
    pointer-events: none;
    background: repeating-linear-gradient(
      to bottom,
      transparent 0px,
      transparent 3px,
      rgba(0, 0, 0, 0.18) 3px,
      rgba(0, 0, 0, 0.18) 4px
    );
  }
  .cn-sys {
    font-family: 'Courier New', Courier, monospace;
    font-size: 9px;
    letter-spacing: 1.5px;
    color: rgba(77, 217, 255, 0.6);
    text-transform: uppercase;
    margin: 0 0 10px;
  }
  .cn-divider {
    height: 1px;
    background: linear-gradient(to right, rgba(255, 77, 142, 0.6), rgba(77, 217, 255, 0.3), transparent);
    margin-bottom: 20px;
  }
  .cn-title {
    font-size: 16px;
    font-weight: 800;
    letter-spacing: 3px;
    text-transform: uppercase;
    color: #ff4d8e;
    margin: 0 0 10px;
    font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif;
  }
  .cn-sub {
    font-size: 11px;
    line-height: 1.6;
    color: rgba(232, 223, 200, 0.55);
    margin: 0 0 22px;
    letter-spacing: 0.4px;
  }
  .cn-field-wrap {
    display: flex;
    align-items: center;
    gap: 8px;
    border: 1px solid rgba(255, 77, 142, 0.4);
    border-radius: 3px;
    padding: 10px 12px;
    background: rgba(255, 77, 142, 0.04);
    margin-bottom: 12px;
  }
  .cn-prompt {
    font-family: 'Courier New', Courier, monospace;
    font-size: 13px;
    color: #ff4d8e;
    flex-shrink: 0;
    opacity: 0.8;
  }
  .cn-input {
    flex: 1;
    background: transparent;
    border: none;
    outline: none;
    color: #e8dfc8;
    font-family: 'Courier New', Courier, monospace;
    font-size: 14px;
    letter-spacing: 2px;
    text-transform: uppercase;
    caret-color: #ff4d8e;
  }
  .cn-input::placeholder {
    color: rgba(232, 223, 200, 0.2);
    letter-spacing: 2px;
  }
  .cn-error {
    font-family: 'Courier New', Courier, monospace;
    font-size: 10px;
    letter-spacing: 1.5px;
    color: #ff4d8e;
    margin: 0 0 12px;
    text-transform: uppercase;
  }
  .cn-confirm {
    width: 100%;
    padding: 13px;
    background: linear-gradient(135deg, rgba(255, 77, 142, 0.15), rgba(77, 217, 255, 0.08));
    border: 1px solid rgba(255, 77, 142, 0.6);
    border-radius: 3px;
    color: #ff4d8e;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 3px;
    text-transform: uppercase;
    cursor: pointer;
    transition: background 0.2s, box-shadow 0.2s;
    font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif;
    margin-bottom: 16px;
  }
  .cn-confirm:active {
    background: rgba(255, 77, 142, 0.25);
    box-shadow: 0 0 16px rgba(255, 77, 142, 0.3);
  }
  .cn-legal {
    font-size: 8px;
    color: rgba(232, 223, 200, 0.25);
    line-height: 1.5;
    margin: 0;
    text-align: center;
    letter-spacing: 0.3px;
  }
</style>

