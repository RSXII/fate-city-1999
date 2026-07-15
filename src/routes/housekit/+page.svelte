<script>
  import { base } from '$app/paths';
  import { browser } from '$app/environment';
  import { onMount, onDestroy } from 'svelte';
  import { dbGet } from '$lib/firebase-db.js';
  import { visibilityAwareInterval } from '$lib/utils.js';

  let properties = [];
  let loading = true;
  let selectedProp = null;
  let pollInterval;

  async function loadProperties() {
    try {
      const data = await dbGet('housekit/properties');
      if (!data) { properties = []; loading = false; return; }
      properties = Object.keys(data)
        .map(k => ({ _id: k, ...data[k] }))
        .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    } catch { properties = []; }
    loading = false;
  }

  function parseFloorPlan(prop) {
    if (!prop.floorPlan) return null;
    return prop.floorPlan;
  }

  function parseAccess(raw) {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw.filter(Boolean);
    return Object.values(raw).filter(v => typeof v === 'string');
  }

  function selectProp(p) { selectedProp = p; }
  function clearProp() { selectedProp = null; }

  onMount(() => {
    if (!browser) return;
    loadProperties();
    pollInterval = visibilityAwareInterval(loadProperties, 15000);
  });

  onDestroy(() => { if (pollInterval) pollInterval(); });
</script>

<svelte:head>
  <title>Fate City: 1999 — HouseKit</title>
</svelte:head>

<wire-status-bar jail layout="flex"></wire-status-bar>

{#if selectedProp}
  <!-- ── Detail header ─── -->
  <div class="hk-detail-header">
    <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
    <span class="hk-back" on:click={clearProp}>‹ Back</span>
    <span class="hk-detail-title">{selectedProp.name}</span>
  </div>

  <div class="hk-detail-scroll">
    <!-- Hero image -->
    <div class="hk-hero">
      {#if selectedProp.image}
        <img
          class="hk-hero-img"
          src="{base}/images/housekit/{selectedProp.image}"
          alt={selectedProp.name}
        />
      {:else}
        <div class="hk-hero-placeholder">
          <svg viewBox="0 0 24 24" fill="none" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M3 11.5L12 4l9 7.5"/>
            <path d="M5.5 10v10h13V10"/>
            <path d="M10 20v-5q0-2 2-2t2 2v5"/>
          </svg>
        </div>
      {/if}
      <div class="hk-hero-scan" aria-hidden="true"></div>
    </div>

    <div class="hk-detail-body">

      {#if !selectedProp.owner}
        <div class="hk-unowned-banner">
          <svg class="hk-unowned-lock" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <rect x="5" y="11" width="14" height="10" rx="1.5"/>
            <path d="M8 11V7a4 4 0 018 0v4"/>
          </svg>
          <span>UNOWNED — NOT YET ACQUIRED</span>
        </div>
      {/if}

      <!-- Info card -->
      <div class="hk-card">
        <div class="hk-card-title">Property Info</div>
        {#if selectedProp.location}
          <div class="hk-row">
            <span class="hk-row-label">Location</span>
            <span class="hk-row-value">{selectedProp.location}</span>
          </div>
        {/if}
        {#if selectedProp.cost}
          <div class="hk-row">
            <span class="hk-row-label">Purchase Cost</span>
            <span class="hk-row-value hk-cost">{selectedProp.cost}</span>
          </div>
        {/if}
        {#if selectedProp.rooms}
          <div class="hk-row">
            <span class="hk-row-label">Rooms</span>
            <span class="hk-row-value">{selectedProp.rooms} room{selectedProp.rooms !== 1 ? 's' : ''}</span>
          </div>
        {/if}
        {#if selectedProp.tiles}
          <div class="hk-row" style="margin-bottom:0">
            <span class="hk-row-label">Total Tiles</span>
            <span class="hk-row-value">{selectedProp.tiles} tile{selectedProp.tiles !== 1 ? 's' : ''}</span>
          </div>
        {/if}
      </div>

      <!-- Floor plan card -->
      {#if parseFloorPlan(selectedProp)}
        {@const fp = parseFloorPlan(selectedProp)}
        <div class="hk-card">
          <div class="hk-card-title">Floor Plan</div>
          <div class="hk-fp-grid" style="grid-template-columns: repeat({fp.cols}, 14px)">
            {#each Array((fp.rows || 1) * (fp.cols || 1)) as _, idx}
              {@const r = Math.floor(idx / fp.cols)}
              {@const c = idx % fp.cols}
              {@const key = `${r},${c}`}
              {@const cellType = fp.cells?.[key]}
              {@const walls = fp.walls?.[key] || []}
              <div
                class="hk-fp-cell"
                class:hk-fp-filled={cellType === 'filled'}
                class:hk-fp-entrance={cellType === 'entrance'}
                style="
                  {walls.includes('top')    ? 'border-top:2px solid rgba(180,40,40,0.75);'    : ''}
                  {walls.includes('right')  ? 'border-right:2px solid rgba(180,40,40,0.75);'  : ''}
                  {walls.includes('bottom') ? 'border-bottom:2px solid rgba(180,40,40,0.75);' : ''}
                  {walls.includes('left')   ? 'border-left:2px solid rgba(180,40,40,0.75);'   : ''}
                "
              ></div>
            {/each}
          </div>
        </div>
      {/if}

      <!-- Access card -->
      {#if selectedProp.owner || parseAccess(selectedProp.access).length}
        {@const names = parseAccess(selectedProp.access)}
        <div class="hk-card">
          <div class="hk-card-title">Access — {names.length} authorized</div>
          <div class="hk-access-list">
            {#each names as name}
              <div class="hk-access-row">
                <div class="hk-access-avatar">{name.slice(0, 2).toUpperCase()}</div>
                <div class="hk-access-info">
                  <div class="hk-access-name">{name}</div>
                  {#if name === selectedProp.owner}
                    <div class="hk-access-sub">Owner</div>
                  {/if}
                </div>
              </div>
            {/each}
          </div>
        </div>
      {/if}

    </div>
  </div>

{:else}
  <!-- ── Grid view header ─── -->
  <wire-header back="{base}/home" title="HouseKit" subtitle="Property Registry" layout="flex"></wire-header>

  <div class="hk-scroll">
    {#if loading}
      <div class="hk-empty">
        <p class="hk-empty-label">Loading…</p>
      </div>
    {:else if properties.length === 0}
      <div class="hk-empty">
        <div class="hk-empty-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 11.5L12 4l9 7.5"/>
            <path d="M5.5 10v10h13V10"/>
            <path d="M10 20v-5q0-2 2-2t2 2v5"/>
          </svg>
        </div>
        <p class="hk-empty-label">No Properties</p>
        <p class="hk-empty-sub">Safe houses purchased by the crew will appear here.</p>
      </div>
    {:else}
      <div class="hk-section-label">Properties ({properties.length})</div>
      <div class="hk-grid">
        {#each properties as prop (prop._id)}
          <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
          <div class="hk-prop-card" class:hk-prop-card--locked={!prop.owner} on:click={() => selectProp(prop)}>
            <div class="hk-prop-thumb">
              {#if prop.image}
                <img
                  class="hk-prop-img"
                  src="{base}/images/housekit/{prop.image}"
                  alt={prop.name}
                  loading="lazy"
                />
              {:else}
                <div class="hk-prop-thumb-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M3 11.5L12 4l9 7.5"/>
                    <path d="M5.5 10v10h13V10"/>
                    <path d="M10 20v-5q0-2 2-2t2 2v5"/>
                  </svg>
                </div>
              {/if}
              {#if prop.owner}
                <div class="hk-prop-status-dot" aria-hidden="true"></div>
              {:else}
                <div class="hk-prop-lock-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="5" y="11" width="14" height="10" rx="1.5"/>
                    <path d="M8 11V7a4 4 0 018 0v4"/>
                  </svg>
                </div>
              {/if}
            </div>
            <div class="hk-prop-info">
              <div class="hk-prop-name">{prop.name}</div>
              {#if prop.location}<div class="hk-prop-location">{prop.location}</div>{/if}
              {#if prop.cost}<div class="hk-prop-cost">{prop.cost}</div>{/if}
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
{/if}

<style>
  /* ── Accent ──────────────────────────────────────────────────────────────── */
  :root {
    --hk: #2dd4bf;
    --hk-dim: rgba(45, 212, 191, 0.22);
    --hk-faint: rgba(45, 212, 191, 0.08);
  }

  /* ── Grid scroll ─────────────────────────────────────────────────────────── */
  .hk-scroll {
    flex: 1;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    overscroll-behavior-y: none;
    padding-bottom: 32px;
    scrollbar-width: thin;
    scrollbar-color: rgba(45,212,191,0.2) transparent;
  }

  .hk-section-label {
    font-size: 8.5px;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: rgba(45,212,191,0.5);
    padding: 14px 14px 8px;
    font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif;
  }

  /* ── Property grid ───────────────────────────────────────────────────────── */
  .hk-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    padding: 0 12px 12px;
  }

  .hk-prop-card {
    background: rgba(255,255,255,0.03);
    border: 1px solid var(--hk-dim);
    border-radius: 14px;
    overflow: hidden;
    cursor: pointer;
    transition: border-color 0.18s, box-shadow 0.18s;
    font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif;
  }
  .hk-prop-card:active {
    border-color: var(--hk);
    box-shadow: 0 0 14px rgba(45,212,191,0.25);
  }

  .hk-prop-thumb {
    width: 100%;
    aspect-ratio: 1;
    background: #0d1720;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    overflow: hidden;
  }
  .hk-prop-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    opacity: 0.85;
  }
  .hk-prop-thumb-icon svg {
    width: 44px;
    height: 44px;
    stroke: rgba(45,212,191,0.25);
  }
  .hk-prop-status-dot {
    position: absolute;
    top: 7px;
    right: 7px;
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--hk);
    box-shadow: 0 0 6px rgba(45,212,191,0.8);
  }
  .hk-prop-lock-icon {
    position: absolute;
    top: 6px;
    right: 6px;
    width: 16px;
    height: 16px;
  }
  .hk-prop-lock-icon svg {
    width: 16px;
    height: 16px;
    stroke: rgba(232,223,200,0.3);
  }
  .hk-prop-card--locked {
    border-color: rgba(232,223,200,0.08);
    opacity: 0.65;
  }
  .hk-prop-card--locked .hk-prop-name { color: rgba(232,223,200,0.5); }
  .hk-prop-card--locked .hk-prop-location { color: rgba(232,223,200,0.25); }
  .hk-prop-card--locked .hk-prop-img { filter: saturate(0.3); }
  .hk-prop-card--locked .hk-prop-thumb-icon svg { stroke: rgba(255,255,255,0.1); }

  .hk-unowned-banner {
    display: flex;
    align-items: center;
    gap: 8px;
    background: rgba(232,223,200,0.04);
    border: 1px solid rgba(232,223,200,0.12);
    border-radius: 2px;
    padding: 10px 14px;
    margin-bottom: 12px;
    font-family: 'Courier New', monospace;
    font-size: 9px;
    letter-spacing: 1.5px;
    color: rgba(232,223,200,0.35);
    text-transform: uppercase;
  }
  .hk-unowned-lock {
    width: 14px;
    height: 14px;
    stroke: rgba(232,223,200,0.3);
    flex-shrink: 0;
  }

  .hk-prop-info {
    padding: 9px 9px 10px;
  }
  .hk-prop-name {
    font-size: 11px;
    font-weight: 700;
    color: #e8dfc8;
    margin-bottom: 3px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif;
  }
  .hk-prop-location {
    font-size: 9px;
    color: rgba(45,212,191,0.6);
    letter-spacing: 0.4px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin-bottom: 4px;
  }
  .hk-prop-cost {
    font-size: 9px;
    font-family: 'Courier New', monospace;
    color: rgba(232,223,200,0.4);
  }

  /* ── Empty state ─────────────────────────────────────────────────────────── */
  .hk-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 60px 32px;
    gap: 10px;
    font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif;
  }
  .hk-empty-icon svg {
    width: 56px;
    height: 56px;
    stroke: rgba(45,212,191,0.18);
  }
  .hk-empty-label {
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 1px;
    color: rgba(232,223,200,0.4);
  }
  .hk-empty-sub {
    font-size: 11px;
    color: rgba(232,223,200,0.25);
    text-align: center;
    line-height: 1.5;
  }

  /* ── Detail header ───────────────────────────────────────────────────────── */
  .hk-detail-header {
    height: 46px;
    background: rgba(10,9,16,0.96);
    border-bottom: 1px solid var(--hk-dim);
    display: flex;
    align-items: center;
    padding: 0 14px;
    gap: 10px;
    font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif;
    flex-shrink: 0;
  }
  .hk-back {
    font-size: 10px;
    letter-spacing: 1px;
    color: var(--hk);
    text-transform: uppercase;
    cursor: pointer;
    padding: 6px 0;
    flex-shrink: 0;
  }
  .hk-detail-title {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: #e8dfc8;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* ── Detail scroll ───────────────────────────────────────────────────────── */
  .hk-detail-scroll {
    flex: 1;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    overscroll-behavior-y: none;
    padding-bottom: 32px;
    scrollbar-width: thin;
    scrollbar-color: rgba(45,212,191,0.2) transparent;
  }

  /* ── Hero ────────────────────────────────────────────────────────────────── */
  .hk-hero {
    width: 100%;
    aspect-ratio: 16/9;
    background: #0d1720;
    position: relative;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .hk-hero-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .hk-hero-placeholder svg {
    width: 64px;
    height: 64px;
    stroke: rgba(45,212,191,0.2);
  }
  .hk-hero-scan {
    position: absolute;
    inset: 0;
    pointer-events: none;
    background: repeating-linear-gradient(
      to bottom,
      transparent 0px, transparent 2px,
      rgba(0,0,0,0.12) 2px, rgba(0,0,0,0.12) 3px
    );
  }

  /* ── Detail body ─────────────────────────────────────────────────────────── */
  .hk-detail-body {
    padding: 14px 14px 20px;
    font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif;
  }

  .hk-card {
    background: rgba(255,255,255,0.03);
    border: 1px solid var(--hk-dim);
    border-radius: 12px;
    padding: 12px;
    margin-bottom: 10px;
  }
  .hk-card-title {
    font-size: 8px;
    letter-spacing: 2.5px;
    text-transform: uppercase;
    color: rgba(45,212,191,0.5);
    margin-bottom: 10px;
    padding-bottom: 6px;
    border-bottom: 1px solid rgba(45,212,191,0.1);
  }

  .hk-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 7px;
  }
  .hk-row-label {
    font-size: 10px;
    color: rgba(232,223,200,0.4);
  }
  .hk-row-value {
    font-size: 10px;
    color: #e8dfc8;
    font-weight: 600;
    text-align: right;
  }
  .hk-cost {
    font-family: 'Courier New', monospace;
    color: var(--hk);
  }

  /* ── Floor plan ──────────────────────────────────────────────────────────── */
  .hk-fp-grid {
    display: grid;
    gap: 1px;
    background: rgba(0,0,0,0.3);
    width: fit-content;
    padding: 1px;
  }
  .hk-fp-cell {
    width: 14px;
    height: 14px;
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.05);
  }
  .hk-fp-filled {
    background: rgba(45,212,191,0.5);
    border-color: rgba(45,212,191,0.25);
  }
  .hk-fp-entrance {
    background: rgba(160,30,30,0.75);
    border-color: rgba(200,50,50,0.4);
  }

  /* ── Access list ─────────────────────────────────────────────────────────── */
  .hk-access-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .hk-access-row {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .hk-access-avatar {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: var(--hk-faint);
    border: 1px solid var(--hk-dim);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 9px;
    font-weight: 700;
    color: var(--hk);
    flex-shrink: 0;
    font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif;
  }
  .hk-access-info { flex: 1; min-width: 0; }
  .hk-access-name {
    font-size: 11px;
    color: #e8dfc8;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif;
  }
  .hk-access-sub {
    font-size: 8.5px;
    letter-spacing: 1px;
    text-transform: uppercase;
    color: var(--hk);
    opacity: 0.7;
  }
</style>
