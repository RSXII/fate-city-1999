<script>
  import { base } from '$app/paths';
  import { onMount, onDestroy } from 'svelte';
  import SENDERS from '$lib/data/senders.js';
  import { dbGet, dbPost, dbPut, dbDelete } from '$lib/firebase-db.js';

  const GITHUB_IMAGES_API =
    'https://api.github.com/repos/RSXII/fate-city-1999/contents/images/messages';

  // ── Helpers ───────────────────────────────────────────────────────────────
  function relTime(ts) {
    const diff = Math.max(0, Date.now() - ts);
    const s = Math.floor(diff / 1000);
    if (s < 10) return 'now';
    if (s < 60) return `${s}s ago`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  }

  function normMessages(raw) {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    return Object.keys(raw)
      .sort((a, b) => parseInt(a) - parseInt(b))
      .map(k => raw[k]);
  }

  // ── Section 1: Wire Messages ──────────────────────────────────────────────
  let selectedSender = null;
  let msgText = '';
  let selectedImage = null; // { url, name }
  let pickerOpen = false;
  let pickerImages = [];
  let pickerLoading = false;
  let pickerError = '';
  let msgLog = [];
  let sendStatus = { text: '', type: '' };
  let sending = false;
  let msgLogEl;

  $: sendEnabled = !sending && !!selectedSender && (msgText.trim().length > 0 || !!selectedImage);

  async function refreshLog() {
    try {
      const data = await dbGet('messages');
      if (!data) { msgLog = []; return; }
      msgLog = Object.keys(data).map(k => { const m = data[k]; m._id = k; return m; })
        .sort((a, b) => a.ts - b.ts);
    } catch { msgLog = []; }
    // scroll to bottom after render
    setTimeout(() => { if (msgLogEl) msgLogEl.scrollTop = msgLogEl.scrollHeight; }, 0);
  }

  async function sendMessage() {
    const text = msgText.trim();
    if (!selectedSender || (!text && !selectedImage)) return;
    sending = true;
    sendStatus = { text: 'Sending…', type: '' };
    try {
      const payload = { sender: selectedSender.name, color: selectedSender.color, text, ts: Date.now() };
      if (selectedImage) payload.imageUrl = selectedImage.url;
      await dbPost('messages', payload);
      msgText = '';
      selectedImage = null;
      pickerOpen = false;
      sendStatus = { text: 'Sent.', type: 'ok' };
      await refreshLog();
    } catch (e) {
      sendStatus = { text: `Send failed: ${e?.message ?? 'unknown error'}`, type: 'err' };
    }
    sending = false;
  }

  async function clearMessages() {
    if (!confirm('Clear the entire group thread for all players? This cannot be undone.')) return;
    try {
      await dbDelete('messages');
      msgLog = [];
      sendStatus = { text: 'Thread cleared.', type: 'ok' };
    } catch (e) {
      sendStatus = { text: `Clear failed: ${e?.message ?? 'unknown error'}`, type: 'err' };
    }
  }

  async function togglePicker() {
    if (pickerOpen) { pickerOpen = false; return; }
    pickerOpen = true;
    pickerImages = [];
    pickerLoading = true;
    pickerError = '';
    try {
      const res = await fetch(GITHUB_IMAGES_API);
      if (res.status === 404) { pickerLoading = false; pickerError = 'No images found in images/messages/ yet.'; return; }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      pickerImages = data.filter(f => f.type === 'file' && /\.(png|jpe?g|gif|webp)$/i.test(f.name));
      if (!pickerImages.length) pickerError = 'No images found in images/messages/ yet.';
    } catch (e) {
      pickerError = `Failed to load: ${e?.message ?? 'error'}`;
    }
    pickerLoading = false;
  }

  function selectImage(img) {
    selectedImage = { url: img.download_url, name: img.name };
    pickerOpen = false;
  }

  // ── Section 2: Email / Data Packets ──────────────────────────────────────
  let emailSubject = '';
  let replies = []; // { id, from, body, imageUrl }
  let replyCounter = 0;
  let emailStatus = { text: '', type: '' };
  let staging = false;
  let stagedChains = [];
  let liveChains = [];

  // Per-reply picker state keyed by reply id
  let replyPickers = {}; // id → { open, loading, error, images }

  function addReply(from = '', body = '') {
    const id = ++replyCounter;
    replies = [...replies, { id, from, body, imageUrl: '' }];
    replyPickers = { ...replyPickers, [id]: { open: false, loading: false, error: '', images: [] } };
  }

  function removeReply(id) {
    replies = replies.filter(r => r.id !== id);
    const p = { ...replyPickers };
    delete p[id];
    replyPickers = p;
  }

  async function toggleReplyPicker(id) {
    const cur = replyPickers[id];
    if (cur.open) {
      replyPickers = { ...replyPickers, [id]: { ...cur, open: false } };
      return;
    }
    replyPickers = { ...replyPickers, [id]: { ...cur, open: true, loading: true, error: '', images: [] } };
    try {
      const res = await fetch(GITHUB_IMAGES_API);
      if (res.status === 404) {
        replyPickers = { ...replyPickers, [id]: { ...replyPickers[id], loading: false, error: 'No images found.' } };
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const images = data.filter(f => f.type === 'file' && /\.(png|jpe?g|gif|webp)$/i.test(f.name));
      replyPickers = { ...replyPickers, [id]: { ...replyPickers[id], loading: false, images, error: images.length ? '' : 'No images found.' } };
    } catch (e) {
      replyPickers = { ...replyPickers, [id]: { ...replyPickers[id], loading: false, error: `Failed: ${e?.message ?? 'error'}` } };
    }
  }

  function selectReplyImage(replyId, img) {
    replies = replies.map(r => r.id === replyId ? { ...r, imageUrl: img.download_url } : r);
    replyPickers = { ...replyPickers, [replyId]: { ...replyPickers[replyId], open: false } };
  }

  function clearReplyImage(replyId) {
    replies = replies.map(r => r.id === replyId ? { ...r, imageUrl: '' } : r);
  }

  async function stageChain() {
    const subject = emailSubject.trim();
    if (!subject) { emailStatus = { text: 'A subject line is required.', type: 'err' }; return; }
    const now = Date.now();
    const msgs = replies
      .map((r, i) => {
        const m = { from: r.from.trim() || 'Unknown', body: r.body.trim(), ts: now + i * 60000 };
        if (r.imageUrl) m.imageUrl = r.imageUrl;
        return m;
      })
      .filter(m => m.body || m.imageUrl || m.from !== 'Unknown');

    if (!msgs.length) { emailStatus = { text: 'Add at least one message to the chain.', type: 'err' }; return; }
    staging = true;
    emailStatus = { text: 'Staging…', type: '' };
    try {
      await dbPost('emails', { subject, staged: false, createdAt: now, messages: msgs });
      emailSubject = '';
      replies = [];
      replyPickers = {};
      replyCounter = 0;
      addReply(); addReply();
      emailStatus = { text: 'Staged. Use Deploy when the players are ready.', type: 'ok' };
      await refreshStaged();
    } catch (e) {
      emailStatus = { text: `Failed: ${e?.message ?? 'unknown error'}`, type: 'err' };
    }
    staging = false;
  }

  async function loadChains(stagedValue) {
    try {
      const data = await dbGet('emails');
      if (!data) return [];
      return Object.keys(data)
        .map(k => { const c = data[k]; c._id = k; return c; })
        .filter(c => c.staged === stagedValue)
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    } catch { return []; }
  }

  async function refreshStaged() { stagedChains = await loadChains(false); }
  async function refreshLive()   { liveChains   = await loadChains(true);  }

  let deployingId = null;
  async function deployChain(id) {
    deployingId = id;
    try { await dbPut(`emails/${id}/staged`, true); await refreshStaged(); await refreshLive(); }
    catch (e) { console.error('Deploy failed', e); }
    deployingId = null;
  }

  let recallingId = null;
  async function recallChain(id) {
    if (!confirm('Recall this chain? It will disappear from player devices.')) return;
    recallingId = id;
    try { await dbPut(`emails/${id}/staged`, false); await refreshStaged(); await refreshLive(); }
    catch (e) { console.error('Recall failed', e); }
    recallingId = null;
  }

  async function deleteChain(id, isLive) {
    const msg = isLive
      ? 'Permanently delete this live chain from all devices?'
      : 'Delete this staged chain? This cannot be undone.';
    if (!confirm(msg)) return;
    try {
      await dbDelete(`emails/${id}`);
      if (isLive) await refreshLive(); else await refreshStaged();
    } catch (e) { console.error('Delete failed', e); }
  }

  // ── Section 3: Phone Contacts ─────────────────────────────────────────────
  let contactList = [];
  let newCName = '';
  let newCNumber = '';
  let newCSubtitle = '';
  let contactStatus = { text: '', type: '' };
  let addingContact = false;

  async function refreshContacts() {
    try {
      const data = await dbGet('contacts');
      if (!data) { contactList = []; return; }
      contactList = Object.keys(data)
        .map(k => { const c = data[k]; c._id = k; return c; })
        .sort((a, b) => a.name.localeCompare(b.name));
    } catch { contactList = []; }
  }

  async function addContact() {
    const name = newCName.trim();
    const number = newCNumber.trim();
    if (!name || !number) { contactStatus = { text: 'Name and number are required.', type: 'err' }; return; }
    addingContact = true;
    contactStatus = { text: 'Adding…', type: '' };
    try {
      await dbPost('contacts', { name, number, subtitle: newCSubtitle.trim(), enabled: true });
      newCName = ''; newCNumber = ''; newCSubtitle = '';
      contactStatus = { text: 'Contact added.', type: 'ok' };
      await refreshContacts();
    } catch (e) {
      contactStatus = { text: `Failed: ${e?.message ?? 'unknown error'}`, type: 'err' };
    }
    addingContact = false;
  }

  async function toggleContact(id, currentEnabled) {
    try {
      await dbPut(`contacts/${id}/enabled`, !currentEnabled);
      await refreshContacts();
    } catch (e) { console.error('Toggle failed', e); }
  }

  async function deleteContact(id) {
    if (!confirm('Remove this contact from player phones?')) return;
    try {
      await dbDelete(`contacts/${id}`);
      await refreshContacts();
    } catch (e) { console.error('Delete failed', e); }
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  let msgPoll;
  let emailPoll;
  let contactPoll;

  onMount(() => {
    addReply(); addReply();
    refreshLog();
    refreshStaged();
    refreshLive();
    refreshContacts();
    msgPoll     = setInterval(refreshLog,  4000);
    emailPoll   = setInterval(() => { refreshStaged(); refreshLive(); }, 8000);
    contactPoll = setInterval(refreshContacts, 10000);
  });

  onDestroy(() => {
    clearInterval(msgPoll);
    clearInterval(emailPoll);
    clearInterval(contactPoll);
  });
</script>

<svelte:head>
  <title>Fate City: 1999 — GM Console</title>
</svelte:head>

<div class="console">
  <h1>Fate City — Wire Console</h1>
  <p class="subtitle">Pick a sender, write the line, send it to the players' group thread.</p>

  <!-- ── SENDER ─────────────────────────────────────────────────────────── -->
  <div class="section">
    <div class="section-label">Sender</div>
    <div class="chip-grid">
      {#each SENDERS as s (s.id)}
        <button
          type="button"
          class="chip"
          class:selected={selectedSender?.id === s.id}
          style="color:{s.color};border-color:{s.color}"
          on:click={() => { selectedSender = s; }}
        >
          <img
            class="chip-avatar"
            src="{base}/{s.avatar}"
            alt=""
            loading="lazy"
            on:error={e => e.target.style.display = 'none'}
          />
          <span>{s.name}</span>
        </button>
      {/each}
    </div>
  </div>

  <!-- ── MESSAGE ───────────────────────────────────────────────────────── -->
  <div class="section">
    <div class="section-label">Message</div>
    <div class="selected-line">
      {#if selectedSender}
        Sending as <strong style="color:{selectedSender.color}">{selectedSender.name}</strong>
      {:else}
        No sender selected yet.
      {/if}
    </div>

    <textarea
      bind:value={msgText}
      placeholder="Type what they'd actually text…"
    ></textarea>

    <div class="attach-row">
      <button class="ghost-btn" type="button" on:click={togglePicker}>
        {pickerOpen ? 'Close picker' : '+ Attach image'}
      </button>
      {#if selectedImage}
        <div class="attached-preview">
          <img src={selectedImage.url} alt="" />
          <span>{selectedImage.name}</span>
          <button type="button" on:click={() => { selectedImage = null; }}>&times;</button>
        </div>
      {/if}
    </div>

    {#if pickerOpen}
      <div class="image-picker">
        {#if pickerLoading}
          <div class="img-picker-status">Loading…</div>
        {:else if pickerError}
          <div class="img-picker-status err">{pickerError}</div>
        {:else}
          {#each pickerImages as img (img.name)}
            <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
            <div class="img-thumb" on:click={() => selectImage(img)}>
              <img src={img.download_url} alt={img.name} loading="lazy" />
            </div>
          {/each}
        {/if}
      </div>
    {/if}

    <div style="height:10px"></div>
    <button class="primary" disabled={!sendEnabled} on:click={sendMessage}>
      Send to group thread
    </button>
    <div class="status-line" class:ok={sendStatus.type === 'ok'} class:err={sendStatus.type === 'err'}>
      {sendStatus.text}
    </div>
  </div>

  <!-- ── LIVE THREAD LOG ───────────────────────────────────────────────── -->
  <div class="section">
    <div class="section-label-row">
      <div class="section-label" style="margin-bottom:0">Thread (live)</div>
      <button class="ghost-btn" on:click={clearMessages}>Clear thread</button>
    </div>
    <div class="log" bind:this={msgLogEl}>
      {#if !msgLog.length}
        <div class="log-empty">No messages sent yet.</div>
      {:else}
        {#each msgLog as m (m._id ?? m.ts)}
          <div class="log-row">
            <span class="log-name" style="color:{m.color}">{m.sender}:</span>
            <span class="log-text">
              {#if m.imageUrl}📷 {/if}{m.text ?? ''}
              <span class="log-time">{relTime(m.ts)}</span>
            </span>
          </div>
        {/each}
      {/if}
    </div>
  </div>

  <hr class="section-divider" />

  <!-- ── EMAIL / DATA PACKETS ──────────────────────────────────────────── -->
  <h2 class="email-heading">Email — Data Packets</h2>
  <p class="subtitle">Author an intercepted email chain. Stage it silently, then deploy when players are ready.</p>

  <div class="section">
    <div class="section-label">New Chain</div>
    <input
      type="text"
      class="email-subject-input"
      placeholder="Subject line…"
      bind:value={emailSubject}
    />

    {#each replies as reply (reply.id)}
      <div class="reply-block">
        <div class="reply-block-header">
          <input
            type="text"
            class="reply-from-input"
            placeholder="From: display name…"
            value={reply.from}
            on:input={e => { reply.from = e.target.value; replies = replies; }}
          />
          {#if replies.length > 1}
            <button type="button" class="remove-reply-btn" on:click={() => removeReply(reply.id)}>&times;</button>
          {/if}
        </div>
        <textarea
          class="reply-body-input"
          rows="3"
          placeholder="Message body…"
          value={reply.body}
          on:input={e => { reply.body = e.target.value; replies = replies; }}
        ></textarea>

        <div class="reply-attach-row">
          {#if !reply.imageUrl}
            <button type="button" class="ghost-btn reply-attach-btn" on:click={() => toggleReplyPicker(reply.id)}>
              {replyPickers[reply.id]?.open ? 'Close picker' : '+ Attach image'}
            </button>
          {:else}
            <div class="reply-attach-preview">
              <span class="reply-attach-name">{reply.imageUrl.split('/').pop()}</span>
              <button type="button" class="reply-attach-remove" on:click={() => clearReplyImage(reply.id)}>&times;</button>
            </div>
          {/if}
        </div>

        {#if replyPickers[reply.id]?.open}
          <div class="reply-image-picker">
            {#if replyPickers[reply.id].loading}
              <div class="img-picker-status">Loading…</div>
            {:else if replyPickers[reply.id].error}
              <div class="img-picker-status err">{replyPickers[reply.id].error}</div>
            {:else}
              {#each replyPickers[reply.id].images as img (img.name)}
                <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
                <div class="img-thumb" on:click={() => selectReplyImage(reply.id, img)}>
                  <img src={img.download_url} alt={img.name} loading="lazy" />
                </div>
              {/each}
            {/if}
          </div>
        {/if}
      </div>
    {/each}

    <button class="ghost-btn" type="button" style="margin-top:4px" on:click={() => addReply()}>
      + Add Reply
    </button>
    <div style="height:12px"></div>
    <button class="primary" disabled={staging} on:click={stageChain}>
      {staging ? 'Staging…' : 'Stage Chain (hidden from players)'}
    </button>
    <div class="status-line" class:ok={emailStatus.type === 'ok'} class:err={emailStatus.type === 'err'}>
      {emailStatus.text}
    </div>
  </div>

  <!-- Staged queue -->
  <div class="section">
    <div class="section-label-row">
      <div class="section-label" style="margin-bottom:0">Staged — awaiting deploy</div>
      <button class="ghost-btn" on:click={refreshStaged}>Refresh</button>
    </div>
    <div class="log">
      {#if !stagedChains.length}
        <div class="log-empty">No staged chains.</div>
      {:else}
        {#each stagedChains as chain (chain._id)}
          {@const msgs = normMessages(chain.messages)}
          <div class="chain-log-row">
            <div class="chain-log-top">
              <span class="chain-log-subject" style="color:#c9a227">{chain.subject}</span>
              <span class="chain-log-meta">{msgs.length} msg{msgs.length !== 1 ? 's' : ''} · {relTime(chain.createdAt || 0)}</span>
            </div>
            <div class="chain-log-actions">
              <button
                class="deploy-btn"
                disabled={deployingId === chain._id}
                on:click={() => deployChain(chain._id)}
              >
                {deployingId === chain._id ? 'Deploying…' : 'Deploy → Players'}
              </button>
              <button class="danger-btn" on:click={() => deleteChain(chain._id, false)}>Delete</button>
            </div>
          </div>
        {/each}
      {/if}
    </div>
  </div>

  <!-- Live queue -->
  <div class="section">
    <div class="section-label-row">
      <div class="section-label" style="margin-bottom:0">Live — on player devices</div>
      <button class="ghost-btn" on:click={refreshLive}>Refresh</button>
    </div>
    <div class="log">
      {#if !liveChains.length}
        <div class="log-empty">No live chains.</div>
      {:else}
        {#each liveChains as chain (chain._id)}
          {@const msgs = normMessages(chain.messages)}
          <div class="chain-log-row">
            <div class="chain-log-top">
              <span class="chain-log-subject">
                <span class="live-label">▶ LIVE &nbsp;</span>{chain.subject}
              </span>
              <span class="chain-log-meta">{msgs.length} msg{msgs.length !== 1 ? 's' : ''} · {relTime(chain.createdAt || 0)}</span>
            </div>
            <div class="chain-log-actions" style="justify-content:flex-end">
              <button
                class="recall-btn"
                disabled={recallingId === chain._id}
                on:click={() => recallChain(chain._id)}
              >
                {recallingId === chain._id ? 'Recalling…' : 'Recall'}
              </button>
              <button class="danger-btn" on:click={() => deleteChain(chain._id, true)}>Delete</button>
            </div>
          </div>
        {/each}
      {/if}
    </div>
  </div>

  <hr class="section-divider" />

  <!-- ── PHONE CONTACTS ──────────────────────────────────────────────── -->
  <h2 class="email-heading">Phone Contacts</h2>
  <p class="subtitle">Manage contacts that appear on player devices. Toggle visibility without deleting.</p>

  <!-- Add form -->
  <div class="section">
    <div class="section-label">Add Contact</div>
    <div class="contact-form">
      <input type="text" class="contact-input" placeholder="Name…" bind:value={newCName} />
      <input type="text" class="contact-input" placeholder="Phone number…" bind:value={newCNumber} />
      <input type="text" class="contact-input" placeholder="Role / subtitle (optional)…" bind:value={newCSubtitle} />
    </div>
    <div style="height:10px"></div>
    <button class="primary" disabled={addingContact} on:click={addContact}>
      {addingContact ? 'Adding…' : 'Add to Phone Contacts'}
    </button>
    <div class="status-line" class:ok={contactStatus.type === 'ok'} class:err={contactStatus.type === 'err'}>
      {contactStatus.text}
    </div>
  </div>

  <!-- Contact list -->
  <div class="section">
    <div class="section-label-row">
      <div class="section-label" style="margin-bottom:0">Contacts ({contactList.length})</div>
      <button class="ghost-btn" on:click={refreshContacts}>Refresh</button>
    </div>
    <div class="log">
      {#if !contactList.length}
        <div class="log-empty">No contacts yet. Add one above.</div>
      {:else}
        {#each contactList as c (c._id)}
          <div class="contact-log-row">
            <div class="contact-log-info">
              <span class="contact-log-name" class:dimmed={!c.enabled}>{c.name}</span>
              <span class="contact-log-meta">{c.number}{c.subtitle ? ' · ' + c.subtitle : ''}</span>
            </div>
            <div class="contact-log-actions">
              <button
                class="toggle-btn"
                class:on={c.enabled}
                on:click={() => toggleContact(c._id, c.enabled)}
              >{c.enabled ? 'Visible' : 'Hidden'}</button>
              <button class="danger-btn" on:click={() => deleteContact(c._id)}>Delete</button>
            </div>
          </div>
        {/each}
      {/if}
    </div>
  </div>

</div>

<style>
  .console {
    padding: 20px 16px 60px;
    max-width: 640px;
    margin: 0 auto;
    color: #e8dfc8;
    font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif;
  }
  h1 {
    font-size: 15px;
    font-weight: 600;
    letter-spacing: 1.2px;
    text-transform: uppercase;
    color: #c9a227;
    margin: 0 0 2px;
  }
  .email-heading {
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: #c9a227;
    margin: 0 0 2px;
  }
  .subtitle { font-size: 11px; color: #3a4a5a; letter-spacing: 0.5px; margin: 0 0 24px; }

  .section { margin-bottom: 26px; }
  .section-label { font-size: 10.5px; font-weight: 600; letter-spacing: 1.5px; text-transform: uppercase; color: #6a7d90; margin-bottom: 10px; }
  .section-label-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }

  .chip-grid { display: flex; flex-wrap: wrap; gap: 8px; }
  .chip {
    border: 1px solid; border-radius: 20px; padding: 5px 14px 5px 6px;
    font-size: 12.5px; font-weight: 600; cursor: pointer; background: transparent;
    transition: background 0.15s ease, transform 0.1s ease;
    user-select: none; display: inline-flex; align-items: center; gap: 7px;
  }
  .chip:active { transform: scale(0.96); }
  .chip-avatar { width: 22px; height: 22px; border-radius: 50%; object-fit: cover; object-position: 50% 20%; border: 1px solid rgba(255,255,255,0.15); flex-shrink: 0; }
  .chip.selected { box-shadow: inset 0 0 0 1px currentColor; }

  textarea {
    width: 100%; min-height: 70px; background: #0c0f16;
    border: 1px solid #1a2030; border-radius: 8px; color: #e8dfc8;
    font-family: inherit; font-size: 13.5px; padding: 10px 12px; resize: vertical; outline: none;
  }
  textarea:focus { border-color: #c9a227; }
  textarea::placeholder { color: #3a4a5a; }

  .selected-line { font-size: 11.5px; color: #6a7d90; margin: 8px 0 10px; min-height: 16px; }
  .selected-line :global(strong) { font-weight: 600; }

  button.primary {
    background: #c9a227; color: #15130f; border: none; border-radius: 8px;
    padding: 11px 18px; font-size: 13px; font-weight: 700; letter-spacing: 0.3px; cursor: pointer; width: 100%;
  }
  button.primary:active { transform: scale(0.98); }
  button.primary:disabled { background: #2a2a26; color: #5a5650; cursor: not-allowed; }

  .ghost-btn {
    background: none; border: 1px solid #3a4a5a; color: #6a7d90; border-radius: 6px;
    padding: 4px 10px; font-size: 10.5px; letter-spacing: 0.5px; text-transform: uppercase; cursor: pointer;
  }
  .ghost-btn:hover { border-color: #6a7d90; color: #c9a227; }

  .attach-row { display: flex; align-items: center; gap: 10px; margin-top: 8px; flex-wrap: wrap; }
  .attached-preview { display: flex; align-items: center; gap: 8px; background: #0c0f16; border: 1px solid #1a2030; border-radius: 8px; padding: 4px 8px 4px 4px; font-size: 11.5px; color: #6a7d90; }
  .attached-preview img { width: 28px; height: 28px; border-radius: 5px; object-fit: cover; }
  .attached-preview button { background: none; border: none; color: #6a7d90; font-size: 15px; cursor: pointer; line-height: 1; padding: 0 2px; }
  .attached-preview button:hover { color: #e24b4a; }

  .image-picker { margin-top: 10px; background: #0c0f16; border: 1px solid #1a2030; border-radius: 8px; padding: 10px; display: grid; grid-template-columns: repeat(auto-fill, minmax(72px, 1fr)); gap: 8px; max-height: 220px; overflow-y: auto; }
  .img-thumb { cursor: pointer; border-radius: 6px; overflow: hidden; aspect-ratio: 1; border: 1px solid #1a2030; transition: border-color 0.15s ease; }
  .img-thumb:hover { border-color: #c9a227; }
  .img-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .img-picker-status { grid-column: 1/-1; font-size: 12px; font-style: italic; color: #3a4a5a; text-align: center; padding: 10px 0; }
  .img-picker-status.err { color: #e24b4a; font-style: normal; }

  .log { background: #0c0f16; border: 1px solid #1a2030; border-radius: 8px; padding: 12px 14px; max-height: 320px; overflow-y: auto; }
  .log-empty { font-size: 12px; font-style: italic; color: #3a4a5a; text-align: center; padding: 10px 0; }
  .log-row { display: flex; gap: 8px; margin-bottom: 10px; font-size: 12.5px; line-height: 1.5; }
  .log-row:last-child { margin-bottom: 0; }
  .log-name { font-weight: 700; flex-shrink: 0; }
  .log-text { color: rgba(232,223,200,0.85); white-space: pre-line; }
  .log-time { color: #3a4a5a; font-size: 10px; margin-left: 6px; }

  .status-line { font-size: 11px; color: #6a7d90; margin-top: 8px; min-height: 14px; }
  .status-line.ok { color: #639922; }
  .status-line.err { color: #e24b4a; }

  /* ── Email section ── */
  .reply-block { background: #0c0f16; border: 1px solid #1a2030; border-radius: 8px; padding: 12px; margin-bottom: 8px; }
  .reply-block-header { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
  .reply-from-input {
    flex: 1; background: #0d1118; border: 1px solid #1a2030; border-radius: 6px;
    color: #e8dfc8; font-family: inherit; font-size: 13px; padding: 7px 10px; outline: none;
  }
  .reply-from-input:focus { border-color: #c9a227; }
  .reply-from-input::placeholder { color: #3a4a5a; }
  .reply-body-input {
    width: 100%; min-height: 64px; background: #0d1118; border: 1px solid #1a2030;
    border-radius: 6px; color: #e8dfc8; font-family: 'Courier New', Courier, monospace;
    font-size: 12.5px; padding: 8px 10px; resize: vertical; outline: none;
  }
  .reply-body-input:focus { border-color: #c9a227; }
  .reply-body-input::placeholder { color: #3a4a5a; }
  .remove-reply-btn { background: none; border: 1px solid rgba(226,75,74,0.35); color: #e24b4a; border-radius: 5px; padding: 4px 9px; font-size: 13px; line-height: 1; cursor: pointer; flex-shrink: 0; }
  .remove-reply-btn:hover { background: rgba(226,75,74,0.1); }

  .reply-attach-row { display: flex; align-items: center; gap: 8px; margin-top: 6px; }
  .reply-attach-preview { display: flex; align-items: center; gap: 6px; }
  .reply-attach-name { font-size: 11.5px; color: #c9a227; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .reply-attach-remove { background: none; border: none; color: #6a7d90; font-size: 15px; cursor: pointer; padding: 0 2px; line-height: 1; }
  .reply-attach-remove:hover { color: #e24b4a; }
  .reply-image-picker { margin-top: 8px; background: #0c0f16; border: 1px solid #1a2030; border-radius: 8px; padding: 8px; display: grid; grid-template-columns: repeat(auto-fill, minmax(64px, 1fr)); gap: 6px; max-height: 180px; overflow-y: auto; }

  .email-subject-input { width: 100%; background: #0c0f16; border: 1px solid #1a2030; border-radius: 8px; color: #e8dfc8; font-family: inherit; font-size: 13.5px; padding: 10px 12px; outline: none; margin-bottom: 12px; }
  .email-subject-input:focus { border-color: #c9a227; }
  .email-subject-input::placeholder { color: #3a4a5a; }

  .chain-log-row { padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.05); }
  .chain-log-row:last-child { border-bottom: none; }
  .chain-log-top { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; margin-bottom: 7px; }
  .chain-log-subject { font-size: 13px; font-weight: 600; }
  .chain-log-meta { font-size: 10px; color: #3a4a5a; flex-shrink: 0; }
  .chain-log-actions { display: flex; gap: 6px; }
  .deploy-btn { flex: 1; background: #c9a227; color: #15130f; border: none; border-radius: 6px; padding: 7px 12px; font-size: 12px; font-weight: 700; cursor: pointer; }
  .deploy-btn:active { transform: scale(0.98); }
  .deploy-btn:disabled { background: #2a2a26; color: #5a5650; cursor: not-allowed; }
  .recall-btn { background: none; border: 1px solid #3a4a5a; color: #6a7d90; border-radius: 6px; padding: 7px 12px; font-size: 11px; cursor: pointer; }
  .recall-btn:hover { border-color: #c9a227; color: #c9a227; }
  .recall-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .danger-btn { background: none; border: 1px solid rgba(226,75,74,0.35); color: #e24b4a; border-radius: 6px; padding: 7px 12px; font-size: 11px; cursor: pointer; }
  .danger-btn:hover { background: rgba(226,75,74,0.08); }

  .live-label { color: #4ade80; font-size: 10px; letter-spacing: 1px; font-weight: 700; text-transform: uppercase; }
  .section-divider { border: none; border-top: 1px solid #1a2030; margin: 28px 0; }

  /* ── Phone Contacts section ── */
  .contact-form { display: flex; flex-direction: column; gap: 8px; }
  .contact-input {
    width: 100%; background: #0c0f16; border: 1px solid #1a2030; border-radius: 8px;
    color: #e8dfc8; font-family: inherit; font-size: 13.5px; padding: 10px 12px; outline: none;
  }
  .contact-input:focus { border-color: #c9a227; }
  .contact-input::placeholder { color: #3a4a5a; }

  .contact-log-row {
    display: flex; align-items: center; justify-content: space-between; gap: 10px;
    padding: 9px 0; border-bottom: 1px solid rgba(255,255,255,0.05);
  }
  .contact-log-row:last-child { border-bottom: none; }
  .contact-log-info { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }
  .contact-log-name { font-size: 13px; font-weight: 600; color: #e8dfc8; }
  .contact-log-name.dimmed { color: #3a4a5a; }
  .contact-log-meta { font-size: 11px; color: #6a7d90; }
  .contact-log-actions { display: flex; gap: 6px; flex-shrink: 0; }
  .toggle-btn {
    background: none; border: 1px solid #3a4a5a; color: #6a7d90;
    border-radius: 6px; padding: 5px 10px; font-size: 11px; cursor: pointer;
    transition: border-color 0.15s ease, color 0.15s ease;
  }
  .toggle-btn.on { border-color: #34c759; color: #34c759; }
  .toggle-btn:hover { border-color: #c9a227; color: #c9a227; }
</style>
