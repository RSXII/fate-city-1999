<script>
  import { base } from '$app/paths';
  import { onMount } from 'svelte';
  import { ENTRIES, CATEGORY_ORDER } from '$lib/data/intel.js';
  import { dbGet } from '$lib/firebase-db.js';
  import { toBriefingEntry } from '$lib/briefing-format.js';
  import BriefingCard from '$lib/components/BriefingCard.svelte';

  // Group by category in display order
  const GROUPS = CATEGORY_ORDER
    .map(g => ({ ...g, entries: ENTRIES.filter(e => e.category === g.key) }))
    .filter(g => g.entries.length > 0);

  // ── GM-authored case files, staged via the console ─────────────────────────
  let liveEntries = [];
  onMount(async () => {
    const data = await dbGet('briefings');
    if (!data) return;
    liveEntries = Object.keys(data)
      .map(k => ({ _id: k, ...data[k] }))
      .filter(b => b.section === 'intel' && b.staged === true)
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
      .map(toBriefingEntry);
  });

  // ── Lightbox ──────────────────────────────────────────────────────────────
  let lbOpen = false;
  let lbImages = [];
  let lbIndex = 0;
  let lbCaption = '';

  function openLightbox(images, idx, caption) {
    lbImages = images;
    lbIndex = idx;
    lbCaption = caption;
    lbOpen = true;
  }
  function closeLightbox() { lbOpen = false; }
  function lbPrev() { lbIndex = (lbIndex - 1 + lbImages.length) % lbImages.length; }
  function lbNext() { lbIndex = (lbIndex + 1) % lbImages.length; }
</script>

<svelte:head>
  <title>Fate City: 1999 — Field Intel</title>
</svelte:head>

<wire-status-bar jail layout="flex"></wire-status-bar>
<wire-header back="{base}/once" title="Field Intel" subtitle="Fate City: 1999 — World Briefing" more layout="flex"></wire-header>

<div class="intel-scroll">
  {#each GROUPS as group, gi}
    <div class="section-divider" class:first={gi === 0}>
      <span class="section-divider-label">{group.label}</span>
    </div>

    {#each group.entries as entry}
      {@const c = entry.colors}
      <div class="card" style="--rule:{c.rule};--accent:{c.accent}">
        <div class="stripe" style="background:{c.stripe}"></div>
        <div class="dossier-head">
          <span>FILE NO. {entry.fileNo}</span>
          <span class="stamp" style="color:{c.stampColor}">{entry.stamp}</span>
        </div>
        <hr class="hr" />
        <div class="name-block">
          <h2>{entry.name}</h2>
          <p class="epithet">{entry.epithet}</p>
        </div>

        {#if entry.images?.length}
          <div class="gallery">
            {#each entry.images as src, i}
              <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
              <div class="thumb" on:click={() => openLightbox(entry.images, i, entry.name)}>
                <img src="{base}/{src}" alt={entry.name} loading="lazy" />
              </div>
            {/each}
          </div>
        {/if}

        <div class="stats">
          {#each entry.stats as s}
            <div class="stat-row">
              <span class="label">{s.label}</span>
              <span class="value">{s.value}</span>
            </div>
          {/each}
        </div>

        <div class="section">
          {#each entry.sections as sec}
            {#if sec.heading}<h3>{sec.heading}</h3>{/if}
            {#each sec.paragraphs ?? [] as p}<p>{p}</p>{/each}
            {#if sec.hooks}
              <ul class="hooks">
                {#each sec.hooks as h}<li>{h}</li>{/each}
              </ul>
            {/if}
          {/each}
        </div>

        {#if entry.quote}
          <blockquote>
            {entry.quote.text}
            <span class="cite">{entry.quote.cite}</span>
          </blockquote>
        {/if}

        <div class="footer-pad"></div>
      </div>
    {/each}
  {/each}

  {#if liveEntries.length}
    <div class="section-divider">
      <span class="section-divider-label">Field Updates</span>
    </div>
    {#each liveEntries as entry (entry.id)}
      <BriefingCard {entry} onImageClick={openLightbox} />
    {/each}
  {/if}
</div>

<!-- Lightbox -->
{#if lbOpen}
  <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
  <div class="lightbox" on:click={closeLightbox}>
    <span class="close-x" on:click|stopPropagation={closeLightbox}>&times;</span>
    {#if lbImages.length > 1}
      <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
      <span class="nav-arrow prev" on:click|stopPropagation={lbPrev}>&#8249;</span>
    {/if}
    <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
    <img src="{base}/{lbImages[lbIndex]}" alt={lbCaption} on:click|stopPropagation />
    {#if lbImages.length > 1}
      <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
      <span class="nav-arrow next" on:click|stopPropagation={lbNext}>&#8250;</span>
    {/if}
    <span class="caption">{lbCaption}</span>
  </div>
{/if}

<style>
  /* ── Variables ─────────────────────────────────────────────────────────── */
  :root {
    --paper: #f3efe6;
    --paper-dark: #e8e1d2;
    --ink: #1c1a17;
    --ink-soft: #4a4540;
    --gold: #b8902f;
    --line: #cfc6b0;
  }

  /* ── Scroll wrapper ─────────────────────────────────────────────────────── */
  .intel-scroll {
    flex: 1;
    overflow-y: auto;
    background: #0d1118;
    font-family: 'Georgia', 'Times New Roman', serif;
    color: var(--ink);
    padding: 0 0 48px;
    scrollbar-width: thin;
    scrollbar-color: rgba(184,144,47,0.2) transparent;
  }

  /* ── Section dividers ───────────────────────────────────────────────────── */
  .section-divider {
    max-width: 760px;
    margin: 48px auto 24px;
    display: flex;
    align-items: center;
    gap: 18px;
  }
  .section-divider.first { margin-top: 28px; }
  .section-divider::before, .section-divider::after {
    content: '';
    flex: 1;
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(184,144,47,0.25), transparent);
  }
  .section-divider-label {
    font-family: 'Arial', sans-serif;
    font-size: 13px;
    letter-spacing: 4px;
    text-transform: uppercase;
    color: #8a7a3a;
    white-space: nowrap;
  }

  /* ── Paper card ─────────────────────────────────────────────────────────── */
  .card {
    max-width: 760px;
    margin: 0 auto 36px;
    background: var(--paper);
    border: 1px solid var(--line);
    box-shadow: 0 18px 40px rgba(0,0,0,0.45), 0 0 0 1px rgba(0,0,0,0.05) inset;
    position: relative;
    overflow: hidden;
  }
  .card::before {
    content: '';
    position: absolute;
    inset: 0;
    background-image: repeating-linear-gradient(0deg, rgba(0,0,0,0.015) 0px, transparent 1px, transparent 2px);
    pointer-events: none;
  }
  .stripe { height: 6px; }

  .dossier-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 14px 28px 0;
    font-family: 'Arial', sans-serif;
    font-size: 11px;
    letter-spacing: 1px;
    color: var(--ink-soft);
  }
  .stamp { font-weight: 700; letter-spacing: 1.5px; }
  .hr { margin: 10px 28px 0; border: none; border-top: 2px solid var(--rule, var(--gold)); }

  .name-block { padding: 18px 28px 4px; }
  .name-block h2 {
    font-family: 'Arial Black', 'Arial', sans-serif;
    font-size: 30px;
    margin: 0;
    letter-spacing: 0.5px;
    color: #191713;
  }
  .name-block .epithet { font-style: italic; font-size: 15px; margin: 6px 0 0; color: var(--accent, var(--gold)); }

  /* ── Gallery ────────────────────────────────────────────────────────────── */
  .gallery { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; padding: 14px 28px 6px; }
  .thumb {
    width: 92px; height: 92px; overflow: hidden;
    border: 1px solid var(--line); cursor: pointer;
    background: #fff; box-shadow: 0 4px 10px rgba(0,0,0,0.25);
    transition: transform 0.15s ease, box-shadow 0.15s ease;
  }
  .thumb:hover { transform: translateY(-2px); box-shadow: 0 8px 16px rgba(0,0,0,0.35); }
  .thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }

  /* ── Stats ──────────────────────────────────────────────────────────────── */
  .stats { margin: 18px 28px 4px; border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); padding: 10px 0; }
  .stat-row { display: flex; gap: 14px; padding: 5px 0; font-family: 'Arial', sans-serif; font-size: 13px; }
  .stat-row .label { flex: 0 0 130px; font-weight: 700; letter-spacing: 0.5px; color: var(--accent, var(--gold)); text-transform: uppercase; font-size: 11.5px; }
  .stat-row .value { color: #222; }

  /* ── Sections ───────────────────────────────────────────────────────────── */
  .section { padding: 6px 28px 0; }
  .section h3 { font-family: 'Arial', sans-serif; font-size: 13px; letter-spacing: 1.5px; text-transform: uppercase; color: #222; border-bottom: 1px solid var(--line); padding-bottom: 6px; margin: 20px 0 10px; }
  .section p { font-size: 15.5px; line-height: 1.65; color: #2a2722; margin: 0 0 12px; }
  :global(.section ul.hooks) { margin: 0 0 6px; padding-left: 0; list-style: none; }
  :global(.section ul.hooks li) { font-size: 15px; line-height: 1.55; color: #2a2722; margin: 0 0 9px; padding-left: 20px; position: relative; }
  :global(.section ul.hooks li::before) { content: '\2013'; position: absolute; left: 0; color: var(--accent, var(--gold)); font-weight: 700; }

  blockquote { margin: 16px 28px 6px; padding: 6px 0 6px 18px; border-left: 3px solid var(--accent, var(--gold)); font-style: italic; font-size: 15px; color: #3a3630; }
  .cite { display: block; margin-top: 6px; font-style: normal; font-size: 12px; letter-spacing: 0.5px; color: #8a8275; font-family: 'Arial', sans-serif; text-transform: uppercase; }
  .footer-pad { height: 24px; }

  /* ── Lightbox ───────────────────────────────────────────────────────────── */
  .lightbox {
    position: fixed; inset: 0; z-index: 999;
    background: rgba(10,9,7,0.92);
    display: flex; align-items: center; justify-content: center;
    padding: 30px; cursor: zoom-out;
  }
  .lightbox img { max-width: 92vw; max-height: 88vh; box-shadow: 0 0 60px rgba(0,0,0,0.6); border: 1px solid #444; cursor: default; }
  .caption { position: absolute; bottom: 24px; left: 0; right: 0; text-align: center; color: #cfc6b0; font-family: 'Arial', sans-serif; font-size: 13px; letter-spacing: 0.5px; }
  .close-x { position: absolute; top: 18px; right: 26px; color: #cfc6b0; font-family: 'Arial', sans-serif; font-size: 28px; cursor: pointer; line-height: 1; }
  .nav-arrow { position: absolute; top: 50%; transform: translateY(-50%); color: #cfc6b0; font-family: 'Arial', sans-serif; font-size: 36px; cursor: pointer; padding: 10px 16px; user-select: none; }
  .nav-arrow.prev { left: 6px; }
  .nav-arrow.next { right: 6px; }

  /* ── Mobile ─────────────────────────────────────────────────────────────── */
  @media (max-width: 600px) {
    .card { max-width: 100%; margin: 0 0 24px; }
    .name-block h2 { font-size: 24px; }
    .dossier-head { padding: 12px 16px 0; font-size: 10px; }
    .hr { margin: 10px 16px 0; }
    .name-block { padding: 14px 16px 4px; }
    .gallery { padding: 12px 16px 6px; }
    .stats { margin: 14px 16px 4px; }
    .stat-row { flex-direction: column; gap: 2px; font-size: 14px; }
    .stat-row .label { flex: none; font-size: 11px; }
    .section { padding: 6px 16px 0; }
    .section p { font-size: 16.5px; line-height: 1.7; }
    blockquote { margin: 14px 16px 6px; font-size: 16px; }
  }
</style>
