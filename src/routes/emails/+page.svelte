<script>
  import { onMount, onDestroy, afterUpdate } from 'svelte';
  import { fly } from 'svelte/transition';
  import { page } from '$app/stores';
  import { base } from '$app/paths';
  import { dbGet } from '$lib/firebase-db.js';
  import { relTime, normMessages, visibilityAwareInterval } from '$lib/utils.js';
  import Attachment from '$lib/components/Attachment.svelte';
  import PaginatedList from '$lib/components/PaginatedList.svelte';
  import SearchModal from '$lib/components/SearchModal.svelte';
  import { emailsCache } from '$lib/stores/search.js';

  const SEEN_KEY        = 'wire-email-seen-chains';
  const PLAYER_TAGS_KEY = 'wire-player-tags';

  const CLASSIFICATION_META = {
    decrypted:  { label: 'Decrypted',     color: '#4ade80' },
    classified: { label: 'Classified',    color: '#f59e0b' },
    corrupted:  { label: 'Corrupted',     color: '#f87171' },
    partial:    { label: 'Partial',       color: '#fb923c' },
    archived:   { label: 'Archived',      color: '#60a5fa' },
    verified:   { label: 'Verified',      color: '#86efac' },
  };

  const TYPE_COLOR = {
    email:        '#4ade80',
    log:          '#fbbf24',
    document:     '#60a5fa',
    transmission: '#34d399',
  };

  // SVG inner paths keyed by type — used inside <svg viewBox="0 0 24 24">
  const TYPE_ICON_PATH = {
    email:        `<rect x="3" y="5.5" width="18" height="13" rx="1.5"/><path d="M3.6 6.8l8.4 6.3 8.4-6.3"/>`,
    log:          `<path d="M4 6h16M4 10h16M4 14h10M4 18h7"/>`,
    document:     `<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/>`,
    transmission: `<path d="M12 8a4 4 0 100 8 4 4 0 000-8z"/><path d="M6.3 6.3a8 8 0 000 11.4M17.7 6.3a8 8 0 010 11.4"/>`,
  };

  // Driven by ?id= query param — null means list view
  $: activeId = $page.url.searchParams.get('id');

  let chains = [];
  let thread = undefined; // undefined=loading, null=not found, object=loaded
  let feedEl;
  let pollTimer;
  let needsScroll = false;
  let searchOpen = false;

  // ── Filter state ───────────────────────────────────────────────────────────
  let activeGmTag    = null;
  let activePlayerTag = null;

  $: allGmTags       = [...new Set(chains.flatMap(c => c.tags ?? []))].sort();
  $: allPlayerTagsList = [...new Set(Object.values(playerTags).flat())].sort();
  $: filteredChains  = chains.filter(c => {
    if (activeGmTag     && !(c.tags ?? []).includes(activeGmTag))          return false;
    if (activePlayerTag && !(playerTags[c._id] ?? []).includes(activePlayerTag)) return false;
    return true;
  });

  // ── Player tags (localStorage only — never touches Firebase) ──────────────
  let playerTags    = {};
  let playerTagInput = '';

  function loadPlayerTags() {
    try { return JSON.parse(localStorage.getItem(PLAYER_TAGS_KEY) ?? '{}'); }
    catch { return {}; }
  }

  function savePlayerTags(t) { localStorage.setItem(PLAYER_TAGS_KEY, JSON.stringify(t)); }

  function addPlayerTag(chainId, raw) {
    const t = raw.trim().toLowerCase();
    if (!t) return;
    const cur = playerTags[chainId] ?? [];
    if (cur.includes(t)) return;
    playerTags = { ...playerTags, [chainId]: [...cur, t] };
    savePlayerTags(playerTags);
    playerTagInput = '';
  }

  function removePlayerTag(chainId, tag) {
    playerTags = { ...playerTags, [chainId]: (playerTags[chainId] ?? []).filter(t => t !== tag) };
    savePlayerTags(playerTags);
  }

  $: chainPlayerTags = activeId ? (playerTags[activeId] ?? []) : [];

  // ── Seen tracking ──────────────────────────────────────────────────────────
  function loadSeen() {
    try { return JSON.parse(localStorage.getItem(SEEN_KEY) ?? '{}'); }
    catch { return {}; }
  }

  function markSeen(id) {
    const seen = loadSeen();
    seen[id] = Date.now();
    localStorage.setItem(SEEN_KEY, JSON.stringify(seen));
  }

  // ── Poll ───────────────────────────────────────────────────────────────────
  async function poll() {
    if (activeId) {
      const data = await dbGet(`emails/${activeId}`);
      if (!data || data.staged !== true) { thread = null; return; }
      const prevLen = thread ? normMessages(thread.messages).length : 0;
      thread = data;
      if (normMessages(thread.messages).length > prevLen) needsScroll = true;
      markSeen(activeId);
    } else {
      const data = await dbGet('emails');
      if (!data) { chains = []; return; }
      const seen = loadSeen();
      chains = Object.entries(data)
        .map(([id, c]) => ({ ...c, _id: id }))
        .filter(c => c.staged === true)
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
        .map(c => {
          const msgs  = normMessages(c.messages);
          const last  = msgs.at(-1);
          const type  = c.type || 'email';
          const preview = last
            ? (type === 'email'
                ? `FROM: ${last.from ?? '?'} — ${(last.body ?? '').slice(0, 55)}`
                : (last.body ?? '').slice(0, 70))
            : '';
          return { ...c, type, preview, ts: c.createdAt || (last?.ts ?? 0), unread: !seen[c._id] };
        });
      emailsCache.set(chains);
    }
  }

  function refetch() { thread = undefined; chains = []; poll(); }
  $: activeId, refetch();

  afterUpdate(() => {
    if (needsScroll && feedEl) {
      feedEl.scrollTop = feedEl.scrollHeight;
      needsScroll = false;
    }
  });

  onMount(() => {
    playerTags = loadPlayerTags();
    pollTimer  = visibilityAwareInterval(poll, 5000);
  });

  onDestroy(() => { if (pollTimer) pollTimer(); });

  $: threadMessages = thread ? normMessages(thread.messages) : [];
  $: threadType     = thread?.type || 'email';
  $: threadColor    = TYPE_COLOR[threadType] ?? '#4ade80';
  $: classInfo      = CLASSIFICATION_META[thread?.classification] ?? CLASSIFICATION_META.decrypted;
</script>

<svelte:head>
  <title>Fate City: 1999 — Data Packets</title>
</svelte:head>

<wire-status-bar jail layout="flex"></wire-status-bar>

<h1 class="sr-only">Fate City: 1999 Wire Data Packets</h1>

<header class="mail-header">
  {#if activeId}
    <a class="mail-back" href="{base}/emails" aria-label="Back to all packets">&lsaquo;</a>
    <div class="mail-header-icon" style="background:rgba({threadColor === '#4ade80' ? '74,222,128' : threadColor === '#fbbf24' ? '251,191,36' : threadColor === '#60a5fa' ? '96,165,250' : '52,211,153'},0.08);border-color:rgba({threadColor === '#4ade80' ? '74,222,128' : threadColor === '#fbbf24' ? '251,191,36' : threadColor === '#60a5fa' ? '96,165,250' : '52,211,153'},0.3)">
      <svg viewBox="0 0 24 24" style="stroke:{threadColor}">
        {@html TYPE_ICON_PATH[threadType] ?? TYPE_ICON_PATH.email}
      </svg>
    </div>
    <div class="mail-header-info">
      <div class="mail-header-title">{thread?.subject ?? 'Loading…'}</div>
      <div class="mail-header-sub">
        {#if thread?.source}
          {thread.source}
        {:else}
          Intercepted &middot; Fate City
        {/if}
      </div>
    </div>
    <span class="intercept-chip" style="color:{classInfo.color};border-color:rgba({classInfo.color === '#4ade80' ? '74,222,128' : '200,192,170'},0.38);background:rgba({classInfo.color === '#4ade80' ? '74,222,128' : '200,192,170'},0.06)">
      {classInfo.label}
    </span>
  {:else}
    <a class="mail-back" href="{base}/home" aria-label="Back to home screen">&lsaquo;</a>
    <span class="mail-live-dot" aria-hidden="true"></span>
    <div class="mail-header-info">
      <div class="mail-header-title">Data Packets</div>
      <div class="mail-header-sub">Intercepted data &middot; Fate City</div>
    </div>
    <span class="intercept-chip" style="margin-left:auto">Secure</span>
    <button class="search-btn" on:click={() => searchOpen = true} aria-label="Search packets">
      <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M16.5 16.5l4 4"/></svg>
    </button>
  {/if}
</header>

<div class="mail-feed" bind:this={feedEl}>
  {#if activeId}
    <!-- ── Thread / packet view ───────────────────────────────────────────── -->
    {#if thread === null}
      <p class="mail-empty">Data packet not found<br>or not yet accessible.</p>
    {:else if thread !== undefined && !threadMessages.length}
      <p class="mail-empty">No content in this packet.</p>
    {:else if thread !== undefined}
      <div class="mail-thread-subject">
        <span class="thread-type-label" style="color:{threadColor}">{threadType.toUpperCase()}</span>
        {thread.subject ?? ''}
      </div>

      {#each threadMessages as m, i (i)}
        {#if i > 0}
          <hr class="mail-separator" />
        {/if}

        {#if threadType === 'email'}
          <!-- Email block: FROM header + body -->
          <div class="mail-block" in:fly={{ y: 10, duration: 400 }}>
            <div class="mail-block-header">
              <span class="mail-from">FROM: {m.from ?? 'Unknown'}</span>
              <span class="mail-ts">{m.ts ? relTime(m.ts) : ''}</span>
            </div>
            <div class="mail-body">{m.body ?? ''}</div>
            {#if m.imageUrl}<Attachment url={m.imageUrl} />{/if}
          </div>

        {:else if threadType === 'log'}
          <!-- Log block: optional section label + formatted body -->
          <div class="mail-block log-block" in:fly={{ y: 10, duration: 400 }}>
            {#if m.label}
              <div class="log-section-label">{m.label}</div>
            {/if}
            <div
              class="log-body"
              class:log-body-sm={m.size === 'sm'}
              class:log-body-lg={m.size === 'lg'}
              class:log-body-bold={m.bold}
              style={m.color ? `color:${m.color}` : ''}
            >{m.body ?? ''}</div>
            {#if m.imageUrl}<Attachment url={m.imageUrl} />{/if}
          </div>

        {:else if threadType === 'document'}
          <!-- Document block: optional section label + body -->
          <div class="mail-block doc-block" in:fly={{ y: 10, duration: 400 }}>
            {#if m.label}
              <div class="doc-section-label">{m.label}</div>
            {/if}
            <div
              class="doc-body"
              class:doc-body-sm={m.size === 'sm'}
              class:doc-body-lg={m.size === 'lg'}
              class:doc-body-bold={m.bold}
              style={m.color ? `color:${m.color}` : ''}
            >{m.body ?? ''}</div>
            {#if m.imageUrl}<Attachment url={m.imageUrl} />{/if}
          </div>

        {:else if threadType === 'transmission'}
          <!-- Transmission: transcript frame -->
          <div class="mail-block tx-block" in:fly={{ y: 10, duration: 400 }}>
            <div class="tx-header">
              <span class="tx-label">TRANSMISSION RECEIVED</span>
              <span class="mail-ts">{m.ts ? relTime(m.ts) : ''}</span>
            </div>
            <div class="tx-body">{m.body ?? ''}</div>
          </div>

        {:else}
          <!-- Fallback to email style -->
          <div class="mail-block" in:fly={{ y: 10, duration: 400 }}>
            {#if m.from}<div class="mail-block-header"><span class="mail-from">FROM: {m.from}</span><span class="mail-ts">{m.ts ? relTime(m.ts) : ''}</span></div>{/if}
            <div class="mail-body">{m.body ?? ''}</div>
            {#if m.imageUrl}<Attachment url={m.imageUrl} />{/if}
          </div>
        {/if}
      {/each}

      <!-- ── Player tags ─────────────────────────────────────────────────── -->
      <div class="player-tags-section">
        <div class="player-tags-header">Your Tags</div>
        {#if chainPlayerTags.length}
          <div class="player-tags-chips">
            {#each chainPlayerTags as tag (tag)}
              <span class="player-tag-chip">
                {tag}
                <button class="player-tag-remove" on:click={() => removePlayerTag(activeId, tag)} aria-label="Remove tag">&times;</button>
              </span>
            {/each}
          </div>
        {/if}
        <div class="player-tag-input-row">
          <input
            class="player-tag-input"
            bind:value={playerTagInput}
            placeholder="Add tag…"
            maxlength="32"
            on:keydown={e => { if (e.key === 'Enter') { e.preventDefault(); addPlayerTag(activeId, playerTagInput); } }}
          />
          <button class="player-tag-add-btn" on:click={() => addPlayerTag(activeId, playerTagInput)} aria-label="Add tag">+</button>
        </div>
      </div>
    {/if}

  {:else}
    <!-- ── List view ─────────────────────────────────────────────────────── -->

    <!-- Filter bar: GM tags + player tags -->
    {#if allGmTags.length || allPlayerTagsList.length}
      <div class="filter-bar">
        {#if allGmTags.length}
          <div class="filter-row">
            {#each allGmTags as tag (tag)}
              <button
                class="filter-chip gm-chip"
                class:active={activeGmTag === tag}
                on:click={() => activeGmTag = activeGmTag === tag ? null : tag}
              >{tag}</button>
            {/each}
          </div>
        {/if}
        {#if allPlayerTagsList.length}
          <div class="filter-row">
            {#each allPlayerTagsList as tag (tag)}
              <button
                class="filter-chip player-chip"
                class:active={activePlayerTag === tag}
                on:click={() => activePlayerTag = activePlayerTag === tag ? null : tag}
              >{tag}</button>
            {/each}
          </div>
        {/if}
      </div>
    {/if}

    {#if !filteredChains.length}
      <p class="mail-empty">
        {chains.length ? 'No packets match the active filter.' : 'No data packets received.\nInsert when acquired.'}
      </p>
    {:else}
      <PaginatedList items={filteredChains} pageSize={20} let:item>
        {@const c = item}
        {@const typeColor = TYPE_COLOR[c.type] ?? '#4ade80'}
        {@const pTags = playerTags[c._id] ?? []}
        <a class="chain-row" href="{base}/emails?id={encodeURIComponent(c._id)}"
          in:fly={{ y: 8, duration: 350 }}>
          <div class="chain-icon" style="background:rgba(0,0,0,0.3);border-color:rgba({typeColor === '#4ade80' ? '74,222,128' : typeColor === '#fbbf24' ? '251,191,36' : typeColor === '#60a5fa' ? '96,165,250' : '52,211,153'},0.25)">
            <svg viewBox="0 0 24 24" style="stroke:{typeColor}">
              {@html TYPE_ICON_PATH[c.type] ?? TYPE_ICON_PATH.email}
            </svg>
          </div>
          <div class="chain-content">
            <div class="chain-top">
              <span class="chain-subject" class:unread={c.unread}>{c.subject ?? '(no subject)'}</span>
              <span class="chain-time">{relTime(c.ts)}</span>
            </div>
            <div class="chain-preview" class:unread={c.unread}>{c.preview}</div>
            {#if c.source || pTags.length}
              <div class="chain-meta-row">
                {#if c.source}
                  <span class="chain-source">{c.source}</span>
                {/if}
                {#each pTags as tag (tag)}
                  <span class="chain-player-tag">{tag}</span>
                {/each}
              </div>
            {/if}
          </div>
          {#if c.unread}
            <span class="chain-unread-dot" aria-hidden="true"></span>
          {/if}
        </a>
      </PaginatedList>
    {/if}
  {/if}
</div>

<div class="mail-footer-note">Encrypted &middot; Read only &middot; Data packet</div>

<SearchModal open={searchOpen} on:close={() => searchOpen = false} />

<style>
  .sr-only {
    position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0,0,0,0);
  }

  /* ── header ─────────────────────────────────────────────────────────────── */
  .mail-header {
    flex-shrink: 0; background: #0c0f16; border-bottom: 1px solid #1a2030;
    padding: 12px 20px; display: flex; align-items: center; gap: 10px;
  }
  .mail-back {
    font-size: 20px; color: #c9a227; text-decoration: none; opacity: 0.9;
    line-height: 1; flex-shrink: 0; position: relative; padding: 8px; margin: -8px;
  }
  .mail-back:hover { opacity: 1; }
  .mail-back::before { content: ''; position: absolute; inset: -8px; }
  .mail-live-dot {
    width: 7px; height: 7px; border-radius: 50%; background: #c9a227;
    flex-shrink: 0; animation: live-pulse 2s ease-in-out infinite;
  }
  @keyframes live-pulse { 0%,100% { opacity:0.35; } 50% { opacity:1; } }

  .mail-header-icon {
    width: 28px; height: 28px; border-radius: 7px; border: 1px solid;
    display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  }
  .mail-header-icon svg {
    width: 14px; height: 14px; fill: none; stroke-width: 1.6;
    stroke-linecap: round; stroke-linejoin: round;
  }
  .mail-header-info { flex: 1; min-width: 0; }
  .mail-header-title {
    font-size: 14px; font-weight: 600; letter-spacing: 0.5px; color: #e8dfc8;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .mail-header-sub {
    font-size: 9.5px; letter-spacing: 1px; text-transform: uppercase;
    color: #3a4a5a; margin-top: 2px;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .intercept-chip {
    font-size: 8px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase;
    border: 1px solid; padding: 2px 6px; border-radius: 2px; flex-shrink: 0;
    color: #4ade80; border-color: rgba(74,222,128,0.38); background: rgba(74,222,128,0.06);
  }

  /* ── feed ────────────────────────────────────────────────────────────────── */
  .mail-feed {
    flex: 1; overflow-y: auto; padding: 16px 16px 8px;
    scrollbar-width: thin; scrollbar-color: rgba(184,144,47,0.2) transparent;
  }
  .mail-feed::-webkit-scrollbar { width: 3px; }
  .mail-feed::-webkit-scrollbar-thumb { background: rgba(184,144,47,0.25); border-radius: 2px; }

  /* ── filter bar ──────────────────────────────────────────────────────────── */
  .filter-bar { max-width: 480px; margin: 0 auto 12px; display: flex; flex-direction: column; gap: 5px; }
  .filter-row { display: flex; gap: 5px; flex-wrap: wrap; }
  .filter-chip {
    font-size: 9px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase;
    padding: 3px 8px; border-radius: 10px; border: 1px solid; cursor: pointer;
    transition: all 0.12s ease; line-height: 1.4; background: none;
  }
  .gm-chip { color: rgba(201,162,39,0.6); border-color: rgba(201,162,39,0.2); }
  .gm-chip:hover, .gm-chip.active { color: #c9a227; border-color: rgba(201,162,39,0.5); background: rgba(201,162,39,0.08); }
  .player-chip { color: rgba(52,211,153,0.6); border-color: rgba(52,211,153,0.2); }
  .player-chip:hover, .player-chip.active { color: #34d399; border-color: rgba(52,211,153,0.5); background: rgba(52,211,153,0.08); }

  /* ── list view ───────────────────────────────────────────────────────────── */
  .chain-row {
    display: flex; align-items: center; gap: 12px; max-width: 480px;
    margin: 0 auto; padding: 12px 6px; text-decoration: none;
    border-bottom: 1px solid rgba(255,255,255,0.045);
  }
  .chain-row:active { background: rgba(255,255,255,0.03); }
  .chain-icon {
    flex-shrink: 0; width: 40px; height: 40px; border-radius: 10px;
    border: 1px solid; display: flex; align-items: center; justify-content: center;
  }
  .chain-icon svg {
    width: 18px; height: 18px; fill: none; stroke-width: 1.5;
    stroke-linecap: round; stroke-linejoin: round;
  }
  .chain-content { flex: 1; min-width: 0; }
  .chain-top {
    display: flex; justify-content: space-between; align-items: baseline;
    margin-bottom: 3px; gap: 8px;
  }
  .chain-subject {
    font-size: 13.5px; font-weight: 600; color: #e8dfc8;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .chain-subject.unread { color: #f3efe6; }
  .chain-time { font-size: 10px; color: rgba(232,223,200,0.38); flex-shrink: 0; }
  .chain-preview {
    font-size: 11.5px; color: rgba(232,223,200,0.48); overflow: hidden;
    text-overflow: ellipsis; white-space: nowrap;
    font-family: 'Courier New', Courier, monospace;
  }
  .chain-preview.unread { color: rgba(232,223,200,0.82); font-weight: 500; }
  .chain-meta-row {
    display: flex; align-items: center; gap: 6px; margin-top: 3px; flex-wrap: wrap;
  }
  .chain-source {
    font-size: 9.5px; color: rgba(232,223,200,0.28); letter-spacing: 0;
    font-family: -apple-system, sans-serif; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .chain-player-tag {
    font-size: 8.5px; font-weight: 700; letter-spacing: 0.5px; text-transform: lowercase;
    color: #34d399; background: rgba(52,211,153,0.08); border: 1px solid rgba(52,211,153,0.22);
    padding: 1px 5px; border-radius: 8px;
  }
  .chain-unread-dot {
    width: 8px; height: 8px; border-radius: 50%; background: #c9a227; flex-shrink: 0;
  }

  /* ── thread / subject header ─────────────────────────────────────────────── */
  .mail-thread-subject {
    max-width: 480px; margin: 0 auto 18px; padding: 10px 14px;
    background: rgba(201,162,39,0.05); border: 1px solid rgba(201,162,39,0.14);
    border-radius: 5px; font-size: 11px; letter-spacing: 1.2px; text-transform: uppercase;
    color: rgba(201,162,39,0.75); font-family: 'Courier New', Courier, monospace; word-break: break-word;
    display: flex; align-items: baseline; gap: 8px;
  }
  .thread-type-label {
    font-size: 8px; font-weight: 800; letter-spacing: 2px; flex-shrink: 0; opacity: 0.9;
  }

  /* ── shared block wrapper ────────────────────────────────────────────────── */
  .mail-block { max-width: 480px; margin: 0 auto 4px; }

  /* ── email blocks ────────────────────────────────────────────────────────── */
  .mail-block-header {
    display: flex; align-items: baseline; justify-content: space-between;
    gap: 8px; margin-bottom: 6px;
  }
  .mail-from {
    font-size: 10.5px; font-weight: 700; letter-spacing: 1.2px; text-transform: uppercase;
    color: #4ade80; font-family: 'Courier New', Courier, monospace;
  }
  .mail-ts { font-size: 9.5px; color: rgba(232,223,200,0.3); font-family: 'Courier New', Courier, monospace; flex-shrink: 0; }
  .mail-body {
    font-size: 13.5px; line-height: 1.7; color: rgba(232,223,200,0.9);
    font-family: 'Courier New', Courier, monospace; white-space: pre-wrap; word-break: break-word;
    padding: 4px 0 10px;
  }

  /* ── log blocks ──────────────────────────────────────────────────────────── */
  .log-block { padding: 12px; background: rgba(251,191,36,0.03); border: 1px solid rgba(251,191,36,0.1); border-radius: 5px; }
  .log-section-label {
    font-size: 8.5px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase;
    color: rgba(251,191,36,0.55); margin-bottom: 8px; font-family: 'Courier New', Courier, monospace;
  }
  .log-body {
    font-size: 12px; line-height: 1.65; color: rgba(232,223,200,0.85);
    font-family: 'Courier New', Courier, monospace; white-space: pre-wrap; word-break: break-word;
  }
  .log-body-sm { font-size: 10px; }
  .log-body-lg { font-size: 15px; }
  .log-body-bold { font-weight: 700; }

  /* ── document blocks ─────────────────────────────────────────────────────── */
  .doc-block { padding: 14px; background: rgba(96,165,250,0.03); border: 1px solid rgba(96,165,250,0.1); border-radius: 5px; }
  .doc-section-label {
    font-size: 9px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase;
    color: rgba(96,165,250,0.6); margin-bottom: 10px; border-bottom: 1px solid rgba(96,165,250,0.12); padding-bottom: 6px;
    font-family: -apple-system, sans-serif;
  }
  .doc-body {
    font-size: 13px; line-height: 1.75; color: rgba(232,223,200,0.88);
    font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif; white-space: pre-wrap; word-break: break-word;
  }
  .doc-body-sm { font-size: 11px; }
  .doc-body-lg { font-size: 16px; }
  .doc-body-bold { font-weight: 700; }

  /* ── transmission blocks ─────────────────────────────────────────────────── */
  .tx-block { padding: 14px 16px; background: rgba(52,211,153,0.04); border: 1px solid rgba(52,211,153,0.15); border-radius: 5px; }
  .tx-header {
    display: flex; align-items: baseline; justify-content: space-between;
    gap: 8px; margin-bottom: 10px;
  }
  .tx-label {
    font-size: 8px; font-weight: 800; letter-spacing: 2.5px; text-transform: uppercase;
    color: #34d399; font-family: 'Courier New', Courier, monospace;
  }
  .tx-body {
    font-size: 13px; line-height: 1.8; color: rgba(232,223,200,0.88);
    font-family: 'Courier New', Courier, monospace; white-space: pre-wrap; word-break: break-word;
    border-left: 2px solid rgba(52,211,153,0.25); padding-left: 12px;
  }

  .mail-separator {
    max-width: 480px; margin: 6px auto 14px; border: none; border-top: 1px solid rgba(255,255,255,0.06);
  }

  /* ── player tags section ─────────────────────────────────────────────────── */
  .player-tags-section {
    max-width: 480px; margin: 24px auto 8px; padding: 12px 14px;
    background: rgba(52,211,153,0.03); border: 1px solid rgba(52,211,153,0.12);
    border-radius: 8px;
  }
  .player-tags-header {
    font-size: 8.5px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase;
    color: rgba(52,211,153,0.55); margin-bottom: 8px;
  }
  .player-tags-chips { display: flex; flex-wrap: wrap; gap: 5px; margin-bottom: 8px; }
  .player-tag-chip {
    display: inline-flex; align-items: center; gap: 4px;
    font-size: 11px; font-weight: 600; color: #34d399;
    background: rgba(52,211,153,0.08); border: 1px solid rgba(52,211,153,0.25);
    padding: 3px 8px; border-radius: 10px;
  }
  .player-tag-remove {
    background: none; border: none; color: rgba(52,211,153,0.5);
    font-size: 13px; cursor: pointer; padding: 0; line-height: 1;
  }
  .player-tag-remove:hover { color: #34d399; }
  .player-tag-input-row { display: flex; gap: 6px; }
  .player-tag-input {
    flex: 1; background: rgba(0,0,0,0.3); border: 1px solid rgba(52,211,153,0.2);
    border-radius: 6px; color: #e8dfc8; font-size: 12px; padding: 6px 10px;
    outline: none; font-family: inherit;
  }
  .player-tag-input:focus { border-color: rgba(52,211,153,0.45); }
  .player-tag-input::placeholder { color: #3a4a5a; }
  .player-tag-add-btn {
    background: rgba(52,211,153,0.08); border: 1px solid rgba(52,211,153,0.25);
    color: #34d399; font-size: 18px; font-weight: 400; width: 34px;
    border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center;
    flex-shrink: 0; transition: all 0.12s ease;
  }
  .player-tag-add-btn:hover { background: rgba(52,211,153,0.15); }

  /* ── search button ───────────────────────────────────────────────────────── */
  .search-btn {
    background: none; border: none; color: #6a7d90; padding: 6px; cursor: pointer;
    display: flex; align-items: center; justify-content: center; border-radius: 6px;
    transition: color 0.15s ease, background 0.15s ease; flex-shrink: 0;
  }
  .search-btn:hover { color: #c9a227; background: rgba(201,162,39,0.08); }
  .search-btn svg { width: 16px; height: 16px; stroke: currentColor; fill: none; stroke-width: 2; stroke-linecap: round; }

  /* ── empty / footer ──────────────────────────────────────────────────────── */
  .mail-empty {
    max-width: 300px; margin: 60px auto; text-align: center; font-size: 13px;
    font-style: italic; line-height: 1.7; color: #3a4a5a;
    font-family: 'Courier New', Courier, monospace; white-space: pre-wrap;
  }
  .mail-footer-note {
    flex-shrink: 0; text-align: center; font-size: 9px; letter-spacing: 1px;
    text-transform: uppercase; color: #2e3d4a; padding: 6px 0 10px;
  }
</style>
