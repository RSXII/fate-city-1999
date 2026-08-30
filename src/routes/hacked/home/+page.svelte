<script>
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { base } from '$app/paths';
  import { dbGet } from '$lib/firebase-db.js';

  // Identity lives entirely in the URL — a query param, not a dynamic route
  // segment, matching every other view in this app (?sender=, ?thread=,
  // ?id=). A [param] route folder needs adapter-static to prerender concrete
  // URLs it can't crawl to (NPC keys are GM-managed data, not known at build
  // time), which fails the build outright.
  $: npcKey = $page.url.searchParams.get('npc') ?? '';

  let contacts = [];
  $: contactsByName = Object.fromEntries(contacts.map(c => [c.name, c]));
  $: myMeta = contactsByName[npcKey] ?? { color: '#c0504a', avatar: null };

  function initials(name) {
    const clean = String(name ?? '').replace(/^The\s+/i, '').replace(/\./g, '');
    const parts = clean.split(/[\s-]+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }

  onMount(async () => {
    try {
      const data = await dbGet('contacts');
      if (data) contacts = Object.keys(data).map(k => { const c = data[k]; c._id = k; return c; });
    } catch { contacts = []; }
  });
</script>

<svelte:head>
  <title>Fate City: 1999 — Hacked Device</title>
</svelte:head>

<div class="hacked-banner">
  <span class="hacked-banner-dot" aria-hidden="true"></span>
  ACCESS GRANTED — {npcKey}
</div>

<h1 class="sr-only">Hacked device home screen — {npcKey}</h1>

<div class="hd-wrap">
  <div class="hd-profile">
    <div class="hd-profile-avatar"
      style="background:{myMeta.color}22;border-color:{myMeta.color};color:{myMeta.color}">
      {initials(npcKey)}
      {#if myMeta.avatar}
        <img src="{base}/{myMeta.avatar}" alt="" loading="lazy" class="hd-avatar-img"
          on:error={e => e.currentTarget.style.display = 'none'}>
      {/if}
    </div>
    <div class="hd-profile-name" style="color:{myMeta.color}">{npcKey}</div>
    <div class="hd-profile-sub">{myMeta.subtitle || myMeta.number || 'Wire device'}</div>
  </div>

  <div class="hd-row">
    <a class="hd-icon" href="{base}/hacked/messages?npc={encodeURIComponent(npcKey)}">
      <div class="hd-icon-tile">
        <svg viewBox="0 0 24 24" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9l-4 3v-3H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z" />
        </svg>
      </div>
      <span class="hd-icon-label">Wire</span>
    </a>
  </div>

  <a class="hd-disconnect" href="{base}/hacked">&larr; Disconnect</a>
</div>

<style>
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
  }

  .hacked-banner {
    flex-shrink: 0;
    background: #1a0d0d;
    border-bottom: 1px solid rgba(192, 80, 74, 0.4);
    color: rgba(232, 223, 200, 0.75);
    font-family: 'Courier New', Courier, monospace;
    font-size: 9.5px;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    text-align: center;
    padding: 6px 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
  }
  .hacked-banner-dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: #c0504a;
    flex-shrink: 0;
    animation: hacked-blink 1.1s ease-in-out infinite;
  }
  @keyframes hacked-blink {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0.25; }
  }

  .hd-wrap {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    max-width: 420px;
    width: 100%;
    margin: 0 auto;
    padding: 36px 20px 20px;
    background: #080b10;
  }

  .hd-profile {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    margin-bottom: 40px;
  }
  .hd-profile-avatar {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    border: 1.5px solid;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
    font-weight: 700;
    position: relative;
    overflow: hidden;
  }
  .hd-avatar-img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: 50% 20%;
  }
  .hd-profile-name { font-size: 16px; font-weight: 700; letter-spacing: 0.3px; margin-top: 4px; }
  .hd-profile-sub {
    font-size: 10px;
    letter-spacing: 1px;
    text-transform: uppercase;
    color: #3a4a5a;
  }

  .hd-row {
    display: flex;
    justify-content: center;
    gap: 12px;
    width: 100%;
  }
  .hd-icon {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    text-decoration: none;
  }
  .hd-icon-tile {
    width: 64px;
    height: 64px;
    border: 1px solid rgba(192, 80, 74, 0.4);
    border-radius: 16px;
    background: rgba(192, 80, 74, 0.06);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .hd-icon-tile svg { width: 30px; height: 30px; stroke: #c0504a; fill: none; }
  .hd-icon-label {
    font-size: 9px;
    letter-spacing: 1.1px;
    text-transform: uppercase;
    color: #e8d9a0;
  }

  .hd-disconnect {
    margin-top: auto;
    font-size: 10px;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: #3a4a5a;
    text-decoration: none;
    padding: 10px;
  }
  .hd-disconnect:hover { color: #c0504a; }
</style>
