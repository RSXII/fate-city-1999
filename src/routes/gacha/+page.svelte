<script>
  import { onMount, onDestroy } from 'svelte';
  import { page } from '$app/stores';
  import { base } from '$app/paths';
  import { BANNERS } from '$lib/data/banners.js';

  // ── Banner config ─────────────────────────────────────────────────────────
  $: bannerId = $page.url.searchParams.get('banner') ?? 'echo7';
  $: banner = BANNERS[bannerId] ?? BANNERS.echo7;
  $: cssVarStr = banner
    ? Object.entries(banner.cssVars).map(([k, v]) => `${k}:${v}`).join(';')
    : '';

  // ── State ─────────────────────────────────────────────────────────────────
  let rsAmount = 0;
  let pityCount = 0;
  $: pityPct = Math.min(100, (pityCount / (banner?.pityMax ?? 80)) * 100);

  // ── Intro overlay ─────────────────────────────────────────────────────────
  let introVisible = true;
  let audio;
  let musicMuted = false;
  let musicStarted = false;

  function dismissIntro() {
    introVisible = false;
    if (audio) {
      audio.volume = 0.45;
      audio.play().then(() => { musicStarted = true; }).catch(() => {});
    }
  }

  function toggleMusic() {
    if (!audio) return;
    musicMuted = !musicMuted;
    if (musicMuted) { audio.pause(); }
    else { audio.play().catch(() => {}); }
  }

  // ── Countdown timer ───────────────────────────────────────────────────────
  let timerText = '\u25cf Ends in \u2014 : \u2014 : \u2014';
  let timerInterval;

  function updateTimer() {
    const end = new Date();
    end.setDate(1);
    end.setMonth(end.getMonth() + 1);
    end.setHours(0, 0, 0, 0);
    const diff = end - Date.now();
    if (diff <= 0) { timerText = '\u25cf Expired'; return; }
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    timerText = `\u25cf Ends in ${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  }

  // ── Pull logic ────────────────────────────────────────────────────────────
  let resultVisible = false;
  let resultTitle = '';
  let resultItems = [];
  let currencyFlash = false;

  function doPull(count) {
    if (!banner) return;
    const cost = count === 1 ? banner.costSingle : banner.costMulti;
    if (rsAmount < cost) {
      currencyFlash = true;
      setTimeout(() => { currencyFlash = false; }, 600);
      return;
    }
    rsAmount -= cost;
    const results = [];
    for (let i = 0; i < count; i++) {
      const forceUpgrade = count === 10 && i === count - 1;
      const { item, newPity } = banner.rollOne(pityCount, forceUpgrade);
      pityCount = newPity;
      results.push(item);
    }
    pityCount = results[results.length - 1].rarity === 'rs' ? 0 : pityCount;
    showResults(count, results);
  }

  function showResults(count, items) {
    resultTitle = count === 1 ? 'You received\u2026' : `${count}x Pull Results`;
    resultItems = items;
    resultVisible = true;
  }

  function rarityStars(rarity) {
    if (rarity === 'rs' || rarity === '5' || rarity === 'five_featured') return '\u2605\u2605\u2605';
    if (rarity === 'purple' || rarity === '4') return '\u2605\u2605';
    return '\u2605';
  }

  onMount(() => {
    updateTimer();
    timerInterval = setInterval(updateTimer, 1000);
  });

  onDestroy(() => clearInterval(timerInterval));
</script>

<svelte:head>
  <title>EverNear — Resonance Pull</title>
</svelte:head>

<!-- Apply banner CSS vars to entire page via wrapper -->
<div class="gacha-root" style={cssVarStr}>

  <!-- ── Wire header ──────────────────────────────────────────────────────── -->
  <wire-header back="{base}/evernear" title={banner?.headerTitle ?? 'Resonance Pull'}
    subtitle={banner?.headerSubtitle ?? 'EverNear'} icon></wire-header>

  <!-- ── Intro overlay ────────────────────────────────────────────────────── -->
  {#if introVisible && banner}
    <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
    <div class="intro-overlay" on:click={dismissIntro}>
      <div class="intro-line"></div><div class="intro-line"></div>
      <div class="intro-line"></div><div class="intro-line"></div>
      <div class="intro-line"></div>
      <div class="intro-grid"></div>
      <div class="intro-icon">{banner.intro.icon}</div>
      <div class="intro-eyebrow">{banner.intro.eyebrow}</div>
      <div class="intro-headline">{@html banner.intro.headline.join('<br />')}</div>
      <div class="intro-tap">
        <div class="intro-tap-dot"></div>
        {banner.intro.tapText}
        <div class="intro-tap-dot"></div>
      </div>
    </div>
  {/if}

  <!-- ── Page content ─────────────────────────────────────────────────────── -->
  <div class="gacha-page">
    <!-- Banner video -->
    <div class="banner-wrap">
      {#if banner?.videoSrc}
        <video class="banner-img" src="{base}/{banner.videoSrc}" autoplay loop muted playsinline preload="auto"></video>
      {:else}
        <div class="banner-placeholder">
          <div class="banner-placeholder-title">{banner?.title ?? ''}</div>
        </div>
      {/if}
      <div class="banner-limited-tag">Limited Run</div>
      <div class="banner-timer">{timerText}</div>
    </div>

    <div class="content">
      <div class="gacha-name">{banner?.title ?? ''}</div>
      <div class="gacha-subtitle">{banner?.subtitle ?? ''}</div>

      <!-- Featured items (nyan banner) -->
      {#if banner?.featured?.length}
        <div class="featured-row">
          {#each banner.featured as f}
            <div class="featured-chip">
              <span class="feat-icon">{f.icon}</span>
              <span class="feat-name">{f.name}</span>
              <span class="feat-rarity">{f.rarity}\u2605</span>
            </div>
          {/each}
        </div>
      {/if}

      <!-- Currency panel -->
      <div class="currency-panel" class:flash={currencyFlash}>
        <div>
          <div class="currency-panel-label">Your Resonance Shards</div>
          <div class="currency-panel-amount">
            <div class="cp-dot"></div>
            <div class="cp-value">{rsAmount}</div>
            <div class="cp-unit">RS</div>
          </div>
          <div class="pity-row">
            <span class="pity-label">Pity</span>
            <div class="pity-bar-wrap">
              <div class="pity-track">
                <div class="pity-fill" style="width:{pityPct}%"></div>
              </div>
            </div>
            <span class="pity-count">{pityCount} / {banner?.pityMax ?? 80}</span>
          </div>
        </div>
        <button class="cp-add-btn" on:click={() => { rsAmount += 10; }}>+ Get RS</button>
      </div>

      <!-- Rates -->
      <div class="rates-row">
        {#if banner?.rates}
          {#each banner.rates as r}
            <div class="rate-chip">
              <div class="rate-chip-tier" style="color:{r.colorVar};font-size:{r.small ? '10px' : '14px'}">{r.label}</div>
              <div class="rate-chip-pct">{r.pct}</div>
            </div>
          {/each}
        {/if}
      </div>

      <!-- Pull buttons -->
      <div class="pull-section-label">Resonance Pull</div>
      <div class="pull-buttons">
        <button class="pull-btn-single" on:click={() => doPull(1)}>
          <div class="pull-btn-single-left">
            <div class="pull-btn-single-name">Single Pull</div>
            <div class="pull-btn-single-desc">1 guaranteed reward</div>
          </div>
          <div class="pull-btn-single-cost">
            <div class="pull-cost-dot"></div>
            <div class="pull-cost-value">{banner?.costSingle ?? 3}</div>
            <div class="pull-cost-unit">RS</div>
          </div>
        </button>
        <button class="pull-btn-multi" on:click={() => doPull(10)}>
          <div class="pull-btn-multi-left">
            <div class="pull-btn-multi-name">10x Pull</div>
            <div class="pull-btn-multi-desc">{banner?.multiGuaranteeDesc ?? '1 \u2605\u2605 or higher guaranteed'}</div>
          </div>
          <div class="pull-btn-multi-right">
            <div class="deal-badge">\u2605 Best Deal — Save 5 RS</div>
            <div class="pull-multi-cost">
              <div class="pull-multi-cost-dot"></div>
              <div class="pull-multi-cost-value">{banner?.costMulti ?? 25}</div>
              <div class="pull-multi-cost-unit">RS</div>
            </div>
            <div class="pull-multi-savings">{(banner?.costSingle ?? 3) * 10} RS normally</div>
          </div>
        </button>
      </div>

      <!-- Fine print -->
      {#if banner?.finePrint}
        <div class="fine-print">
          {banner.finePrint}<br />
          <a href="#">Banner Details &amp; Full Rates</a> &nbsp;&middot;&nbsp; <a href="#">Terms of Service</a>
        </div>
      {/if}
    </div>
  </div>

  <!-- ── Pull result overlay ───────────────────────────────────────────────── -->
  {#if resultVisible}
    <div class="result-overlay active">
      <div class="result-title">{resultTitle}</div>
      <div class="result-cards">
        {#each resultItems as item, i}
          <div class="result-card rarity-{item.rarity}" style="animation-delay:{i * 70}ms">
            <div class="result-card-icon">{item.icon}</div>
            <div class="result-card-name">{item.name}</div>
            <div class="result-card-rarity">{rarityStars(item.rarity)}</div>
          </div>
        {/each}
      </div>
      <button class="result-close-btn" on:click={() => { resultVisible = false; }}>
        Collect &amp; Close
      </button>
    </div>
  {/if}

  <!-- ── Music toggle ──────────────────────────────────────────────────────── -->
  <button class="music-toggle" class:muted={musicMuted} on:click={toggleMusic} title={musicMuted ? 'Unmute music' : 'Mute music'}>
    <svg viewBox="0 0 24 24">
      {#if musicMuted}
        <path d="M16.5 12A4.5 4.5 0 0014 7.97v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06A8.99 8.99 0 0017.73 18l1.73 1.73L21 18.27 4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
      {:else}
        <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0014 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/>
      {/if}
    </svg>
  </button>

  <!-- Background audio (bound after mount) -->
  {#if banner?.audioSrc}
    <audio bind:this={audio} loop preload="auto" src="{base}/{banner.audioSrc}"></audio>
  {/if}

</div><!-- /gacha-root -->

<style>
  /* ── Base palette (shared with evernear) ───────────────────────────────── */
  .gacha-root {
    flex: 1;
    overflow-y: auto;
    background: #0a0710;
    color: #f0e8ff;
    font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif;
    padding-bottom: 32px;
    /* CSS var fallbacks */
    --bg: #0a0710;
    --surface: #13101e;
    --border: #2d2445;
    --pink: #ff4d8e;
    --purple: #a855f7;
    --rs: #c77dff;
    --bt: #4dd9ff;
    --np: #f5c842;
    --text: #f0e8ff;
    --muted: #7a6d90;
    --lock: #1e1830;
    --grad: linear-gradient(135deg,#ff4d8e,#a855f7,#4dd9ff);
    /* banner-specific (overridden via cssVarStr) */
    --banner-accent: #b8962a;
    --banner-dim: rgba(184,150,42,0.18);
    --banner-alt: #0dd4c8;
    --banner-grad: linear-gradient(135deg,#b8962a,#0dd4c8,#a855f7);
    --banner-insuf: var(--pink);
  }

  /* ── Intro overlay ──────────────────────────────────────────────────────── */
  .intro-overlay {
    position: fixed; inset: 0; z-index: 9000;
    background: #0a0710;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    overflow: hidden; cursor: pointer;
  }
  .intro-line {
    position: absolute; top: 0; bottom: 0;
    width: 1px; background: linear-gradient(to bottom, transparent, var(--banner-dim) 40%, var(--banner-dim) 60%, transparent);
    opacity: 0.5;
  }
  .intro-line:nth-child(1) { left: 15%; }
  .intro-line:nth-child(2) { left: 30%; }
  .intro-line:nth-child(3) { right: 30%; }
  .intro-line:nth-child(4) { right: 15%; }
  .intro-line:nth-child(5) { left: 50%; }
  .intro-grid {
    position: absolute; bottom: 0; left: 0; right: 0; height: 45%;
    background: linear-gradient(0deg, var(--banner-dim) 1px, transparent 1px),
                linear-gradient(90deg, rgba(184,150,42,0.05) 1px, transparent 1px);
    background-size: 44px 22px;
    mask-image: linear-gradient(to top, rgba(0,0,0,0.55), transparent);
    -webkit-mask-image: linear-gradient(to top, rgba(0,0,0,0.55), transparent);
  }
  .intro-icon {
    font-size: 52px; position: relative; z-index:1;
    filter: drop-shadow(0 0 14px var(--banner-alt));
    animation: intro-pulse 2.2s ease-in-out infinite; margin-bottom: 18px;
  }
  @keyframes intro-pulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.06)} }
  .intro-eyebrow {
    position: relative; z-index:1; font-size: 9px; font-weight:700;
    letter-spacing: 3.5px; text-transform: uppercase; color: var(--banner-accent); opacity: 0.65; margin-bottom: 10px;
  }
  .intro-headline {
    position: relative; z-index:1;
    font-size: clamp(30px,9vw,44px); font-weight:900; letter-spacing:4px;
    text-transform: uppercase; text-align:center; line-height:1.05; padding:0 20px;
    background: var(--banner-grad); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text;
    margin-bottom: 36px;
  }
  .intro-tap {
    position: relative; z-index:1;
    font-size:11px; font-weight:700; letter-spacing:3px; text-transform:uppercase;
    color: rgba(255,255,255,0.45);
    animation: intro-tap-pulse 1.3s ease-in-out infinite;
    display: flex; align-items: center; gap: 9px;
  }
  @keyframes intro-tap-pulse { 0%,100%{opacity:.35} 50%{opacity:1} }
  .intro-tap-dot { width:6px; height:6px; border-radius:50%; background:var(--banner-alt); }

  /* ── Page content ───────────────────────────────────────────────────────── */
  .gacha-page { padding: 0; }

  .banner-wrap { position:relative; width:100%; aspect-ratio:16/9; overflow:hidden; background:var(--surface); }
  .banner-img { width:100%; height:100%; object-fit:cover; display:block; }
  .banner-placeholder { width:100%; height:100%; background:linear-gradient(135deg,#1a0825,#2d1045,#0a1a35,#0a0710); display:flex; flex-direction:column; align-items:center; justify-content:center; }
  .banner-placeholder-title { font-size:26px; font-weight:900; letter-spacing:3px; text-transform:uppercase; background:var(--banner-grad); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; }
  .banner-limited-tag {
    position:absolute; top:10px; left:12px;
    font-size:8.5px; font-weight:700; letter-spacing:2px; text-transform:uppercase;
    color:var(--banner-accent); border:1px solid var(--banner-accent); background:rgba(10,7,16,0.7);
    padding:3px 7px; border-radius:3px; backdrop-filter:blur(4px);
  }
  .banner-timer {
    position:absolute; bottom:10px; right:12px;
    font-size:10px; letter-spacing:1.5px; text-transform:uppercase;
    color:var(--banner-alt); background:rgba(10,7,16,0.7);
    padding:4px 8px; border-radius:4px; backdrop-filter:blur(4px);
    font-family:'Courier New',Courier,monospace;
  }

  .content { padding: 16px 14px; }
  .gacha-name { font-size:22px; font-weight:900; letter-spacing:1px; margin-bottom:6px; }
  .gacha-subtitle { font-size:12px; line-height:1.6; color:var(--muted); margin-bottom:14px; }

  /* Featured chips (nyan) */
  .featured-row { display:flex; flex-wrap:wrap; gap:6px; margin-bottom:12px; }
  .featured-chip { display:flex; align-items:center; gap:5px; background:var(--surface); border:1px solid var(--border); border-radius:8px; padding:5px 10px; font-size:11px; }
  .feat-icon { font-size:14px; }
  .feat-name { color:var(--text); font-weight:600; }
  .feat-rarity { color:var(--rs); font-size:10px; }

  /* Currency panel */
  .currency-panel {
    background:var(--surface); border:1px solid var(--border); border-radius:12px;
    padding:12px 14px; margin-bottom:14px;
    display:flex; align-items:center; justify-content:space-between; gap:12px;
    transition:border-color 0.2s;
  }
  .currency-panel.flash { border-color:var(--banner-insuf); }
  .currency-panel-label { font-size:9.5px; letter-spacing:1.5px; text-transform:uppercase; color:var(--muted); margin-bottom:6px; }
  .currency-panel-amount { display:flex; align-items:baseline; gap:5px; margin-bottom:6px; }
  .cp-dot { width:8px; height:8px; border-radius:50%; background:var(--rs); flex-shrink:0; align-self:center; }
  .cp-value { font-size:24px; font-weight:800; color:var(--rs); }
  .cp-unit { font-size:12px; color:var(--muted); }
  .pity-row { display:flex; align-items:center; gap:8px; }
  .pity-label { font-size:9.5px; color:var(--muted); text-transform:uppercase; letter-spacing:1px; white-space:nowrap; }
  .pity-bar-wrap { flex:1; }
  .pity-track { height:4px; background:var(--lock); border-radius:2px; overflow:hidden; }
  .pity-fill { height:100%; background:var(--banner-grad); border-radius:2px; transition:width 0.3s; }
  .pity-count { font-size:9.5px; color:var(--muted); white-space:nowrap; font-family:'Courier New',Courier,monospace; }
  .cp-add-btn { flex-shrink:0; background:var(--banner-grad); border:none; border-radius:8px; color:#fff; font-size:12px; font-weight:700; padding:10px 14px; cursor:pointer; white-space:nowrap; }

  /* Rates */
  .rates-row { display:flex; gap:8px; margin-bottom:16px; flex-wrap:wrap; }
  .rate-chip { background:var(--surface); border:1px solid var(--border); border-radius:8px; padding:8px 12px; text-align:center; flex:1; min-width:60px; }
  .rate-chip-tier { font-size:14px; font-weight:700; margin-bottom:3px; }
  .rate-chip-pct { font-size:11px; color:var(--muted); }

  /* Pull buttons */
  .pull-section-label { font-size:9.5px; letter-spacing:2px; text-transform:uppercase; color:var(--muted); margin-bottom:8px; }
  .pull-buttons { display:flex; flex-direction:column; gap:10px; margin-bottom:16px; }

  .pull-btn-single {
    width:100%; display:flex; align-items:center; justify-content:space-between;
    background:var(--surface); border:1px solid var(--banner-accent); border-radius:12px;
    padding:14px 16px; cursor:pointer; color:var(--text); gap:12px;
  }
  .pull-btn-single:active { background:var(--banner-dim); }
  .pull-btn-single-name { font-size:14px; font-weight:700; text-align:left; }
  .pull-btn-single-desc { font-size:11px; color:var(--muted); margin-top:2px; text-align:left; }
  .pull-btn-single-cost { display:flex; align-items:center; gap:5px; flex-shrink:0; }
  .pull-cost-dot { width:8px; height:8px; border-radius:50%; background:var(--rs); }
  .pull-cost-value { font-size:20px; font-weight:800; color:var(--rs); }
  .pull-cost-unit { font-size:11px; color:var(--muted); }

  .pull-btn-multi {
    width:100%; display:flex; align-items:center; justify-content:space-between;
    background:var(--banner-grad); border:none; border-radius:12px;
    padding:14px 16px; cursor:pointer; color:#fff; gap:12px;
  }
  .pull-btn-multi-name { font-size:14px; font-weight:700; text-align:left; }
  .pull-btn-multi-desc { font-size:11px; opacity:0.8; margin-top:2px; text-align:left; }
  .pull-btn-multi-right { display:flex; flex-direction:column; align-items:flex-end; gap:2px; flex-shrink:0; }
  .deal-badge { font-size:8.5px; font-weight:700; letter-spacing:1px; text-transform:uppercase; opacity:0.85; }
  .pull-multi-cost { display:flex; align-items:center; gap:4px; }
  .pull-multi-cost-dot { width:7px; height:7px; border-radius:50%; background:rgba(255,255,255,0.7); }
  .pull-multi-cost-value { font-size:20px; font-weight:800; }
  .pull-multi-cost-unit { font-size:11px; opacity:0.7; }
  .pull-multi-savings { font-size:10px; opacity:0.55; text-decoration:line-through; }

  /* Fine print */
  .fine-print { font-size:10px; line-height:1.7; color:var(--muted); margin-top:4px; }
  .fine-print a { color:var(--banner-alt); }

  /* Result overlay */
  .result-overlay {
    position: fixed; inset: 0; z-index: 8000;
    background: rgba(10,7,16,0.95);
    display: flex; flex-direction:column; align-items:center; justify-content:center;
    padding: 24px 16px;
    animation: result-in 0.25s ease;
  }
  @keyframes result-in { from{opacity:0;transform:scale(0.96)} to{opacity:1;transform:scale(1)} }
  .result-title { font-size:16px; font-weight:700; letter-spacing:1px; margin-bottom:20px; color:var(--text); }
  .result-cards { display:flex; flex-wrap:wrap; gap:10px; justify-content:center; max-width:360px; margin-bottom:24px; }
  .result-card {
    width:80px; display:flex; flex-direction:column; align-items:center;
    background:var(--surface); border:1px solid var(--border); border-radius:12px;
    padding:12px 6px 8px; gap:4px;
    animation: card-pop 0.3s ease both;
  }
  @keyframes card-pop { from{opacity:0;transform:translateY(12px) scale(0.9)} to{opacity:1;transform:none} }
  .result-card.rarity-rs { border-color:var(--rs); background:rgba(199,125,255,0.08); }
  .result-card.rarity-purple { border-color:var(--purple); background:rgba(168,85,247,0.07); }
  .result-card-icon { font-size:26px; }
  .result-card-name { font-size:9px; text-align:center; color:var(--text); line-height:1.3; }
  .result-card-rarity { font-size:10px; color:var(--banner-accent); }
  .result-close-btn {
    background:var(--banner-grad); border:none; border-radius:12px;
    color:#fff; font-size:14px; font-weight:700; padding:14px 32px; cursor:pointer;
  }

  /* Music toggle */
  .music-toggle {
    position: fixed; bottom: 42px; right: 14px; z-index: 450;
    width: 36px; height: 36px; border-radius: 50%;
    background: rgba(10,7,16,0.82); border: 1px solid var(--banner-accent);
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; backdrop-filter: blur(4px);
  }
  .music-toggle svg { width:16px; height:16px; fill:var(--banner-accent); }
  .music-toggle.muted svg { fill:var(--muted); }
</style>
