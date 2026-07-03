<script>
  import { base } from '$app/paths';
  import { onMount, onDestroy } from 'svelte';
  import { browser } from '$app/environment';
  import { dbGet } from '$lib/firebase-db.js';
  import { visibilityAwareInterval } from '$lib/utils.js';

  const ONCE_LAST_SEEN_KEY = 'wire-once-last-seen';

  let liveMessages = [];
  let loading = true;

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

  async function fetchMessages() {
    try {
      const data = await dbGet('once-messages', { orderBy: 'ts', limitToLast: 30 });
      if (!data) { liveMessages = []; }
      else {
        liveMessages = Object.keys(data)
          .map(k => { const m = data[k]; m._id = k; return m; })
          .sort((a, b) => b.ts - a.ts);
      }
      // Mark all as seen — store the latest ts so home screen clears the alert
      if (browser && liveMessages.length) {
        localStorage.setItem(ONCE_LAST_SEEN_KEY, String(liveMessages[0].ts));
      }
    } catch { liveMessages = []; }
    loading = false;
  }

  let poll;

  onMount(() => {
    fetchMessages();
    poll = visibilityAwareInterval(fetchMessages, 8000);
  });

  onDestroy(() => { if (poll) poll(); });
</script>

<svelte:head>
  <title>Fate City: 1999 — O.N.C.E.</title>
</svelte:head>

<!-- O.N.C.E. has its own app-label on the status bar -->
<wire-status-bar app-label="O.N.C.E." layout="flex"></wire-status-bar>

<wire-header back="{base}/home" title="O.N.C.E." subtitle="Fate City: 1999 — Benefactor File" more layout="flex"></wire-header>

<div class="once-scroll">
  <div class="once-header">Encrypted &mdash; Sender Unverified</div>

  {#if loading}
    <div class="once-loading">Decrypting channel…</div>
  {:else if liveMessages.length > 0}
    {#each liveMessages as msg (msg._id ?? msg.ts)}
      <div class="once-msg once-msg--live">
        <div class="once-avatar" aria-hidden="true">M</div>
        <div class="once-body">
          <div class="once-top">
            <span class="once-sender">Unknown</span>
            <span class="once-time">{relTime(msg.ts)}</span>
          </div>
          <div class="once-text">{msg.text}</div>
        </div>
      </div>
    {/each}
    <div class="once-section-sep" aria-hidden="true"></div>
  {/if}

  <a class="once-msg" href="{base}/persons">
    <div class="once-avatar" aria-hidden="true">M</div>
    <div class="once-body">
      <div class="once-top">
        <span class="once-sender">Unknown</span>
        <span class="once-time">Now</span>
      </div>
      <div class="once-text">
        Persons of Interest is ready. Everyone worth knowing in Fate City &mdash; for now.
      </div>
      <div class="once-link-hint">Open &rarr;</div>
    </div>
  </a>

  <a class="once-msg" href="{base}/locations">
    <div class="once-avatar" aria-hidden="true">M</div>
    <div class="once-body">
      <div class="once-top">
        <span class="once-sender">Unknown</span>
        <span class="once-time">Now</span>
      </div>
      <div class="once-text">
        Locations is ready. Every address worth remembering, starting with the ones you&rsquo;ll need first.
      </div>
      <div class="once-link-hint">Open &rarr;</div>
    </div>
  </a>

  <a class="once-msg" href="{base}/intel">
    <div class="once-avatar" aria-hidden="true">M</div>
    <div class="once-body">
      <div class="once-top">
        <span class="once-sender">Unknown</span>
        <span class="once-time">Now</span>
      </div>
      <div class="once-text">
        Field Intel is ready. World briefing &mdash; everything the city expects you to already know.
      </div>
      <div class="once-link-hint">Open &rarr;</div>
    </div>
  </a>
</div>

<style>
  .once-scroll {
    flex: 1;
    overflow-y: auto;
    padding: 18px 16px 24px;
    max-width: 520px;
    width: 100%;
    margin: 0 auto;
  }

  .once-header {
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: rgba(124, 58, 237, 0.5);
    text-align: center;
    margin-bottom: 20px;
  }

  .once-msg {
    display: flex;
    gap: 12px;
    align-items: flex-start;
    background: rgba(124, 58, 237, 0.12);
    border: 1px solid rgba(124, 58, 237, 0.38);
    border-radius: 14px;
    padding: 12px 14px;
    text-decoration: none;
    box-shadow:
      0 0 18px rgba(124, 58, 237, 0.12),
      inset 0 0 12px rgba(124, 58, 237, 0.05);
    transition:
      background 0.2s ease,
      transform 0.15s ease;
    margin-bottom: 12px;
  }
  .once-msg:last-child {
    margin-bottom: 0;
  }
  .once-msg:hover {
    background: rgba(124, 58, 237, 0.2);
  }
  .once-msg:active {
    transform: scale(0.98);
  }

  .once-avatar {
    flex-shrink: 0;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: #1a0d31;
    border: 1px solid rgba(154, 111, 217, 0.5);
    color: #c9b3f0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 13px;
    font-weight: 700;
  }

  .once-body {
    flex: 1;
    min-width: 0;
  }

  .once-top {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-bottom: 4px;
    gap: 8px;
  }

  .once-sender {
    font-size: 12.5px;
    font-weight: 600;
    color: #e8e0f8;
  }

  .once-time {
    font-size: 9px;
    color: rgba(232, 224, 248, 0.4);
    flex-shrink: 0;
  }

  .once-text {
    font-size: 12px;
    line-height: 1.5;
    color: rgba(232, 224, 248, 0.85);
  }

  .once-link-hint {
    font-size: 9.5px;
    letter-spacing: 0.5px;
    text-transform: uppercase;
    color: rgba(124, 58, 237, 0.7);
    margin-top: 6px;
  }

  /* Live M transmissions */
  .once-loading {
    font-size: 10px;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: rgba(124, 58, 237, 0.4);
    text-align: center;
    padding: 12px 0 4px;
  }
  .once-msg--live {
    border-color: rgba(124, 58, 237, 0.55);
    background: rgba(124, 58, 237, 0.16);
    box-shadow:
      0 0 22px rgba(124, 58, 237, 0.18),
      inset 0 0 14px rgba(124, 58, 237, 0.07);
  }
  .once-msg--live .once-time {
    color: rgba(196, 168, 255, 0.5);
  }
  .once-section-sep {
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(124, 58, 237, 0.3), transparent);
    margin: 6px 0 18px;
  }
</style>
