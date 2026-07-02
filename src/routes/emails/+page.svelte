<script>
  import { onMount, onDestroy, afterUpdate } from 'svelte';
  import { fly } from 'svelte/transition';
  import { page } from '$app/stores';
  import { base } from '$app/paths';
  import { dbGet } from '$lib/firebase-db.js';
  import { relTime, normMessages } from '$lib/utils.js';
  import Attachment from '$lib/components/Attachment.svelte';
  import PaginatedList from '$lib/components/PaginatedList.svelte';
  import SearchModal from '$lib/components/SearchModal.svelte';
  import { emailsCache } from '$lib/stores/search.js';

  const SEEN_KEY = 'wire-email-seen-chains';

  // Driven by ?id= query param — null means list view
  $: activeId = $page.url.searchParams.get('id');

  let chains = [];
  let thread = undefined; // undefined=loading, null=not found, object=loaded
  let feedEl;
  let pollTimer;
  let needsScroll = false;
  let searchOpen = false;

  // ── seen tracking ──────────────────────────────────────────────────────────

  function loadSeen() {
    try { return JSON.parse(localStorage.getItem(SEEN_KEY) ?? '{}'); }
    catch { return {}; }
  }

  function markSeen(id) {
    const seen = loadSeen();
    seen[id] = Date.now();
    localStorage.setItem(SEEN_KEY, JSON.stringify(seen));
  }

  // ── poll ───────────────────────────────────────────────────────────────────

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
          const msgs = normMessages(c.messages);
          const last = msgs.at(-1);
          return {
            ...c,
            preview: last
              ? `FROM: ${last.from ?? '?'} \u2014 ${(last.body ?? '').slice(0, 55)}`
              : '',
            ts: c.createdAt || (last?.ts ?? 0),
            unread: !seen[c._id],
          };
        });
      emailsCache.set(chains);
    }
  }

  // Reset state and re-fetch immediately when list ↔ thread navigation happens
  // (same component instance, query param changes)
  function refetch() {
    thread = undefined;
    chains = [];
    poll();
  }
  $: activeId, refetch();

  afterUpdate(() => {
    if (needsScroll && feedEl) {
      feedEl.scrollTop = feedEl.scrollHeight;
      needsScroll = false;
    }
  });

  onMount(() => {
    pollTimer = setInterval(poll, 3000);
  });

  onDestroy(() => clearInterval(pollTimer));

  $: threadMessages = thread ? normMessages(thread.messages) : [];
</script>

<svelte:head>
  <title>Fate City: 1999 — Email</title>
</svelte:head>

<wire-status-bar jail layout="flex"></wire-status-bar>

<h1 class="sr-only">Fate City: 1999 Wire Email</h1>

<header class="mail-header">
  {#if activeId}
    <a class="mail-back" href="{base}/emails" aria-label="Back to all emails">&lsaquo;</a>
    <div class="mail-header-icon">
      <svg viewBox="0 0 24 24"><rect x="3" y="5.5" width="18" height="13" rx="1.5"/><path d="M3.6 6.8l8.4 6.3 8.4-6.3"/></svg>
    </div>
    <div class="mail-header-info">
      <div class="mail-header-title">{thread?.subject ?? 'Loading\u2026'}</div>
      <div class="mail-header-sub">Intercepted &middot; Fate City</div>
    </div>
    <span class="intercept-chip">Decrypted</span>
  {:else}
    <a class="mail-back" href="{base}/home" aria-label="Back to home screen">&lsaquo;</a>
    <span class="mail-live-dot" aria-hidden="true"></span>
    <div class="mail-header-info">
      <div class="mail-header-title">Email</div>
      <div class="mail-header-sub">Intercepted data &middot; Fate City</div>
    </div>
    <span class="intercept-chip" style="margin-left:auto">Secure</span>
    <button class="search-btn" on:click={() => searchOpen = true} aria-label="Search email">
      <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M16.5 16.5l4 4"/></svg>
    </button>
  {/if}
</header>

<div class="mail-feed" bind:this={feedEl}>
  {#if activeId}
    <!-- Thread view -->
    {#if thread === null}
      <p class="mail-empty">Data packet not found<br>or not yet accessible.</p>
    {:else if thread !== undefined && !threadMessages.length}
      <p class="mail-empty">No messages in this thread.</p>
    {:else if thread !== undefined}
      <div class="mail-thread-subject">SUBJECT: {thread.subject ?? ''}</div>
      {#each threadMessages as m, i (i)}
        {#if i > 0}
          <hr class="mail-separator" />
        {/if}
        <div class="mail-block" in:fly={{ y: 10, duration: 400 }}>
          <div class="mail-block-header">
            <span class="mail-from">FROM: {m.from ?? 'Unknown'}</span>
            <span class="mail-ts">{m.ts ? relTime(m.ts) : ''}</span>
          </div>
          <div class="mail-body">{m.body ?? ''}</div>
          {#if m.imageUrl}
            <Attachment url={m.imageUrl} />
          {/if}
        </div>
      {/each}
    {/if}
  {:else}
    <!-- List view -->
    {#if !chains.length}
      <p class="mail-empty">No data packets received.<br>Insert when acquired.</p>
    {:else}
      <PaginatedList items={chains} pageSize={20} let:item>
        {@const c = item}
        <a class="chain-row" href="{base}/emails?id={encodeURIComponent(c._id)}"
          in:fly={{ y: 8, duration: 350 }}>
          <div class="chain-icon">
            <svg viewBox="0 0 24 24"><rect x="3" y="5.5" width="18" height="13" rx="1.5"/><path d="M3.6 6.8l8.4 6.3 8.4-6.3"/></svg>
          </div>
          <div class="chain-content">
            <div class="chain-top">
              <span class="chain-subject" class:unread={c.unread}>{c.subject ?? '(no subject)'}</span>
              <span class="chain-time">{relTime(c.ts)}</span>
            </div>
            <div class="chain-preview" class:unread={c.unread}>{c.preview}</div>
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
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
  }

  /* ── header ────────────────────────────────────────────────────────────────*/
  .mail-header {
    flex-shrink: 0;
    background: #0c0f16;
    border-bottom: 1px solid #1a2030;
    padding: 12px 20px;
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .mail-back {
    font-size: 20px;
    color: #c9a227;
    text-decoration: none;
    opacity: 0.9;
    line-height: 1;
    flex-shrink: 0;
    position: relative;
    padding: 8px;
    margin: -8px;
  }
  .mail-back:hover { opacity: 1; }
  .mail-back::before {
    content: '';
    position: absolute;
    inset: -8px;
  }
  .mail-live-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #c9a227;
    flex-shrink: 0;
    animation: live-pulse 2s ease-in-out infinite;
  }
  @keyframes live-pulse {
    0%, 100% { opacity: 0.35; }
    50%       { opacity: 1; }
  }
  .mail-header-icon {
    width: 28px;
    height: 28px;
    border-radius: 7px;
    background: rgba(201, 162, 39, 0.08);
    border: 1px solid rgba(201, 162, 39, 0.28);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .mail-header-icon svg {
    width: 14px;
    height: 14px;
    stroke: #c9a227;
    fill: none;
    stroke-width: 1.6;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .mail-header-info { flex: 1; min-width: 0; }
  .mail-header-title {
    font-size: 14px;
    font-weight: 600;
    letter-spacing: 0.5px;
    color: #e8dfc8;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .mail-header-sub {
    font-size: 9.5px;
    letter-spacing: 1px;
    text-transform: uppercase;
    color: #3a4a5a;
    margin-top: 2px;
  }
  .intercept-chip {
    font-size: 8px;
    font-weight: 700;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: #4ade80;
    border: 1px solid rgba(74, 222, 128, 0.38);
    background: rgba(74, 222, 128, 0.06);
    padding: 2px 6px;
    border-radius: 2px;
    flex-shrink: 0;
  }

  /* ── feed ──────────────────────────────────────────────────────────────────*/
  .mail-feed {
    flex: 1;
    overflow-y: auto;
    padding: 16px 16px 8px;
    scrollbar-width: thin;
    scrollbar-color: rgba(184, 144, 47, 0.2) transparent;
  }
  .mail-feed::-webkit-scrollbar { width: 3px; }
  .mail-feed::-webkit-scrollbar-thumb {
    background: rgba(184, 144, 47, 0.25);
    border-radius: 2px;
  }

  /* ── list view ─────────────────────────────────────────────────────────────*/
  .chain-row {
    display: flex;
    align-items: center;
    gap: 12px;
    max-width: 480px;
    margin: 0 auto;
    padding: 12px 6px;
    text-decoration: none;
    border-bottom: 1px solid rgba(255, 255, 255, 0.045);
  }
  .chain-row:active { background: rgba(255, 255, 255, 0.03); }
  .chain-icon {
    flex-shrink: 0;
    width: 40px;
    height: 40px;
    border-radius: 10px;
    background: rgba(201, 162, 39, 0.07);
    border: 1px solid rgba(201, 162, 39, 0.22);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .chain-icon svg {
    width: 18px;
    height: 18px;
    stroke: #c9a227;
    fill: none;
    stroke-width: 1.5;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .chain-content { flex: 1; min-width: 0; }
  .chain-top {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-bottom: 3px;
    gap: 8px;
  }
  .chain-subject {
    font-size: 13.5px;
    font-weight: 600;
    color: #e8dfc8;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .chain-subject.unread { color: #f3efe6; }
  .chain-time {
    font-size: 10px;
    color: rgba(232, 223, 200, 0.38);
    flex-shrink: 0;
  }
  .chain-preview {
    font-size: 11.5px;
    color: rgba(232, 223, 200, 0.48);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-family: 'Courier New', Courier, monospace;
  }
  .chain-preview.unread {
    color: rgba(232, 223, 200, 0.82);
    font-weight: 500;
  }
  .chain-unread-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #c9a227;
    flex-shrink: 0;
  }

  /* ── thread view ───────────────────────────────────────────────────────────*/
  .mail-thread-subject {
    max-width: 480px;
    margin: 0 auto 18px;
    padding: 10px 14px;
    background: rgba(201, 162, 39, 0.05);
    border: 1px solid rgba(201, 162, 39, 0.14);
    border-radius: 5px;
    font-size: 11px;
    letter-spacing: 1.2px;
    text-transform: uppercase;
    color: rgba(201, 162, 39, 0.75);
    font-family: 'Courier New', Courier, monospace;
    word-break: break-word;
  }
  .mail-block {
    max-width: 480px;
    margin: 0 auto 4px;
  }
  .mail-block-header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 6px;
  }
  .mail-from {
    font-size: 10.5px;
    font-weight: 700;
    letter-spacing: 1.2px;
    text-transform: uppercase;
    color: #4ade80;
    font-family: 'Courier New', Courier, monospace;
  }
  .mail-ts {
    font-size: 9.5px;
    color: rgba(232, 223, 200, 0.3);
    font-family: 'Courier New', Courier, monospace;
    flex-shrink: 0;
  }
  .mail-body {
    font-size: 13.5px;
    line-height: 1.7;
    color: rgba(232, 223, 200, 0.9);
    font-family: 'Courier New', Courier, monospace;
    white-space: pre-wrap;
    word-break: break-word;
    padding: 4px 0 10px;
  }
  .mail-separator {
    max-width: 480px;
    margin: 6px auto 14px;
    border: none;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
  }

  /* ── search button ──────────────────────────────────────────────────────── */
  .search-btn {
    background: none;
    border: none;
    color: #6a7d90;
    padding: 6px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 6px;
    transition: color 0.15s ease, background 0.15s ease;
    flex-shrink: 0;
  }
  .search-btn:hover { color: #c9a227; background: rgba(201, 162, 39, 0.08); }
  .search-btn svg {
    width: 16px;
    height: 16px;
    stroke: currentColor;
    fill: none;
    stroke-width: 2;
    stroke-linecap: round;
  }

  /* ── empty / footer ──────────────────────────────────────────────────────── */
  .mail-empty {
    max-width: 300px;
    margin: 60px auto;
    text-align: center;
    font-size: 13px;
    font-style: italic;
    line-height: 1.7;
    color: #3a4a5a;
    font-family: 'Courier New', Courier, monospace;
  }
  .mail-footer-note {
    flex-shrink: 0;
    text-align: center;
    font-size: 9px;
    letter-spacing: 1px;
    text-transform: uppercase;
    color: #2e3d4a;
    padding: 6px 0 10px;
  }
</style>
