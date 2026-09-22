<script>
  import { onMount, onDestroy, afterUpdate } from 'svelte';
  import { fly } from 'svelte/transition';
  import { page } from '$app/stores';
  import { base } from '$app/paths';
  import { dbGet } from '$lib/firebase-db.js';
  import { relTime, visibilityAwareInterval } from '$lib/utils.js';
  import {
    subscribeConversations,
    subscribeMessages,
    defaultConversationName,
    sendAsNpc,
  } from '$lib/firestore-db.js';
  import Attachment from '$lib/components/Attachment.svelte';
  import PaginatedList from '$lib/components/PaginatedList.svelte';

  // Whose device this is — the identity that drives every filter below.
  // Lives entirely in the URL as a query param, not a dynamic route segment
  // (see docs/npc-device-hack-audit.md): deliberately no storage of any
  // kind, so opening a second device is just navigating to a different
  // /hacked login, never blocked by stale saved state. A [param] route
  // folder also can't be prerendered by adapter-static without knowing
  // concrete NPC keys at build time, which this app has no way to do.
  $: npcKey = $page.url.searchParams.get('npc') ?? '';

  // URL param — null means conversation list view. The value is the literal
  // Firestore conversation doc id (see conversationKey in firestore-db.js).
  $: activeThread = $page.url.searchParams.get('thread');

  $: backHref = `${base}/hacked/messages?npc=${encodeURIComponent(npcKey)}`;

  let feedEl;
  let contactsPollTimer;
  let needsScroll = false;

  let responseText = '';
  let sendingResponse = false;

  // ── Firestore state ───────────────────────────────────────────────────────
  let fsConvsRaw = [];
  let fsMessages = [];
  let unsubConversations = null;
  let unsubMessages = null;
  let isFirstSnapshot = true;

  // ── contacts ──────────────────────────────────────────────────────────────
  let contacts = [];
  $: contactsByName = Object.fromEntries(contacts.map(c => [c.name, c]));
  $: myMeta = contactsByName[npcKey] ?? { color: '#c0504a', avatar: null };

  async function loadContacts() {
    try {
      const data = await dbGet('contacts');
      if (!data) { contacts = []; return; }
      contacts = Object.keys(data).map(k => { const c = data[k]; c._id = k; return c; });
    } catch { contacts = []; }
  }

  // ── helpers ───────────────────────────────────────────────────────────────
  function linkify(text) {
    if (!text) return '';
    const escaped = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
    return escaped.replace(
      /https?:\/\/[^\s<>"]+/g,
      url => `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`
    );
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
    if (parts.length === 0) return '';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }

  function playTextChime() {
    try {
      const audio = new Audio(`${base}/sounds/message_sound.mp3`);
      audio.play();
    } catch { /* audio blocked or unavailable */ }
  }

  // ── send as the compromised NPC ──────────────────────────────────────────
  async function sendResponse() {
    const text = responseText.trim();
    if (!text || sendingResponse || !npcKey || !canReply) return;
    sendingResponse = true;
    try {
      const payload = { sender: npcKey, color: myMeta.color, text, ts: Date.now() };
      await sendAsNpc(convId, payload);
      responseText = '';
      needsScroll = true;
    } catch { /* swallow; will appear on next Firestore push */ }
    sendingResponse = false;
  }

  afterUpdate(() => {
    if (needsScroll && feedEl) {
      needsScroll = false;
      requestAnimationFrame(() => {
        if (feedEl) feedEl.scrollTop = feedEl.scrollHeight;
      });
    }
  });

  // ── Firestore: thread subscription ───────────────────────────────────────
  // The URL param IS the Firestore conversation doc id — no reconstruction needed.
  $: convId = activeThread ?? null;

  let _lastConvId = null;
  $: if (convId !== _lastConvId) {
    _lastConvId = convId;
    if (unsubMessages) { unsubMessages(); unsubMessages = null; }
    fsMessages = [];
    if (convId) {
      isFirstSnapshot = true;
      unsubMessages = subscribeMessages(convId, msgs => {
        // A device's own inbox shows everything staged live on it — no
        // per-viewer recipient filtering, that mechanic is specific to the
        // normal player app (see docs/npc-device-hack-audit.md, decision 3:
        // `staged` keeps its existing meaning and isn't bypassed).
        const visible = msgs.filter(m => m.staged !== false);
        const hadNew = visible.length > fsMessages.length;
        if (hadNew && !isFirstSnapshot) playTextChime();
        fsMessages = visible;
        if (hadNew) needsScroll = true;
        isFirstSnapshot = false;
      });
    }
  }

  let _lastNpcKey = null;
  $: if (npcKey !== _lastNpcKey) {
    _lastNpcKey = npcKey;
    if (unsubConversations) { unsubConversations(); unsubConversations = null; }
    fsConvsRaw = [];
    if (npcKey) {
      unsubConversations = subscribeConversations(rawConvs => {
        fsConvsRaw = rawConvs.filter(c => (c.npcMembers ?? []).includes(npcKey));
      });
    }
  }

  onMount(() => {
    loadContacts();
    contactsPollTimer = visibilityAwareInterval(loadContacts, 30000);
  });

  onDestroy(() => {
    if (unsubConversations) unsubConversations();
    if (unsubMessages) unsubMessages();
    if (contactsPollTimer) contactsPollTimer();
  });

  // ── derived views ─────────────────────────────────────────────────────────
  // The solo (1:1-with-another-NPC) case names the conversation after the
  // OTHER party, from this device's point of view — not the full participant
  // set, since seeing your own name in the label of your own inbox is noise.
  // The multi-NPC case falls back to the same computed default used
  // everywhere else in the app (the full roster), for consistency.
  $: fsConversations = fsConvsRaw.map(c => {
    const isGroup = (c.npcMembers?.length ?? 0) > 1;
    const otherName = isGroup ? null : ((c.npcMembers ?? []).find(n => n !== npcKey) ?? c.npcMembers?.[0] ?? '');
    const meta = isGroup ? { color: '#5b9e8f', avatar: null } : (contactsByName[otherName] ?? { color: '#b8902f', avatar: null });
    return {
      key:        c.id,
      isGroup,
      name:       c.name ?? (isGroup ? defaultConversationName(c) : otherName),
      color:      meta.color,
      avatar:     meta.avatar ?? null,
      lastTs:     c.lastMessageAt   ?? 0,
      lastText:   c.lastMessageText  ?? '',
      lastSender: c.lastMessageSender ?? '',
    };
  });

  // Replying is only safe inside a conversation that's actually hidden
  // (npcOnly). A conversation the real party can already see has sticky
  // isBroadcast/playerMembers set from earlier messages — the player-app's
  // own read filter doesn't check a per-message npcOnly flag, so a reply
  // sent here would otherwise go live to real players immediately, with no
  // staging step and no way for the hacking player to know it happened.
  $: activeConv = fsConvsRaw.find(c => c.id === convId) ?? null;
  $: canReply = !!activeConv?.npcOnly;

  $: threadMessages = fsMessages.filter(m => m.type === 'npc');
  $: activeNpcMembers = activeConv?.npcMembers ?? [];
  $: isGroupThread = activeNpcMembers.length > 1;
  $: activeOtherName = isGroupThread ? '' : (activeNpcMembers.find(n => n !== npcKey) ?? activeNpcMembers[0] ?? '');

  $: mergedThread = fsMessages.map(m => ({
    ...m,
    _isMine: m.sender === npcKey,
  }));

  $: activeName = activeConv
    ? (activeConv.name ?? (isGroupThread ? defaultConversationName(activeConv) : activeOtherName))
    : null;

  $: conversations = activeThread
    ? []
    : [...fsConversations].sort((a, b) => b.lastTs - a.lastTs);
</script>

<svelte:head>
  <title>Fate City: 1999 — Hacked Wire</title>
</svelte:head>

<div class="hacked-banner">
  <span class="hacked-banner-dot" aria-hidden="true"></span>
  VIEWING <strong style="color:{myMeta.color}">{npcKey}</strong>'S DEVICE
</div>

<h1 class="sr-only">Hacked Wire device — {npcKey}</h1>

<header class="msg-header">
  {#if activeThread && isGroupThread}
    <a class="msg-back" href={backHref} aria-label="Back to all conversations">&lsaquo;</a>
    <div class="msg-header-group-avatars">
      {#each activeNpcMembers.slice(0, 2) as name, i}
        {@const meta = contactsByName[name] ?? { color: '#5b9e8f' }}
        {@const color = meta.color}
        <div class="msg-header-group-avatar" style="background:{hexToRgba(color, 0.18)};border-color:{color};color:{color};z-index:{2-i}">
          {initials(name)}
        </div>
      {/each}
    </div>
    <div>
      <div class="msg-header-title" style="color:#5b9e8f">{activeName}</div>
      <div class="msg-header-sub">{activeNpcMembers.join(' · ')}</div>
    </div>
  {:else if activeThread}
    {@const meta = contactsByName[activeOtherName] ?? { color: '#b8902f', avatar: null }}
    <a class="msg-back" href={backHref} aria-label="Back to all conversations">&lsaquo;</a>
    <div class="msg-header-avatar"
      style="background:{hexToRgba(meta.color, 0.16)};border-color:{meta.color};color:{meta.color}">
      {initials(activeOtherName)}
      {#if meta.avatar}
        <img src="{base}/{meta.avatar}" alt="" loading="lazy" class="avatar-img"
          on:error={e => e.currentTarget.style.display = 'none'}>
      {/if}
    </div>
    <div>
      <div class="msg-header-title" style="color:{meta.color}">{activeName}</div>
      <div class="msg-header-sub">{meta.number || 'Fate City'}</div>
    </div>
  {:else}
    <a class="msg-back" href="{base}/hacked/home?npc={encodeURIComponent(npcKey)}" aria-label="Back to device home screen">&lsaquo;</a>
    <span class="msg-live-dot" aria-hidden="true"></span>
    <div>
      <div class="msg-header-title">Wire</div>
      <div class="msg-header-sub">{npcKey}</div>
    </div>
  {/if}
</header>

<div class="msg-feed" bind:this={feedEl}>
  {#if activeThread}
    {#if !mergedThread.length}
      <p class="msg-empty">Nothing here yet.</p>
    {:else}
      {#each mergedThread as item, i (item.id)}
        {#if item._isMine}
          <div class="msg-row-mine" in:fly={{ y: 10, duration: 400 }}>
            <div class="msg-mine-content">
              <div class="msg-bubble-mine">
                <div class="msg-bubble-text">{@html linkify(item.text)}</div>
              </div>
              <span class="msg-mine-time">{relTime(item.ts)}</span>
            </div>
          </div>
        {:else}
          {@const meta = contactsByName[item.sender] ?? { color: '#b8902f', avatar: null }}
          {@const color = item.color || meta.color}
          {@const isFirstInRun = i === 0 || mergedThread[i - 1]._isMine || mergedThread[i - 1].sender !== item.sender}
          {@const isLastInRun = i === mergedThread.length - 1 || mergedThread[i + 1]._isMine || mergedThread[i + 1].sender !== item.sender}

          {#if isGroupThread}
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
                <div class="msg-bubble" class:has-image={item.imageUrl} style="border-left-color:{color}">
                  {#if item.imageUrl}
                    <img class="msg-image" src={item.imageUrl} alt="" loading="lazy"
                      on:error={e => e.currentTarget.style.display = 'none'}>
                  {/if}
                  {#if item.text}
                    <div class="msg-bubble-text">{@html linkify(item.text)}</div>
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
            <div class="msg-row-simple" class:msg-row-simple-continued={!isFirstInRun} in:fly={{ y: 10, duration: 400 }}>
              <div class="msg-bubble-wrap">
                <div class="msg-bubble" class:has-image={item.imageUrl} style="border-left-color:{color}">
                  {#if item.imageUrl}
                    <img class="msg-image" src={item.imageUrl} alt="" loading="lazy"
                      on:error={e => e.currentTarget.style.display = 'none'}>
                  {/if}
                  {#if item.text}
                    <div class="msg-bubble-text">{@html linkify(item.text)}</div>
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
    {#if !conversations.length}
      <p class="msg-empty">No activity found on this device.</p>
    {:else}
      <PaginatedList items={conversations} pageSize={20} let:item>
        {@const g = item}
        <a class="conv-row"
          href="{backHref}&thread={encodeURIComponent(g.key)}"
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
              <span class="conv-name" style="color:{g.color}">{g.name}</span>
              <span class="conv-time">{relTime(g.lastTs)}</span>
            </div>
            <div class="conv-preview">
              {#if g.isGroup && g.lastSender}{g.lastSender}: {/if}{g.lastText}
            </div>
          </div>
        </a>
      </PaginatedList>
    {/if}
  {/if}
</div>

{#if activeThread && canReply}
  <div class="msg-compose">
    <textarea
      class="msg-compose-input"
      bind:value={responseText}
      placeholder="Reply as {npcKey}…"
      rows="2"
      on:keydown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); sendResponse(); } }}
    ></textarea>
    <button class="msg-compose-send" disabled={!responseText.trim() || sendingResponse}
      on:click={sendResponse}>
      {sendingResponse ? '…' : 'Send'}
    </button>
  </div>
{:else if activeThread}
  <div class="msg-footer-note">Read-only &middot; this conversation isn't hidden, replying here would go live to the real players</div>
{:else}
  <div class="msg-footer-note">Compromised device &middot; updates live</div>
{/if}

<style>
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
  }

  /* ── hacked-mode banner — the one deliberate visual break from the normal
     Wire chrome, so this never reads as "your own phone" ─────────────────── */
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

  /* ── header ──────────────────────────────────────────────────────────── */
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
  .msg-back::before {
    content: '';
    position: absolute;
    inset: -8px;
  }
  .msg-live-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #c0504a;
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

  /* ── feed ────────────────────────────────────────────────────────────── */
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

  .msg-row-simple { max-width: 480px; margin: 0 auto 10px; }
  .msg-row-simple.msg-row-simple-continued { margin-bottom: 4px; }

  .msg-bubble-wrap { display: flex; align-items: flex-end; gap: 8px; }
  .msg-bubble-wrap .msg-bubble { flex: 1; min-width: 0; }
  .msg-bubble-wrap .msg-time { flex-shrink: 0; align-self: flex-end; padding-bottom: 2px; }

  .msg-row { display: flex; gap: 8px; max-width: 480px; margin: 0 auto 10px; }
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
  .msg-sender-name { font-size: 11px; font-weight: 600; letter-spacing: 0.3px; margin-bottom: 3px; }
  .msg-time-group { display: block; margin-top: 3px; }

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
  .msg-image { display: block; width: 100%; max-width: 280px; border-radius: 8px; }
  .msg-bubble-text { padding: 7px 6px 2px; }
  .msg-bubble-text:first-child { padding-top: 0; }

  /* ── conversation list ───────────────────────────────────────────────── */
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
  .conv-top { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 3px; gap: 8px; }
  .conv-name { font-size: 13.5px; font-weight: 600; }
  .conv-time { font-size: 10px; color: rgba(232, 223, 200, 0.4); flex-shrink: 0; }
  .conv-preview {
    font-size: 12px;
    color: rgba(232, 223, 200, 0.55);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* ── empty / footer ──────────────────────────────────────────────────── */
  .msg-empty {
    max-width: 320px;
    margin: 60px auto;
    text-align: center;
    font-size: 13px;
    font-style: italic;
    line-height: 1.6;
    color: #3a4a5a;
  }

  /* ── "mine" bubbles (right-aligned) — the device owner's own outgoing texts */
  .msg-row-mine {
    max-width: 480px;
    margin: 0 auto 10px;
    display: flex;
    justify-content: flex-end;
  }
  .msg-mine-content {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    min-width: 0;
    max-width: 85%;
  }
  .msg-bubble-mine {
    background: rgba(192, 80, 74, 0.1);
    border-right: 3px solid #c0504a;
    border-radius: 10px 4px 4px 10px;
    padding: 9px 12px;
    font-size: 13.5px;
    line-height: 1.5;
    color: rgba(232, 223, 200, 0.92);
    word-wrap: break-word;
    white-space: pre-line;
    max-width: 100%;
  }
  .msg-mine-time { font-size: 9.5px; color: rgba(232, 223, 200, 0.4); margin-top: 3px; }

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
  .msg-compose-input:focus { outline: none; border-color: #c0504a; }
  .msg-compose-input::placeholder { color: #3a4a5a; }
  .msg-compose-send {
    background: #c0504a;
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
    color: #c0504a;
    opacity: 0.6;
    padding: 6px 0 10px;
  }
</style>
