<script>
  import { base } from '$app/paths';

  export let entry;
  export let onImageClick = () => {};
</script>

<div class="card" style="--rule:{entry.colors.rule};--accent:{entry.colors.accent}">
  <div class="stripe" style="background:{entry.colors.stripe}"></div>
  <div class="dossier-head">
    <span>FILE NO. {entry.fileNo}</span>
    <span class="stamp" style="color:{entry.colors.stampColor}">{entry.stamp}</span>
  </div>
  <hr class="hr" />
  <div class="name-block">
    <h2>{@html entry.name}</h2>
    {#if entry.epithet}<p class="epithet">{@html entry.epithet}</p>{/if}
  </div>

  {#if entry.images?.length}
    <div class="gallery">
      {#each entry.images as src, i}
        <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
        <div class="thumb" on:click={() => onImageClick(entry.images, i, entry.name)}>
          <img src="{base}/{src}" alt={entry.name} loading="lazy" />
        </div>
      {/each}
    </div>
  {/if}

  {#if entry.stats?.length}
    <div class="stats">
      {#each entry.stats as s}
        <div class="stat-row">
          <span class="label">{s.label}</span>
          <span class="value">{@html s.value}</span>
        </div>
      {/each}
    </div>
  {/if}

  <div class="section">
    {#each entry.sections as sec}
      {#if sec.heading}<h3>{sec.heading}</h3>{/if}
      {#each sec.paragraphs ?? [] as p}<p>{@html p}</p>{/each}
      {#if sec.hooks}
        <ul class="hooks">
          {#each sec.hooks as h}<li>{@html h}</li>{/each}
        </ul>
      {/if}
    {/each}
  </div>

  {#if entry.quote}
    <blockquote>
      {@html entry.quote.text}
      <span class="cite">{entry.quote.cite}</span>
    </blockquote>
  {/if}

  <div class="footer-pad"></div>
</div>

<style>
  :root {
    --paper: #f3efe6;
    --paper-dark: #e8e1d2;
    --ink: #1c1a17;
    --ink-soft: #4a4540;
    --gold: #b8902f;
    --line: #cfc6b0;
  }

  .card {
    max-width: 760px;
    margin: 0 auto 36px;
    background: var(--paper);
    border: 1px solid var(--line);
    box-shadow: 0 18px 40px rgba(0,0,0,0.45), 0 0 0 1px rgba(0,0,0,0.05) inset;
    position: relative;
    overflow: hidden;
    font-family: 'Georgia', 'Times New Roman', serif;
    color: var(--ink);
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

  .gallery { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; padding: 14px 28px 6px; }
  .thumb {
    width: 92px; height: 92px; overflow: hidden;
    border: 1px solid var(--line); cursor: pointer;
    background: #fff; box-shadow: 0 4px 10px rgba(0,0,0,0.25);
    transition: transform 0.15s ease, box-shadow 0.15s ease;
  }
  .thumb:hover { transform: translateY(-2px); box-shadow: 0 8px 16px rgba(0,0,0,0.35); }
  .thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }

  .stats { margin: 18px 28px 4px; border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); padding: 10px 0; }
  .stat-row { display: flex; gap: 14px; padding: 5px 0; font-family: 'Arial', sans-serif; font-size: 13px; }
  .stat-row .label { flex: 0 0 130px; font-weight: 700; letter-spacing: 0.5px; color: var(--accent, var(--gold)); text-transform: uppercase; font-size: 11.5px; }
  .stat-row .value { color: #222; }

  .section { padding: 6px 28px 0; }
  .section :global(h3) { font-family: 'Arial', sans-serif; font-size: 13px; letter-spacing: 1.5px; text-transform: uppercase; color: #222; border-bottom: 1px solid var(--line); padding-bottom: 6px; margin: 20px 0 10px; }
  .section :global(p) { font-size: 15.5px; line-height: 1.65; color: #2a2722; margin: 0 0 12px; }
  .section :global(ul.hooks) { margin: 0 0 6px; padding-left: 0; list-style: none; }
  .section :global(ul.hooks li) { font-size: 15px; line-height: 1.55; color: #2a2722; margin: 0 0 9px; padding-left: 20px; position: relative; }
  .section :global(ul.hooks li::before) { content: '\2013'; position: absolute; left: 0; color: var(--accent, var(--gold)); font-weight: 700; }

  blockquote {
    margin: 16px 28px 6px;
    padding: 6px 0 6px 18px;
    border-left: 3px solid var(--accent, var(--gold));
    font-style: italic;
    font-size: 15px;
    color: #3a3630;
  }
  blockquote .cite {
    display: block;
    margin-top: 6px;
    font-style: normal;
    font-size: 12px;
    letter-spacing: 0.5px;
    color: #8a8275;
    font-family: 'Arial', sans-serif;
    text-transform: uppercase;
  }

  .footer-pad { height: 24px; }

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
    .section :global(p) { font-size: 16.5px; line-height: 1.7; }
    blockquote { margin: 14px 16px 6px; font-size: 16px; }
  }
</style>
