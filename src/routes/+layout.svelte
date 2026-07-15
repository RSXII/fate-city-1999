<script>
  import { onMount, onDestroy } from 'svelte';
  import { browser } from '$app/environment';
  import { page } from '$app/stores';
  import { base } from '$app/paths';
  import { dbGet } from '$lib/firebase-db.js';
  import { visibilityAwareInterval } from '$lib/utils.js';

  $: isConsole = $page.route.id?.startsWith('/gm-console');

  let clockCleanup;

  // ── Global timer expiry sound ─────────────────────────────────────────────
  let timerEndsAt = null;
  let lastAlertedEndsAt = null;
  let timerPoll;
  let timerCheckId;

  async function pollTimerGlobal() {
    try {
      const data = await dbGet('timer/endsAt');
      const val = (typeof data === 'number') ? data : null;
      if (val !== timerEndsAt) {
        timerEndsAt = val;
        if (val && val !== lastAlertedEndsAt) lastAlertedEndsAt = null; // reset on new timer
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
  });
</script>

<!-- Each page renders its own wire-status-bar with the attributes it needs.
     The layout only handles the clock and wire-home-bar. -->
<slot />

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
</style>
