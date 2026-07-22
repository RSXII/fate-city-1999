<script>
  import { onMount, onDestroy, afterUpdate } from 'svelte';
  import { fly } from 'svelte/transition';
  import { page } from '$app/stores';
  import { base } from '$app/paths';
  import { dbGet, dbPost } from '$lib/firebase-db.js';
  import { relTime, visibilityAwareInterval, getCodename } from '$lib/utils.js';
  import Attachment from '$lib/components/Attachment.svelte';
  import PaginatedList from '$lib/components/PaginatedList.svelte';
  import SearchModal from '$lib/components/SearchModal.svelte';
  import { messagesCache } from '$lib/stores/search.js';

  const LAST_SEEN_KEY = 'wire-last-seen-map';

  // Driven by ?sender=Name or ?thread=groupId — null on both means list view
  $: activeSender = $page.url.searchParams.get('sender');
  $: activeThread = $page.url.searchParams.get('thread'); // groupId

  let myCodename = null;
  let messages = [];
  let lastSeenMap = {};
  let feedEl;
  let pollTimer;
  let contactsPollTimer;
  let needsScroll = false;
  let searchOpen = false;

  let isFirstPoll = true;

  let allResponses = []; // all player responses — always fetched, derived per-thread
  let responseText = '';
  let sendingResponse = false;
  let playerProfiles = {}; // codename → { imageUrl }

  // Derive the active thread's responses reactively — no stale-clear needed
  $: responses = activeThread
    ? allResponses.filter(r => r.groupId === activeThread)
    : activeSender
    ? allResponses.filter(r => r.context === activeSender && !r.groupId)
    : [];

  function playTextChime() {
    try {
      const audio = new Audio(`${base}/sounds/message_sound.mp3`);
      audio.play();
    } catch { /* audio blocked or unavailable */ }
  }

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

  async function loadPlayerProfiles() {
    try {
      const data = await dbGet('player-profiles');
      if (data) playerProfiles = data;
    } catch {}
  }

  async function pollResponses() {
    if (!myCodename) return;
    try {
      const data = await dbGet('player-responses', { orderBy: '$key', limitToLast: 200 });
      if (!data) { allResponses = []; return; }
      allResponses = Object.entries(data)
        .map(([id, r]) => ({ ...r, id, _isResponse: true }))
        .sort((a, b) => a.ts - b.ts);
    } catch { allResponses = []; }
  }

  async function sendResponse() {
    const text = responseText.trim();
    if (!text || sendingResponse || !myCodename) return;
    sendingResponse = true;
    try {
      const payload = { codename: myCodename, text, ts: Date.now() };
      if (activeThread) {
        payload.groupId = activeThread;
        payload.groupName = activeGroupName;
      } else if (activeSender) {
        payload.context = activeSender;
      }
      await dbPost('player-responses', payload);
      responseText = '';
      await pollResponses();
      needsScroll = true;
    } catch { /* swallow; retry on next poll */ }
    sendingResponse = false;
  }

  async function poll() {
    const data = await dbGet('messages', { orderBy: '$key', limitToLast: 100 });
    if (!data) return;
    const fetched = Object.entries(data)
      .map(([id, m]) => ({ ...m, id }))
      .filter(m => m.staged !== false)
      .filter(m => !m.recipients || m.recipients.includes(myCodename))
      .sort((a, b) => a.ts - b.ts);
    const hadNew = fetched.length > messages.length;
    messages = fetched;
    messagesCache.set(fetched);
    if (hadNew && !isFirstPoll) playTextChime();
    if ((activeSender || activeThread) && hadNew) needsScroll = true;
    isFirstPoll = false;
    await pollResponses();
  }

  afterUpdate(() => {
    if (needsScroll && feedEl) {
      feedEl.scrollTop = feedEl.scrollHeight;
      needsScroll = false;
    }
  });

  onMount(() => {
    myCodename = getCodename();
    lastSeenMap = loadLastSeen();
    loadContacts();
    poll();
    pollResponses(); // parallel with poll so responses appear immediately
    loadPlayerProfiles();
    pollTimer = visibilityAwareInterval(poll, 5000);
    contactsPollTimer = visibilityAwareInterval(loadContacts, 30000);
  });

  onDestroy(() => {
    if (pollTimer) pollTimer();
    if (contactsPollTimer) contactsPollTimer();
  });

  // ── derived views ─────────────────────────────────────────────────────────────

  $: threadMessages = activeThread
    ? messages.filter(m => m.groupId === activeThread)
    : activeSender
      ? messages.filter(m => m.sender === activeSender && !m.groupId)
      : [];

  $: isGroupThread = new Set(threadMessages.map(m => m.sender)).size > 1;

  $: mergedThread = [
      ...threadMessages.map(m => ({ ...m, _isResponse: false })),
      ...responses,
    ].sort((a, b) => a.ts - b.ts);

  // Derive group display info from embedded message fields — no extra Firebase fetch
  $: activeGroupName = activeThread
    ? (threadMessages.find(m => m.groupName)?.groupName ?? 'Group Chat')
    : null;
  $: activeGroupMembers = activeThread
    ? [...new Set(threadMessages.map(m => m.sender))]
    : [];

  // Mark thread read; use prefixed key for groups to avoid collisions with sender names
  $: if ((activeSender || activeThread) && threadMessages.length) {
    const seenKey = activeThread ? `group:${activeThread}` : activeSender;
    const maxTs = Math.max(...threadMessages.map(m => m.ts));
    markSeen(seenKey, maxTs);
  }

  $: conversations = (() => {
    if (activeSender || activeThread) return [];
    const convMap = {};
    for (const m of messages) {
      const key = m.groupId ? `group:${m.groupId}` : `sender:${m.sender}`;
      if (!convMap[key]) {
        if (m.groupId) {
          convMap[key] = {
            key, groupId: m.groupId,
            name: m.groupName || 'Group Chat',
            isGroup: true, color: '#5b9e8f', avatar: null,
            lastTs: 0, lastText: '', lastSender: '', lastNpcTs: 0
          };
        } else {
          const meta = senderMeta(m.sender);
          convMap[key] = {
            key, name: m.sender,
            isGroup: false, color: meta.color, avatar: meta.avatar,
            lastTs: 0, lastText: '', lastNpcTs: 0
          };
        }
      }
      if (m.ts >= convMap[key].lastTs) {
        convMap[key].lastTs = m.ts;
        convMap[key].lastNpcTs = m.ts;
        convMap[key].lastText = m.imageUrl ? `📷 ${m.text || 'Photo'}` : (m.text || '');
        if (m.groupId) convMap[key].lastSender = m.sender;
      }
    }
    // Fold in player responses — update last message and sort order if more recent
    for (const r of allResponses) {
      const convKey = r.groupId ? `group:${r.groupId}` : r.context ? `sender:${r.context}` : null;
      if (convKey && convMap[convKey] && r.ts > convMap[convKey].lastTs) {
        convMap[convKey].lastTs = r.ts;
        if (convMap[convKey].isGroup) {
          // Group threads already show lastSender as a prefix in the template
          convMap[convKey].lastSender = r.codename;
          convMap[convKey].lastText = r.text;
        } else {
          // 1:1 threads have no lastSender prefix — include codename in the text
          convMap[convKey].lastText = `${r.codename}: ${r.text}`;
        }
      }
    }
    return Object.values(convMap)
      .map(g => ({ ...g, unread: g.lastNpcTs > (lastSeenMap[g.key] ?? 0) }))
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
  {#if activeThread}
    <!-- Group thread header -->
    <a class="msg-back" href="{base}/messages" aria-label="Back to all conversations">&lsaquo;</a>
    <div class="msg-header-group-avatars">
      {#each activeGroupMembers.slice(0, 2) as name, i}
        {@const meta = contactsByName[name] ?? { color: '#5b9e8f' }}
        {@const color = meta.color}
        <div class="msg-header-group-avatar" style="background:{hexToRgba(color, 0.18)};border-color:{color};color:{color};z-index:{2-i}">
          {initials(name)}
        </div>
      {/each}
    </div>
    <div>
      <div class="msg-header-title" style="color:#5b9e8f">{activeGroupName}</div>
      <div class="msg-header-sub">{activeGroupMembers.join(' · ')}</div>
    </div>
  {:else if activeSender}
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
  {#if activeSender || activeThread}
    <!-- Thread view -->
    {#if !mergedThread.length}
      <p class="msg-empty">Nothing here yet.</p>
    {:else}
      {#each mergedThread as item, i (item.id)}
        {#if item._isResponse}
          <!-- Player response: right-aligned with avatar -->
          {@const profImg = playerProfiles[item.codename]?.imageUrl}
          <div class="msg-row-mine" in:fly={{ y: 10, duration: 400 }}>
            <div class="msg-mine-content">
              {#if isGroupThread || item.codename !== myCodename}
                <div class="msg-mine-label">{item.codename}</div>
              {/if}
              <div class="msg-bubble-mine">
                <div class="msg-bubble-text">{item.text}</div>
              </div>
              <span class="msg-mine-time">{relTime(item.ts)}</span>
              {#if item.status === 'seen'}
                <span class="msg-mine-status msg-mine-status--seen">Seen</span>
              {:else if item.status === 'not_delivered'}
                <span class="msg-mine-status msg-mine-status--failed">Not delivered</span>
              {/if}
            </div>
            <div class="msg-mine-avatar">
              {#if profImg}
                <img src={profImg} alt={item.codename} class="msg-mine-avatar-img" />
              {:else}
                {(item.codename || '?')[0].toUpperCase()}
              {/if}
            </div>
          </div>
        {:else}
          {@const meta = contactsByName[item.sender] ?? { color: '#b8902f', avatar: null }}
          {@const color = item.color || meta.color}
          {@const isFirstInRun = i === 0 || mergedThread[i - 1]._isResponse || mergedThread[i - 1].sender !== item.sender}
          {@const isLastInRun = i === mergedThread.length - 1 || mergedThread[i + 1]._isResponse || mergedThread[i + 1].sender !== item.sender}

          {#if isGroupThread}
            <!-- Group thread: avatar + name only on first message of each sender run -->
            <div class="msg-row" class:msg-row-continued={!isFirstInRun} in:fly={{ y: 10, duration: 400 }}>
              <div class="msg-avatar-col">
                {#if isFirstInRun}
                  <div class="msg-avatar"
                    style="background:{hexToRgba(color, 0.16)};border-color:{color};color:{color}">
                    {initials(item.sender)}
                    {#if meta.avatar}
                      <img src="{base}/{meta.avatar}" alt="" loading="lazy" class="avatar-img"
                        on:error={e => e.currentTarget.style.display = 'none'}>
                    {/if}
                  </div>
                {:else}
                  <div class="msg-avatar-spacer"></div>
                {/if}
              </div>
              <div class="msg-content">
                {#if isFirstInRun}
                  <div class="msg-sender-name" style="color:{color}">{item.sender}</div>
                {/if}
                {#if isFirstInRun && item.recipients && myCodename}
                  <div class="msg-to">To: {myCodename}</div>
                {/if}
                <div class="msg-bubble" class:has-image={item.imageUrl} style="border-left-color:{color}">
                  {#if item.imageUrl}
                    <img class="msg-image" src={item.imageUrl} alt="" loading="lazy"
                      on:error={e => e.currentTarget.style.display = 'none'}>
                  {/if}
                  {#if item.text}
                    <div class="msg-bubble-text">{item.text}</div>
                  {/if}
                  {#if item.attachmentUrl}
                    <Attachment url={item.attachmentUrl} />
                  {/if}
                </div>
                {#if isLastInRun}
                  <span class="msg-time msg-time-group">{relTime(item.ts)}</span>
                {/if}
              </div>
            </div>
          {:else}
            <!-- Single sender thread: just the bubble, no repeated avatar/name -->
            <div class="msg-row-simple" class:msg-row-simple-continued={!isFirstInRun} in:fly={{ y: 10, duration: 400 }}>
              {#if isFirstInRun && item.recipients && myCodename}
                <div class="msg-to">To: {myCodename}</div>
              {/if}
              <div class="msg-bubble-wrap">
                <div class="msg-bubble" class:has-image={item.imageUrl} style="border-left-color:{color}">
                  {#if item.imageUrl}
                    <img class="msg-image" src={item.imageUrl} alt="" loading="lazy"
                      on:error={e => e.currentTarget.style.display = 'none'}>
                  {/if}
                  {#if item.text}
                    <div class="msg-bubble-text">{item.text}</div>
                  {/if}
                  {#if item.attachmentUrl}
                    <Attachment url={item.attachmentUrl} />
                  {/if}
                </div>
                <span class="msg-time">{relTime(item.ts)}</span>
              </div>
            </div>
          {/if}
        {/if}
      {/each}
    {/if}
  {:else}
    <!-- Conversation list view -->
    {#if !conversations.length}
      <p class="msg-empty">Nothing yet. The city is usually loud — enjoy the quiet while it lasts.</p>
    {:else}
      <PaginatedList items={conversations} pageSize={20} let:item>
        {@const g = item}
        <a class="conv-row"
          href={g.isGroup
            ? `${base}/messages?thread=${encodeURIComponent(g.groupId)}`
            : `${base}/messages?sender=${encodeURIComponent(g.name)}`}
          in:fly={{ y: 8, duration: 350 }}>
          {#if g.isGroup}
            <div class="conv-avatar conv-avatar--group"
              style="background:{hexToRgba(g.color, 0.16)};border-color:{g.color};color:{g.color}">
              &#x2234;
            </div>
          {:else}
            <div class="conv-avatar"
              style="background:{hexToRgba(g.color, 0.16)};border-color:{g.color};color:{g.color}">
              {initials(g.name)}
              {#if g.avatar}
                <img src="{base}/{g.avatar}" alt="" loading="lazy" class="avatar-img"
                  on:error={e => e.currentTarget.style.display = 'none'}>
              {/if}
            </div>
          {/if}
          <div class="conv-content">
            <div class="conv-top">
              <span class="conv-name" class:unread={g.unread}
                style={g.unread ? '' : `color:${g.color}`}>{g.name}</span>
              <span class="conv-time">{relTime(g.lastTs)}</span>
            </div>
            <div class="conv-preview" class:unread={g.unread}>
              {#if g.isGroup && g.lastSender}{g.lastSender}: {/if}{g.lastText}
            </div>
          </div>
          {#if g.unread}
            <span class="conv-unread-dot" aria-hidden="true"></span>
          {/if}
        </a>
      </PaginatedList>
    {/if}
  {/if}
</div>

{#if activeSender || activeThread}
  {#if myCodename}
    <div class="msg-compose">
      <textarea
        class="msg-compose-input"
        bind:value={responseText}
        placeholder="Reply…"
        rows="2"
        on:keydown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); sendResponse(); } }}
      ></textarea>
      <button class="msg-compose-send" disabled={!responseText.trim() || sendingResponse}
        on:click={sendResponse}>
        {sendingResponse ? '…' : 'Send'}
      </button>
    </div>
  {:else}
    <div class="msg-footer-note">Set your codename to reply.</div>
  {/if}
{:else}
  <div class="msg-footer-note">Read only &middot; updates live</div>
{/if}

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
  .msg-header-group-avatars {
    display: flex;
    flex-shrink: 0;
  }
  .msg-header-group-avatar {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    border: 1px solid;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 8.5px;
    font-weight: 700;
    position: relative;
    overflow: hidden;
  }
  .msg-header-group-avatar:not(:first-child) { margin-left: -6px; }
  .conv-avatar--group { font-size: 15px; letter-spacing: 0; }
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

  /* Single-sender layout: no avatar, just bubble + time */
  .msg-row-simple {
    max-width: 480px;
    margin: 0 auto 10px;
  }
  .msg-row-simple.msg-row-simple-continued { margin-bottom: 4px; }

  .msg-bubble-wrap {
    display: flex;
    align-items: flex-end;
    gap: 8px;
  }
  .msg-bubble-wrap .msg-bubble { flex: 1; min-width: 0; }
  .msg-bubble-wrap .msg-time {
    flex-shrink: 0;
    align-self: flex-end;
    padding-bottom: 2px;
  }

  /* Group-sender layout: avatar col + content */
  .msg-row {
    display: flex;
    gap: 8px;
    max-width: 480px;
    margin: 0 auto 10px;
  }
  .msg-row.msg-row-continued { margin-bottom: 4px; }

  .msg-avatar-col { flex-shrink: 0; width: 28px; }
  .msg-avatar-spacer { width: 28px; height: 1px; }

  .msg-avatar {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    border: 1px solid;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    font-weight: 700;
    position: relative;
    overflow: hidden;
  }
  .msg-sender-name {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.3px;
    margin-bottom: 3px;
  }
  .msg-time-group {
    display: block;
    margin-top: 3px;
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

  .msg-time { font-size: 9.5px; color: rgba(232, 223, 200, 0.4); }
  .msg-to {
    font-size: 9.5px;
    letter-spacing: 0.4px;
    color: rgba(201, 162, 39, 0.45);
    margin-bottom: 5px;
  }
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

  /* ── player response bubbles (right-aligned) ──────────────────────────── */
  .msg-row-mine {
    max-width: 480px;
    margin: 0 auto 10px;
    display: flex;
    flex-direction: row;
    align-items: flex-end;
    justify-content: flex-end;
    gap: 8px;
  }
  .msg-mine-content {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
  }
  .msg-mine-avatar {
    flex-shrink: 0;
    width: 26px;
    height: 26px;
    border-radius: 50%;
    background: rgba(106, 176, 212, 0.1);
    border: 1.5px solid rgba(106, 176, 212, 0.28);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    font-weight: 700;
    color: rgba(106, 176, 212, 0.6);
    overflow: hidden;
    margin-bottom: 2px;
  }
  .msg-mine-avatar-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: 50%;
    display: block;
  }
  .msg-mine-label {
    font-size: 10px;
    color: rgba(106, 176, 212, 0.6);
    margin-bottom: 3px;
    letter-spacing: 0.3px;
  }
  .msg-bubble-mine {
    background: rgba(106, 176, 212, 0.09);
    border-right: 3px solid #6ab0d4;
    border-radius: 10px 4px 4px 10px;
    padding: 9px 12px;
    font-size: 13.5px;
    line-height: 1.5;
    color: rgba(232, 223, 200, 0.92);
    word-wrap: break-word;
    white-space: pre-line;
    max-width: 85%;
  }
  .msg-mine-time {
    font-size: 9.5px;
    color: rgba(232, 223, 200, 0.4);
    margin-top: 3px;
  }
  .msg-mine-status {
    font-size: 9px;
    letter-spacing: 0.5px;
    margin-top: 2px;
  }
  .msg-mine-status--seen { color: rgba(91, 158, 143, 0.75); }
  .msg-mine-status--failed { color: rgba(192, 80, 74, 0.8); }

  /* ── compose area ──────────────────────────────────────────────────────── */
  .msg-compose {
    flex-shrink: 0;
    display: flex;
    gap: 8px;
    align-items: flex-end;
    padding: 10px 14px 12px;
    border-top: 1px solid #1a2030;
    background: #0c0f16;
  }
  .msg-compose-input {
    flex: 1;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid #1e2d40;
    border-radius: 8px;
    color: #e8dfc8;
    font-size: 13.5px;
    padding: 9px 12px;
    resize: none;
    line-height: 1.45;
    font-family: inherit;
    min-height: 40px;
    max-height: 120px;
    overflow-y: auto;
    scrollbar-width: none;
  }
  .msg-compose-input:focus {
    outline: none;
    border-color: #6ab0d4;
  }
  .msg-compose-input::placeholder { color: #3a4a5a; }
  .msg-compose-send {
    background: #6ab0d4;
    color: #0c0f16;
    border: none;
    border-radius: 8px;
    padding: 9px 16px;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    flex-shrink: 0;
    transition: opacity 0.15s;
    align-self: flex-end;
  }
  .msg-compose-send:disabled { opacity: 0.35; cursor: default; }
  .msg-compose-send:not(:disabled):hover { opacity: 0.85; }

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
