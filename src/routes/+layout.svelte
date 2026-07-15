<script>
  import { onMount, onDestroy } from 'svelte';
  import { browser } from '$app/environment';
  import { page } from '$app/stores';
  import { base } from '$app/paths';
  import { dbGet } from '$lib/firebase-db.js';
  import { visibilityAwareInterval } from '$lib/utils.js';

  $: isConsole = $page.route.id?.startsWith('/gm-console');
  $: isTimerPage = $page.route.id?.startsWith('/timer');

  let clockCleanup;

  // ── Global timer expiry sound ─────────────────────────────────────────────
  let timerEndsAt = null;
  let lastAlertedEndsAt = null;
  let timerPoll;
  let timerCheckId;

  // ── Persistent bottom strip ───────────────────────────────────────────────
  let stripRunning = false;
  let stripMins = '00';
  let stripSecs = '00';
  let stripMs  = '000';
  let stripRafId = null;

  function stripTick() {
    if (!timerEndsAt) { stripRunning = false; stripRafId = null; return; }
    const rem = timerEndsAt - Date.now();
    if (rem <= 0) {
      stripRunning = false; stripRafId = null;
      stripMins = '00'; stripSecs = '00'; stripMs = '000';
      return;
    }
    stripRunning = true;
    const ts = Math.floor(rem / 1000);
    stripMins = String(Math.floor(ts / 60)).padStart(2, '0');
    stripSecs = String(ts % 60).padStart(2, '0');
    stripMs   = String(Math.floor(rem % 1000)).padStart(3, '0');
    stripRafId = requestAnimationFrame(stripTick);
  }

  async function pollTimerGlobal() {
    try {
      const data = await dbGet('timer/endsAt');
      const val = (typeof data === 'number') ? data : null;
      if (val !== timerEndsAt) {
        timerEndsAt = val;
        if (val && val !== lastAlertedEndsAt) lastAlertedEndsAt = null;
        if (stripRafId) cancelAnimationFrame(stripRafId);
        stripRafId = val ? requestAnimationFrame(stripTick) : null;
        if (!val) stripRunning = false;
      }
    } catch {}
  }

  function checkTimerExpiry() {
    if (timerEndsAt && timerEndsAt !== lastAlertedEndsAt && !isConsole) {
      if (Date.now() >= timerEndsAt) {
        lastAlertedEndsAt = timerEndsAt;
        try { new Audio(`${base}/sounds/once_sound.mp3`).play(); } catch {}
      }
    }
    timerCheckId = setTimeout(checkTimerExpiry, 100);
  }

  onMount(async () => {
    if (browser) {
      const { startClock } = await import('$lib/wire-clock.js');
      clockCleanup = startClock();
      pollTimerGlobal();
      timerPoll = visibilityAwareInterval(pollTimerGlobal, 4000);
      checkTimerExpiry();
    }
  });

  onDestroy(() => {
    if (clockCleanup) clockCleanup();
    if (timerPoll) timerPoll();
    clearTimeout(timerCheckId);
    if (stripRafId) cancelAnimationFrame(stripRafId);
  });
</script>

<!-- Each page renders its own wire-status-bar with the attributes it needs.
     The layout only handles the clock and wire-home-bar. -->
<slot />

{#if stripRunning && !isConsole && !isTimerPage}
  <a class="timer-strip" href="{base}/timer" aria-label="Operation timer: {stripMins}:{stripSecs}">
    <span class="timer-strip-dot" aria-hidden="true"></span>
    <span class="timer-strip-label">OPERATION TIMER</span>
    <span class="timer-strip-clock">
      <span class="timer-strip-main">{stripMins}:{stripSecs}</span><span class="timer-strip-ms">.{stripMs}</span>
    </span>
  </a>
{/if}

{#if !isConsole}
  <wire-home-bar layout="flex"></wire-home-bar>
{/if}

<style>
  /* Global resets — applied once by the root layout */
  :global(*, *::before, *::after) {
    box-sizing: border-box;
  }
  :global(html, body) {
    margin: 0;
    height: 100%;
    overflow: hidden; /* prevent window-level scroll; all scrolling in designated containers */
  }
  :global(body) {
    display: flex;
    flex-direction: column;
    height: 100vh;
    background: #0d1118;
    font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif;
  }

  /* ── Persistent timer strip ───────────────────────────────────────────── */
  .timer-strip {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 9px;
    padding: 0 20px;
    height: 38px;
    background: #0d0a07;
    border-top: 1px solid rgba(224, 90, 58, 0.32);
    text-decoration: none;
    color: inherit;
  }
  .timer-strip-dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: #e05a3a;
    flex-shrink: 0;
    animation: strip-dot-blink 0.85s ease-in-out infinite;
  }
  @keyframes strip-dot-blink {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0.12; }
  }
  .timer-strip-label {
    font-family: 'Courier New', Courier, monospace;
    font-size: 8px;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: rgba(224, 90, 58, 0.4);
    flex: 1;
  }
  .timer-strip-main {
    font-family: 'Courier New', Courier, monospace;
    font-size: 22px;
    font-weight: 700;
    color: #e05a3a;
    letter-spacing: -1px;
    font-variant-numeric: tabular-nums;
  }
  .timer-strip-ms {
    font-family: 'Courier New', Courier, monospace;
    font-size: 11px;
    font-weight: 700;
    color: rgba(224, 90, 58, 0.32);
    font-variant-numeric: tabular-nums;
  }
</style>
