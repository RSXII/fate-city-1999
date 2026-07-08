<script>
  import { base } from '$app/paths';

  export let data;
  $: photos = data.photos;

  let lbOpen = false;
  let lbIndex = 0;

  function open(i) { lbIndex = i; lbOpen = true; }
  function close() { lbOpen = false; }
  function prev() { lbIndex = (lbIndex - 1 + photos.length) % photos.length; }
  function next() { lbIndex = (lbIndex + 1) % photos.length; }

  function onKeydown(e) {
    if (!lbOpen) return;
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowLeft') prev();
    if (e.key === 'ArrowRight') next();
  }
</script>

<svelte:window on:keydown={onKeydown} />

<svelte:head>
  <title>Fate City: 1999 — Camera</title>
</svelte:head>

<wire-status-bar jail layout="flex"></wire-status-bar>
<wire-header back="{base}/home" title="Camera" layout="flex"></wire-header>

<div class="cam-scroll">
  {#if photos.length === 0}
    <div class="empty">
      <div class="empty-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <rect x="3" y="7.5" width="18" height="12.5" rx="2" />
          <path d="M8.3 7.5l1.3-2.3h4.8l1.3 2.3" />
          <circle cx="12" cy="13.7" r="3.3" />
        </svg>
      </div>
      <p class="empty-label">No Photos</p>
      <p class="empty-sub">Drop images into static/camera/ — they appear here automatically.</p>
    </div>
  {:else}
    <div class="grid">
      {#each photos as src, i}
        <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
        <div class="cell" on:click={() => open(i)}>
          <img src="{base}/camera/{src}" alt="" loading="lazy" />
        </div>
      {/each}
    </div>
  {/if}
</div>

{#if lbOpen}
  <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
  <div class="lb" on:click={close}>
    <button class="lb-close" on:click|stopPropagation={close} aria-label="Close">✕</button>

    {#if photos.length > 1}
      <button class="lb-arrow lb-prev" on:click|stopPropagation={prev} aria-label="Previous">‹</button>
    {/if}

    <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
    <img
      class="lb-img"
      src="{base}/camera/{photos[lbIndex]}"
      alt=""
      on:click|stopPropagation
    />

    {#if photos.length > 1}
      <button class="lb-arrow lb-next" on:click|stopPropagation={next} aria-label="Next">›</button>
      <div class="lb-counter">{lbIndex + 1} / {photos.length}</div>
    {/if}
  </div>
{/if}

<style>
  .cam-scroll {
    flex: 1;
    overflow-y: auto;
    background: #000;
    scrollbar-width: thin;
    scrollbar-color: rgba(255,255,255,0.1) transparent;
  }

  /* ── Empty state ─────────────────────────────────────────────────────────── */
  .empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    padding: 60px 32px;
    gap: 12px;
    text-align: center;
  }
  .empty-icon svg {
    width: 44px;
    height: 44px;
    stroke: rgba(255,255,255,0.15);
  }
  .empty-label {
    font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif;
    font-size: 11px;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: rgba(255,255,255,0.2);
    margin: 0;
  }
  .empty-sub {
    font-size: 12px;
    color: rgba(255,255,255,0.12);
    margin: 0;
    line-height: 1.55;
    max-width: 260px;
  }

  /* ── Photo grid ──────────────────────────────────────────────────────────── */
  .grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 2px;
  }

  .cell {
    aspect-ratio: 1;
    overflow: hidden;
    cursor: pointer;
    background: #111;
  }
  .cell img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
    transition: opacity 0.15s;
  }
  .cell:active img {
    opacity: 0.75;
  }

  /* ── Lightbox ────────────────────────────────────────────────────────────── */
  .lb {
    position: fixed;
    inset: 0;
    z-index: 999;
    background: rgba(0, 0, 0, 0.96);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .lb-img {
    max-width: 100vw;
    max-height: 100vh;
    object-fit: contain;
    display: block;
    cursor: default;
  }

  .lb-close {
    position: absolute;
    top: 16px;
    right: 18px;
    background: none;
    border: none;
    color: rgba(255,255,255,0.7);
    font-size: 22px;
    line-height: 1;
    cursor: pointer;
    padding: 6px;
    z-index: 10;
  }

  .lb-arrow {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    background: none;
    border: none;
    color: rgba(255,255,255,0.6);
    font-size: 44px;
    line-height: 1;
    cursor: pointer;
    padding: 8px 16px;
    z-index: 10;
    user-select: none;
  }
  .lb-prev { left: 0; }
  .lb-next { right: 0; }

  .lb-counter {
    position: absolute;
    bottom: 20px;
    left: 0;
    right: 0;
    text-align: center;
    font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif;
    font-size: 12px;
    color: rgba(255,255,255,0.4);
    letter-spacing: 0.5px;
  }
</style>
