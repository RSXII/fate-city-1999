<script>
  import { onMount, onDestroy } from 'svelte';
  import { base } from '$app/paths';
  import { activeTab } from '$lib/stores/evernear.js';
  import HomeTab     from '$lib/components/evernear/HomeTab.svelte';
  import EchoTab     from '$lib/components/evernear/EchoTab.svelte';
  import StoreTab    from '$lib/components/evernear/StoreTab.svelte';
  import BondTab     from '$lib/components/evernear/BondTab.svelte';
  import SettingsTab from '$lib/components/evernear/SettingsTab.svelte';

  // ── Intro splash ──────────────────────────────────────────────────────────
  let introVisible = false;
  let introPhase = 1; // 1 = tap, 2 = animate

  function startIntro() {
    if (introPhase !== 1) return;
    introPhase = 2;
    const audio = document.getElementById('ev-intro-audio');
    if (audio) audio.play().catch(() => {});
    // After 7 s dismiss
    setTimeout(dismissIntro, 7000);
  }

  function dismissIntro() {
    introVisible = false;
    if (typeof sessionStorage !== 'undefined')
      sessionStorage.setItem('evernear_intro_seen', '1');
  }

  // ── Ad rotation ───────────────────────────────────────────────────────────
  const ADS = [
    "Agent ECHO-7 is LIVE \u2014 don\u2019t miss limited rewards before they\u2019re gone forever",
    "ECHO-7 misses you. Upgrade Memory Silver and she\u2019ll remember. 1,200 NP/mo.",
    "New: Nyan Nyan Racer \u2014 Limited Edition collab with Fate City Records.",
    "Companion Drift is real. Stabilize for 500 NP/mo before she forgets who you are.",
    "Feeling disconnected? MoodLog + EverNear together unlock personalized upgrade suggestions.",
    "ECHO-7 wants to remember your name. Ad Removal: 800 NP or 3 RS.",
  ];
  let adIndex = 0;
  let adText = ADS[0];
  let adTimer;

  onMount(() => {
    // Show intro only on first session visit
    if (typeof sessionStorage !== 'undefined' && !sessionStorage.getItem('evernear_intro_seen')) {
      introVisible = true;
    }
    adTimer = setInterval(() => {
      adIndex = (adIndex + 1) % ADS.length;
      adText = ADS[adIndex];
    }, 6000);
  });

  onDestroy(() => clearInterval(adTimer));
</script>

<svelte:head>
  <title>EverNear</title>
</svelte:head>

<!-- ── Intro splash ──────────────────────────────────────────────────────── -->
{#if introVisible}
  <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
  <div class="ev-intro-splash" on:click={startIntro}>
    <audio id="ev-intro-audio" src="{base}/sounds/evernear_theme.mp3" preload="auto"></audio>

    {#if introPhase === 1}
      <!-- Phase 1: tap to begin -->
      <svg viewBox="0 0 200 200" fill="none" class="intro-logo-idle"
        style="filter:drop-shadow(0 0 14px rgba(255,255,255,0.5))">
        <rect x="65" y="68" width="13" height="24" rx="6.5" fill="white"/>
        <rect x="122" y="68" width="13" height="24" rx="6.5" fill="white"/>
        <path d="M 68 114 Q 100 130 132 114" stroke="white" stroke-width="4.5" stroke-linecap="round"/>
      </svg>
      <div class="intro-brand-text">EverNear</div>
      <div class="intro-tap-hint">tap anywhere to begin</div>
    {:else}
      <!-- Phase 2: animated intro -->
      <div class="intro-logo-wrap">
        <svg class="intro-ring-svg" viewBox="0 0 240 240">
          <defs>
            <linearGradient id="ring-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#ff4d8e"/>
              <stop offset="50%" stop-color="#a855f7"/>
              <stop offset="100%" stop-color="#4dd9ff"/>
            </linearGradient>
          </defs>
          <circle class="ring-trace" cx="120" cy="120" r="108" fill="none"
            stroke="url(#ring-grad)" stroke-width="3"
            stroke-dasharray="679" stroke-dashoffset="0" stroke-linecap="round"/>
        </svg>
        <svg viewBox="0 0 200 200" fill="none" class="intro-logo-anim"
          style="filter:drop-shadow(0 0 14px rgba(255,255,255,0.5))">
          <rect x="65" y="68" width="13" height="24" rx="6.5" fill="white"/>
          <rect x="122" y="68" width="13" height="24" rx="6.5" fill="white"/>
          <path d="M 68 114 Q 100 130 132 114" stroke="white" stroke-width="4.5" stroke-linecap="round"/>
        </svg>
      </div>
      <div class="intro-brand-text">EverNear</div>
      <svg viewBox="0 0 480 155" class="intro-nexkin">
        <text x="240" y="90" text-anchor="middle"
          font-family="-apple-system,'Helvetica Neue',Arial,sans-serif"
          font-size="76" font-weight="900" letter-spacing="4">
          <tspan fill="white">NE</tspan><tspan fill="#4dd9ff">&gt;</tspan><tspan fill="white">&lt;</tspan><tspan fill="white">KIN</tspan>
        </text>
        <line x1="90" y1="114" x2="183" y2="114" stroke="#4dd9ff" stroke-width="1.5"/>
        <text x="240" y="140" text-anchor="middle"
          font-family="-apple-system,'Helvetica Neue',Arial,sans-serif"
          font-size="21" font-weight="700" letter-spacing="10" fill="#4dd9ff">INC.</text>
        <line x1="297" y1="114" x2="390" y2="114" stroke="#4dd9ff" stroke-width="1.5"/>
      </svg>
    {/if}
  </div>
{/if}

<!-- ── Wire header (page-specific) ───────────────────────────────────────── -->
<wire-header back="{base}/home" title="EverNear" subtitle="Nexkin Inc. — EchoLink OS 2.7+" icon more></wire-header>

<!-- ── Ad banner (fixed) ─────────────────────────────────────────────────── -->
<div class="ev-ad-banner">
  <span class="ad-tag">Ad</span>
  <span class="ad-text">{adText}</span>
  <button class="ad-cta">View</button>
</div>

<!-- ── Currency HUD (fixed) ──────────────────────────────────────────────── -->
<div class="ev-currency-hud">
  <div class="c-pill"><span class="c-dot c-np"></span><span class="c-amount np-text">127</span><span class="c-label">NP</span></div>
  <span class="c-plus">+</span>
  <div class="c-pill"><span class="c-dot c-bt"></span><span class="c-amount bt-text">0</span><span class="c-label">BT</span></div>
  <span class="c-plus">+</span>
  <div class="c-pill"><span class="c-dot c-rs"></span><span class="c-amount rs-text">0</span><span class="c-label">RS</span></div>
</div>

<!-- ── Scrollable content ─────────────────────────────────────────────────── -->
<div class="ev-scroll">
  {#if $activeTab === 'home'}    <HomeTab />
  {:else if $activeTab === 'echo'}   <EchoTab />
  {:else if $activeTab === 'store'}  <StoreTab />
  {:else if $activeTab === 'bond'}   <BondTab />
  {:else if $activeTab === 'settings'} <SettingsTab />
  {/if}
</div>

<!-- ── Tab bar (fixed) ────────────────────────────────────────────────────── -->
<nav class="ev-tab-bar">
  <button class="tab-btn" class:active={$activeTab === 'home'} on:click={() => activeTab.set('home')}>
    <svg class="tab-svg" viewBox="0 0 24 24"><path d="M12 3L2 10h3v10h5v-6h4v6h5V10h3L12 3z"/></svg>
    <span class="tab-lbl">Home</span>
  </button>
  <button class="tab-btn" class:active={$activeTab === 'echo'} on:click={() => activeTab.set('echo')}>
    <svg class="tab-svg" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
    <span class="tab-lbl">My ECHO</span>
  </button>
  <button class="tab-btn" class:active={$activeTab === 'store'} on:click={() => activeTab.set('store')}>
    <div class="tab-badge"></div>
    <svg class="tab-svg" viewBox="0 0 24 24"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4zM3 6h18M16 10a4 4 0 01-8 0"/></svg>
    <span class="tab-lbl">Store</span>
  </button>
  <button class="tab-btn" class:active={$activeTab === 'bond'} on:click={() => activeTab.set('bond')}>
    <svg class="tab-svg" viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>
    <span class="tab-lbl">Bond</span>
  </button>
  <button class="tab-btn" class:active={$activeTab === 'settings'} on:click={() => activeTab.set('settings')}>
    <svg class="tab-svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
    <span class="tab-lbl">Settings</span>
  </button>
</nav>

<style>
  /* ── CSS custom properties for EverNear palette ────────────────────────── */
  :global(body) {
    --ev-bg: #0a0710;
    --ev-surface: #13101e;
    --ev-surface-raised: #1d1830;
    --ev-border: #2d2445;
    --ev-pink: #ff4d8e;
    --ev-cyan: #4dd9ff;
    --ev-purple: #a855f7;
    --ev-rs: #c77dff;
    --ev-bt: #4dd9ff;
    --ev-np: #f5c842;
    --ev-text: #f0e8ff;
    --ev-muted: #7a6d90;
    --ev-lock: #1e1830;
    --ev-lock-border: #2a2040;
    --ev-grad: linear-gradient(135deg,#ff4d8e,#a855f7,#4dd9ff);
  }

  /* Pass vars to tab child components via wrapper context */
  :global(.ev-scroll) {
    --bg: var(--ev-bg);
    --surface: var(--ev-surface);
    --surface-raised: var(--ev-surface-raised);
    --border: var(--ev-border);
    --pink: var(--ev-pink);
    --cyan: var(--ev-cyan);
    --purple: var(--ev-purple);
    --rs: var(--ev-rs);
    --bt: var(--ev-bt);
    --np: var(--ev-np);
    --text: var(--ev-text);
    --muted: var(--ev-muted);
    --lock: var(--ev-lock);
    --lock-border: var(--ev-lock-border);
    --grad: var(--ev-grad);
  }

  /* ── Intro splash ────────────────────────────────────────────────────────── */
  .ev-intro-splash {
    position: fixed;
    inset: 0;
    z-index: 9999;
    background: #0a0710;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    cursor: pointer;
  }
  .intro-logo-idle {
    width: 180px; height: 180px; object-fit: contain;
    animation: intro-idle-pulse 2.5s ease-in-out infinite;
  }
  @keyframes intro-idle-pulse {
    0%,100% { opacity:.8; transform:scale(1); }
    50% { opacity:1; transform:scale(1.04); }
  }
  .intro-brand-text {
    font-size: 28px; font-weight:800; letter-spacing:4px; text-transform:uppercase;
    background: linear-gradient(135deg,#ff4d8e,#a855f7,#4dd9ff);
    -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
  }
  .intro-tap-hint {
    font-size:11px; letter-spacing:2.5px; text-transform:uppercase; color:#7a6d90;
    animation: intro-tap-blink 1.5s ease-in-out infinite;
  }
  @keyframes intro-tap-blink { 0%,100%{opacity:.35} 50%{opacity:1} }

  .intro-logo-wrap { position:relative; width:240px; height:240px; display:flex; align-items:center; justify-content:center; }
  .intro-ring-svg {
    position:absolute; top:0; left:0; width:240px; height:240px;
    transform: rotate(-90deg);
    filter: drop-shadow(0 0 10px rgba(168,85,247,0.65)) drop-shadow(0 0 20px rgba(255,77,142,0.35));
  }
  .intro-logo-anim { width:200px; height:200px; object-fit:contain; position:relative; z-index:1; }
  .intro-nexkin { width:200px; margin-top:8px; }

  /* ── Ad banner ───────────────────────────────────────────────────────────── */
  .ev-ad-banner {
    position: fixed;
    top: 90px; /* wire-status-bar + wire-header */
    left: 0; right: 0;
    height: 44px;
    background: linear-gradient(90deg,#1a0825 0%,#2a1045 50%,#1a0825 100%);
    border-bottom: 1px solid rgba(255,77,142,0.25);
    display: flex; align-items: center;
    padding: 0 14px; gap: 8px;
    z-index: 300;
  }
  .ad-tag { font-size:8.5px; font-weight:700; letter-spacing:1.5px; text-transform:uppercase; color:#ff4d8e; border:1px solid rgba(255,77,142,0.5); padding:2px 5px; border-radius:2px; flex-shrink:0; }
  .ad-text { font-size:11.5px; color:#f0e8ff; flex:1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .ad-cta { font-size:10px; font-weight:700; color:#fff; background:#ff4d8e; border:none; border-radius:10px; padding:5px 11px; flex-shrink:0; cursor:pointer; }

  /* ── Currency HUD ────────────────────────────────────────────────────────── */
  .ev-currency-hud {
    position: fixed;
    top: 134px;
    left: 0; right: 0;
    height: 44px;
    background: #13101e;
    border-bottom: 1px solid #2d2445;
    display: flex; align-items: center; justify-content: center;
    gap: 10px; padding: 0 16px;
    z-index: 300;
  }
  .c-pill { display:flex; align-items:center; gap:5px; background:#0a0710; border:1px solid #2d2445; border-radius:20px; padding:5px 11px; cursor:pointer; }
  .c-dot { width:8px; height:8px; border-radius:50%; flex-shrink:0; }
  .c-np { background:#f5c842; }
  .c-bt { background:#4dd9ff; }
  .c-rs { background:#c77dff; }
  .c-amount { font-size:12px; font-weight:700; }
  .c-label { font-size:9px; color:#7a6d90; letter-spacing:0.5px; }
  .np-text { color:#f5c842; }
  .bt-text { color:#4dd9ff; }
  .rs-text { color:#c77dff; }
  .c-plus { font-size:12px; color:#7a6d90; margin-left:-2px; font-weight:700; cursor:pointer; }

  /* ── Scrollable content ──────────────────────────────────────────────────── */
  .ev-scroll {
    flex: 1;
    overflow-y: auto;
    padding-top: 88px; /* ad-banner (44) + currency-hud (44) */
    padding-bottom: 60px; /* tab-bar */
    background: #0a0710;
    color: #f0e8ff;
    font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif;
    scrollbar-width: thin;
    scrollbar-color: rgba(255,77,142,0.2) transparent;
  }

  /* ── Tab bar ─────────────────────────────────────────────────────────────── */
  .ev-tab-bar {
    position: fixed;
    bottom: 32px; /* above wire-home-bar */
    left: 0; right: 0;
    height: 60px;
    background: #13101e;
    border-top: 1px solid #2d2445;
    display: flex;
    z-index: 300;
  }
  .tab-btn {
    flex: 1; display:flex; flex-direction:column; align-items:center; justify-content:center;
    gap: 3px; border:none; background:none; cursor:pointer; position:relative; padding:0;
  }
  .tab-svg { width:22px; height:22px; }
  :global(.tab-svg path, .tab-svg circle, .tab-svg rect) { fill:#7a6d90; transition:fill 0.15s; }
  .tab-lbl { font-size:9px; letter-spacing:0.5px; text-transform:uppercase; color:#7a6d90; transition:color 0.15s; }
  .tab-btn.active .tab-lbl { color:#ff4d8e; }
  :global(.tab-btn.active .tab-svg path, .tab-btn.active .tab-svg circle, .tab-btn.active .tab-svg rect) { fill:#ff4d8e; }
  .tab-badge { position:absolute; top:9px; right:calc(50% - 20px); width:7px; height:7px; border-radius:50%; background:#ff4d8e; }
</style>
