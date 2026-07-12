<script>
  import { onMount, onDestroy, afterUpdate } from 'svelte';
  import { fly } from 'svelte/transition';
  import { page } from '$app/stores';
  import { base } from '$app/paths';
  import { dbGet } from '$lib/firebase-db.js';
  import { relTime, visibilityAwareInterval } from '$lib/utils.js';
  import Attachment from '$lib/components/Attachment.svelte';
  import PaginatedList from '$lib/components/PaginatedList.svelte';
  import SearchModal from '$lib/components/SearchModal.svelte';
  import { messagesCache } from '$lib/stores/search.js';

  const LAST_SEEN_KEY = 'wire-last-seen-map';

  // Driven by ?sender=Name query param — null means list view
  $: activeSender = $page.url.searchParams.get('sender');

  let messages = [];
  let lastSeenMap = {};
  let feedEl;
  let pollTimer;
  let contactsPollTimer;
  let needsScroll = false;
  let searchOpen = false;

  let contacts = [];
  $: contactsByName = Object.fromEntries(contacts.map(c => [c.name, c]));

  async function loadContacts() {
    try {
      const data = await dbGet('contacts');
      if (!data) { contacts = []; return; }
      contacts = Object.keys(data).map(k => { const c = data[k]; c._id = k; return c; });
    } catch { contacts = []; }
  }

  // ── helpers ──────────────────────────────────────────────────────────────────

  function senderMeta(name) {
    return contactsByName[name] ?? { color: '#b8902f', avatar: null };
  }

  function hexToRgba(hex, a) {
    const h = String(hex).replace('#', '');
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${a})`;
  }

  function initials(name) {
    const clean = String(name ?? '').replace(/^The\s+/i, '').replace(/\./g, '');
    const parts = clean.split(/[\s-]+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }

  function loadLastSeen() {
    try { return JSON.parse(localStorage.getItem(LAST_SEEN_KEY) ?? '{}'); }
    catch { return {}; }
  }

  function markSeen(name, ts) {
    if (!lastSeenMap[name] || ts > lastSeenMap[name]) {
      lastSeenMap = { ...lastSeenMap, [name]: ts };
      localStorage.setItem(LAST_SEEN_KEY, JSON.stringify(lastSeenMap));
    }
  }

  // ── data ─────────────────────────────────────────────────────────────────────

  async function poll() {
    const data = await dbGet('messages', { orderBy: '$key', limitToLast: 100 });
    if (!data) return;
    const fetched = Object.entries(data)
      .map(([id, m]) => ({ ...m, id }))
      .sort((a, b) => a.ts - b.ts);
    const hadNew = fetched.length > messages.length;
    messages = fetched;
    messagesCache.set(fetched);
    if (activeSender && hadNew) needsScroll = true;
  }

  afterUpdate(() => {
    if (needsScroll && feedEl) {
      feedEl.scrollTop = feedEl.scrollHeight;
      needsScroll = false;
    }
  });

  onMount(() => {
    lastSeenMap = loadLastSeen();
    loadContacts();
    poll();
    pollTimer = visibilityAwareInterval(poll, 5000);
    contactsPollTimer = visibilityAwareInterval(loadContacts, 30000);
  });

  onDestroy(() => {
    if (pollTimer) pollTimer();
    if (contactsPollTimer) contactsPollTimer();
  });

  // ── derived views ─────────────────────────────────────────────────────────────

  $: threadMessages = activeSender
    ? messages.filter(m => m.sender === activeSender)
    : [];

  // Mark thread read whenever it updates
  $: if (activeSender && threadMessages.length) {
    const maxTs = Math.max(...threadMessages.map(m => m.ts));
    markSeen(activeSender, maxTs);
  }

  $: conversations = (() => {
    if (activeSender) return [];
    const groups = {};
    for (const m of messages) {
      if (!groups[m.sender]) {
        const meta = senderMeta(m.sender);
        groups[m.sender] = { name: m.sender, color: meta.color, avatar: meta.avatar, lastTs: 0, lastText: '' };
      }
      if (m.ts >= groups[m.sender].lastTs) {
        groups[m.sender].lastTs = m.ts;
        groups[m.sender].lastText = m.imageUrl ? `📷 ${m.text || 'Photo'}` : (m.text || '');
      }
    }
    return Object.values(groups)
      .map(g => ({ ...g, unread: g.lastTs > (lastSeenMap[g.name] ?? 0) }))
      .sort((a, b) => b.lastTs - a.lastTs);
  })();
</script>

<svelte:head>
  <title>Fate City: 1999 — Messages</title>
</svelte:head>

<wire-status-bar jail layout="flex"></wire-status-bar>

<h1 class="sr-only">Fate City: 1999 Wire Messages</h1>

<!-- Per-page header — custom markup, not wire-header web component -->
<header class="msg-header">
  {#if activeSender}
    {@const meta = contactsByName[activeSender] ?? { color: '#b8902f', avatar: null }}
    <a class="msg-back" href="{base}/messages" aria-label="Back to all conversations">&lsaquo;</a>
    <div class="msg-header-avatar"
      style="background:{hexToRgba(meta.color, 0.16)};border-color:{meta.color};color:{meta.color}">
      {initials(activeSender)}
      {#if meta.avatar}
        <img src="{base}/{meta.avatar}" alt="" loading="lazy" class="avatar-img"
          on:error={e => e.currentTarget.style.display = 'none'}>
      {/if}
    </div>
    <div>
      <div class="msg-header-title" style="color:{meta.color}">{activeSender}</div>
      <div class="msg-header-sub">{meta.number || 'Fate City'}</div>
    </div>
  {:else}
    <a class="msg-back" href="{base}/home" aria-label="Back to home screen">&lsaquo;</a>
    <span class="msg-live-dot" aria-hidden="true"></span>
    <div>
      <div class="msg-header-title">Messages</div>
      <div class="msg-header-sub">Fate City</div>
    </div>
  {/if}
</header>

<div class="msg-feed" bind:this={feedEl}>
  {#if activeSender}
    <!-- Thread view -->
    {#if !threadMessages.length}
      <p class="msg-empty">Nothing from {activeSender} yet.</p>
    {:else}
      {#each threadMessages as m (m.id)}
        {@const meta = contactsByName[m.sender] ?? { color: '#b8902f', avatar: null }}
        {@const color = m.color || meta.color}
        <div class="msg-row" in:fly={{ y: 10, duration: 400 }}>
          <div class="msg-avatar"
            style="background:{hexToRgba(color, 0.16)};border-color:{color};color:{color}">
            {initials(m.sender)}
            {#if meta.avatar}
              <img src="{base}/{meta.avatar}" alt="" loading="lazy" class="avatar-img"
                on:error={e => e.currentTarget.style.display = 'none'}>
            {/if}
          </div>
          <div class="msg-content">
            <div class="msg-top">
              <span class="msg-name" style="color:{color}">{m.sender}</span>
              <span class="msg-time">{relTime(m.ts)}</span>
            </div>
            <div class="msg-bubble" class:has-image={m.imageUrl} style="border-left-color:{color}">
              {#if m.imageUrl}
                <img class="msg-image" src={m.imageUrl} alt="" loading="lazy"
                  on:error={e => e.currentTarget.style.display = 'none'}>
              {/if}
              {#if m.text}
                <div class="msg-bubble-text">{m.text}</div>
              {/if}
              {#if m.attachmentUrl}
                <Attachment url={m.attachmentUrl} />
              {/if}
            </div>
          </div>
        </div>
      {/each}
    {/if}
  {:else}
    <!-- Conversation list view -->
    {#if !conversations.length}
      <p class="msg-empty">Nothing yet. The city is usually loud — enjoy the quiet while it lasts.</p>
    {:else}
      <PaginatedList items={conversations} pageSize={20} let:item>
        {@const g = item}
        <a class="conv-row" href="{base}/messages?sender={encodeURIComponent(g.name)}"
          in:fly={{ y: 8, duration: 350 }}>
          <div class="conv-avatar"
            style="background:{hexToRgba(g.color, 0.16)};border-color:{g.color};color:{g.color}">
            {initials(g.name)}
            {#if g.avatar}
              <img src="{base}/{g.avatar}" alt="" loading="lazy" class="avatar-img"
                on:error={e => e.currentTarget.style.display = 'none'}>
            {/if}
          </div>
          <div class="conv-content">
            <div class="conv-top">
              <span class="conv-name" class:unread={g.unread}
                style={g.unread ? '' : `color:${g.color}`}>{g.name}</span>
              <span class="conv-time">{relTime(g.lastTs)}</span>
            </div>
            <div class="conv-preview" class:unread={g.unread}>{g.lastText}</div>
          </div>
          {#if g.unread}
            <span class="conv-unread-dot" aria-hidden="true"></span>
          {/if}
        </a>
      </PaginatedList>
    {/if}
  {/if}
</div>

<div class="msg-footer-note">Read only &middot; updates live</div>

<SearchModal open={searchOpen} on:close={() => searchOpen = false} />

<style>
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
  }

  /* ── header ──────────────────────────────────────────────────────────────── */
  .msg-header {
    flex-shrink: 0;
    background: #0c0f16;
    border-bottom: 1px solid #1a2030;
    padding: 12px 20px;
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .msg-back {
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
  .msg-back:hover { opacity: 1; }
  /* Expand tap target */
  .msg-back::before {
    content: '';
    position: absolute;
    inset: -8px;
  }
  .msg-live-dot {
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
  .msg-header-avatar {
    width: 26px;
    height: 26px;
    border-radius: 50%;
    border: 1px solid;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10.5px;
    font-weight: 700;
    flex-shrink: 0;
    position: relative;
    overflow: hidden;
  }
  .msg-header-title {
    font-size: 14px;
    font-weight: 600;
    letter-spacing: 0.5px;
    color: #e8dfc8;
  }
  .msg-header-sub {
    font-size: 9.5px;
    letter-spacing: 1px;
    text-transform: uppercase;
    color: #3a4a5a;
    margin-top: 2px;
  }

  /* ── feed ────────────────────────────────────────────────────────────────── */
  .msg-feed {
    flex: 1;
    overflow-y: auto;
    padding: 16px 16px 8px;
    scrollbar-width: thin;
    scrollbar-color: rgba(184, 144, 47, 0.2) transparent;
  }
  .msg-feed::-webkit-scrollbar { width: 3px; }
  .msg-feed::-webkit-scrollbar-thumb {
    background: rgba(184, 144, 47, 0.25);
    border-radius: 2px;
  }

  /* ── thread messages ─────────────────────────────────────────────────────── */
  .msg-row {
    display: flex;
    gap: 10px;
    max-width: 480px;
    margin: 0 auto 16px;
  }
  .msg-avatar {
    flex-shrink: 0;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    border: 1px solid;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11.5px;
    font-weight: 700;
    position: relative;
    overflow: hidden;
  }
  .avatar-img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: 50% 20%;
    border-radius: 50%;
  }
  .msg-content { flex: 1; min-width: 0; }
  .msg-top {
    display: flex;
    align-items: baseline;
    gap: 8px;
    margin-bottom: 4px;
  }
  .msg-name { font-size: 12.5px; font-weight: 600; }
  .msg-time { font-size: 9.5px; color: rgba(232, 223, 200, 0.4); }
  .msg-bubble {
    background: rgba(255, 255, 255, 0.04);
    border-left: 3px solid;
    border-radius: 4px 10px 10px 4px;
    padding: 9px 12px;
    font-size: 13.5px;
    line-height: 1.5;
    color: rgba(232, 223, 200, 0.92);
    word-wrap: break-word;
    white-space: pre-line;
  }
  .msg-bubble.has-image { padding: 6px; }
  .msg-image {
    display: block;
    width: 100%;
    max-width: 280px;
    border-radius: 8px;
  }
  .msg-bubble-text { padding: 7px 6px 2px; }
  .msg-bubble-text:first-child { padding-top: 0; }

  /* ── conversation list ───────────────────────────────────────────────────── */
  .conv-row {
    display: flex;
    align-items: center;
    gap: 12px;
    max-width: 480px;
    margin: 0 auto;
    padding: 12px 6px;
    text-decoration: none;
    border-bottom: 1px solid rgba(255, 255, 255, 0.045);
  }
  .conv-row:active { background: rgba(255, 255, 255, 0.03); }
  .conv-avatar {
    flex-shrink: 0;
    width: 38px;
    height: 38px;
    border-radius: 50%;
    border: 1px solid;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 13px;
    font-weight: 700;
    position: relative;
    overflow: hidden;
  }
  .conv-content { flex: 1; min-width: 0; }
  .conv-top {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-bottom: 3px;
    gap: 8px;
  }
  .conv-name {
    font-size: 13.5px;
    font-weight: 600;
    color: #e8dfc8;
  }
  .conv-name.unread { color: #f3efe6; }
  .conv-time {
    font-size: 10px;
    color: rgba(232, 223, 200, 0.4);
    flex-shrink: 0;
  }
  .conv-preview {
    font-size: 12px;
    color: rgba(232, 223, 200, 0.55);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .conv-preview.unread {
    color: rgba(232, 223, 200, 0.92);
    font-weight: 600;
  }
  .conv-unread-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #c9a227;
    flex-shrink: 0;
  }

  /* ── empty / footer ──────────────────────────────────────────────────────── */
  .msg-empty {
    max-width: 320px;
    margin: 60px auto;
    text-align: center;
    font-size: 13px;
    font-style: italic;
    line-height: 1.6;
    color: #3a4a5a;
  }
  /* ── search button ──────────────────────────────────────────────────────── */
  .search-btn {
    margin-left: auto;
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

  .msg-footer-note {
    flex-shrink: 0;
    text-align: center;
    font-size: 9px;
    letter-spacing: 1px;
    text-transform: uppercase;
    color: #2e3d4a;
    padding: 6px 0 10px;
  }
</style>
