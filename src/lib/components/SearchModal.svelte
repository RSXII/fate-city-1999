<script>
  import { createEventDispatcher } from 'svelte';
  import { base } from '$app/paths';
  import { messagesCache, emailsCache } from '$lib/stores/search.js';
  import { normMessages } from '$lib/utils.js';

  export let open = false;

  const dispatch = createEventDispatcher();

  let query = '';
  let inputEl;

  // Focus input whenever modal opens
  $: if (open) {
    setTimeout(() => inputEl?.focus(), 60);
  }

  $: q = query.trim().toLowerCase();

  // Message results — one result per unique conversation (sender)
  $: msgResults = (() => {
    if (!q) return [];
    const seen = new Set();
    const out = [];
    for (const m of $messagesCache) {
      if (seen.has(m.sender)) continue;
      const matchSender = m.sender?.toLowerCase().includes(q);
      const matchText   = m.text?.toLowerCase().includes(q);
      if (matchSender || matchText) {
        seen.add(m.sender);
        out.push({ type: 'message', sender: m.sender, color: m.color, preview: m.text ?? '' });
      }
    }
    return out.slice(0, 8);
  })();

  // Email results — one result per matching chain
  $: emailResults = (() => {
    if (!q) return [];
    return $emailsCache
      .filter(c => {
        if (c.subject?.toLowerCase().includes(q)) return true;
        return normMessages(c.messages).some(
          m => m.from?.toLowerCase().includes(q) || m.body?.toLowerCase().includes(q)
        );
      })
      .map(c => {
        const msgs = normMessages(c.messages);
        const hit = msgs.find(
          m => m.from?.toLowerCase().includes(q) || m.body?.toLowerCase().includes(q)
        );
        return {
          type: 'email',
          id: c._id,
          subject: c.subject ?? '(no subject)',
          preview: hit ? `${hit.from}: ${(hit.body ?? '').slice(0, 64)}` : '',
        };
      })
      .slice(0, 8);
  })();

  $: results = [...msgResults, ...emailResults];

  function close() {
    query = '';
    dispatch('close');
  }

  function handleBackdropKey(e) {
    if (e.key === 'Escape') close();
  }
</script>

{#if open}
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div
    class="modal-backdrop"
    on:click|self={close}
    on:keydown={handleBackdropKey}
    role="presentation"
  >
    <div class="modal-sheet" role="dialog" aria-modal="true" aria-label="Wire search">
      <!-- search bar -->
      <div class="search-bar">
        <svg class="search-icon" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="M16.5 16.5l4 4" />
        </svg>
        <input
          bind:this={inputEl}
          bind:value={query}
          type="search"
          class="search-input"
          placeholder="Search messages &amp; email…"
          autocomplete="off"
          spellcheck="false"
          on:keydown={e => e.key === 'Escape' && close()}
        />
        <button class="close-btn" on:click={close} aria-label="Close search">✕</button>
      </div>

      <!-- results -->
      <div class="results-list">
        {#if !q}
          <div class="search-hint">
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M16.5 16.5l4 4" /></svg>
            Type to search messages and email packets.
          </div>
        {:else if !results.length}
          <div class="search-hint no-results">No results for "<em>{query}</em>"</div>
        {:else}
          {#if msgResults.length}
            <div class="results-section-label">Messages</div>
          {/if}
          {#each msgResults as r}
            <a
              class="result-row"
              href="{base}/messages?sender={encodeURIComponent(r.sender)}"
              on:click={close}
            >
              <span class="result-badge msg-badge">MSG</span>
              <div class="result-body">
                <div class="result-title" style="color:{r.color ?? '#c9a227'}">{r.sender}</div>
                {#if r.preview}
                  <div class="result-preview">{r.preview}</div>
                {/if}
              </div>
              <span class="result-arrow" aria-hidden="true">›</span>
            </a>
          {/each}

          {#if emailResults.length}
            <div class="results-section-label">Email</div>
          {/if}
          {#each emailResults as r}
            <a
              class="result-row"
              href="{base}/emails?id={encodeURIComponent(r.id)}"
              on:click={close}
            >
              <span class="result-badge email-badge">EMAIL</span>
              <div class="result-body">
                <div class="result-title">{r.subject}</div>
                {#if r.preview}
                  <div class="result-preview">{r.preview}</div>
                {/if}
              </div>
              <span class="result-arrow" aria-hidden="true">›</span>
            </a>
          {/each}
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(8, 7, 12, 0.88);
    z-index: 400;
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding-top: 54px; /* below status bar */
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
  }

  .modal-sheet {
    width: 100%;
    max-width: 480px;
    background: #0c0f16;
    border: 1px solid #1a2030;
    border-radius: 14px;
    overflow: hidden;
    box-shadow: 0 24px 60px rgba(0, 0, 0, 0.6);
    margin: 0 12px;
  }

  /* ── search bar ────────────────────────────────────────────── */
  .search-bar {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 14px 16px;
    border-bottom: 1px solid #1a2030;
  }
  .search-icon {
    width: 16px;
    height: 16px;
    stroke: #6a7d90;
    fill: none;
    stroke-width: 2;
    stroke-linecap: round;
    flex-shrink: 0;
  }
  .search-input {
    flex: 1;
    background: none;
    border: none;
    outline: none;
    color: #e8dfc8;
    font-size: 16px;
    font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif;
    caret-color: #c9a227;
  }
  .search-input::placeholder { color: #3a4a5a; }
  /* hide browser's native search clear button */
  .search-input::-webkit-search-cancel-button { display: none; }

  .close-btn {
    background: none;
    border: none;
    color: #3a4a5a;
    font-size: 14px;
    cursor: pointer;
    padding: 4px 6px;
    line-height: 1;
    flex-shrink: 0;
    transition: color 0.15s ease;
  }
  .close-btn:hover { color: #e8dfc8; }

  /* ── results ───────────────────────────────────────────────── */
  .results-list {
    max-height: 55vh;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: rgba(184, 144, 47, 0.2) transparent;
  }
  .results-list::-webkit-scrollbar { width: 3px; }
  .results-list::-webkit-scrollbar-thumb {
    background: rgba(184, 144, 47, 0.22);
    border-radius: 2px;
  }

  .search-hint {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 28px 20px;
    font-size: 12px;
    color: #3a4a5a;
    text-align: center;
  }
  .search-hint svg {
    width: 14px;
    height: 14px;
    stroke: #3a4a5a;
    fill: none;
    stroke-width: 2;
    stroke-linecap: round;
    flex-shrink: 0;
  }
  .search-hint.no-results { color: #5a5650; }
  .search-hint :global(em) { color: #c9a227; font-style: normal; }

  .results-section-label {
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: #3a4a5a;
    padding: 10px 16px 4px;
  }

  .result-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 16px;
    text-decoration: none;
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
    transition: background 0.12s ease;
  }
  .result-row:last-child { border-bottom: none; }
  .result-row:hover, .result-row:active {
    background: rgba(255, 255, 255, 0.03);
  }

  .result-badge {
    font-size: 8px;
    font-weight: 700;
    letter-spacing: 1px;
    padding: 2px 5px;
    border-radius: 2px;
    flex-shrink: 0;
    text-transform: uppercase;
  }
  .msg-badge {
    color: #c9a227;
    background: rgba(201, 162, 39, 0.1);
    border: 1px solid rgba(201, 162, 39, 0.25);
  }
  .email-badge {
    color: #4ade80;
    background: rgba(74, 222, 128, 0.07);
    border: 1px solid rgba(74, 222, 128, 0.22);
  }

  .result-body { flex: 1; min-width: 0; }
  .result-title {
    font-size: 13px;
    font-weight: 600;
    color: #e8dfc8;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .result-preview {
    font-size: 11px;
    color: rgba(232, 223, 200, 0.45);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    margin-top: 2px;
  }

  .result-arrow {
    font-size: 16px;
    color: #3a4a5a;
    flex-shrink: 0;
  }
</style>
