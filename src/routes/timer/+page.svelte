<script>
  import { base } from '$app/paths';
  import { browser } from '$app/environment';
  import { onMount, onDestroy } from 'svelte';
  import { dbGet } from '$lib/firebase-db.js';
  import { visibilityAwareInterval } from '$lib/utils.js';

  let endsAt = null;
  let mins = '--';
  let secs = '--';
  let ms   = '---';
  let status = 'none'; // 'none' | 'running' | 'expired'
  let rafId = null;
  let pollInterval;

  function tick() {
    if (!endsAt) {
      mins = '--'; secs = '--'; ms = '---';
      status = 'none';
      return;
    }
    const remaining = endsAt - Date.now();
    if (remaining <= 0) {
      mins = '00'; secs = '00'; ms = '000';
      status = 'expired';
      return; // stop looping — layout handles the sound globally
    }
    status = 'running';
    const totalSec = Math.floor(remaining / 1000);
    mins = String(Math.floor(totalSec / 60)).padStart(2, '0');
    secs = String(totalSec % 60).padStart(2, '0');
    ms   = String(Math.floor(remaining % 1000)).padStart(3, '0');
    rafId = requestAnimationFrame(tick);
  }

  async function fetchTimer() {
    try {
      const data = await dbGet('timer/endsAt');
      const val = (typeof data === 'number') ? data : null;
      if (val !== endsAt) {
        endsAt = val;
        if (rafId) cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(tick);
      }
    } catch {}
  }

  onMount(() => {
    if (!browser) return;
    fetchTimer();
    pollInterval = visibilityAwareInterval(fetchTimer, 4000);
    rafId = requestAnimationFrame(tick);
  });

  onDestroy(() => {
    if (pollInterval) pollInterval();
    if (rafId) cancelAnimationFrame(rafId);
  });
</script>

<svelte:head>
  <title>Fate City: 1999 — Timer</title>
</svelte:head>

<wire-status-bar jail layout="flex"></wire-status-bar>
<wire-header back="{base}/home" title="Operation Timer" layout="flex"></wire-header>

<div class="timer-wrap">
  <div class="timer-display" class:running={status === 'running'} class:expired={status === 'expired'}>

    <div class="timer-eyebrow">// OPERATION TIMER</div>

    <div class="timer-digits">
      <span class="timer-main">{mins}:{secs}</span><span class="timer-msec">.{ms}</span>
    </div>

    <div class="timer-status-row">
      {#if status === 'running'}
        <span class="status-dot status-dot--run"></span>RUNNING
      {:else if status === 'expired'}
        <span class="status-dot status-dot--exp"></span>EXPIRED — SIGNAL LOST
      {:else}
        <span class="status-dot status-dot--none"></span>STANDBY
      {/if}
    </div>

  </div>
</div>

<style>
  .timer-wrap {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #080b10;
    padding: 24px;
  }

  .timer-display {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 20px;
    padding: 48px 40px;
    border: 1px solid rgba(201, 162, 39, 0.18);
    border-radius: 12px;
    background: rgba(0, 0, 0, 0.35);
    min-width: 290px;
    transition: border-color 0.4s ease, box-shadow 0.4s ease;
  }

  .timer-display.running {
    border-color: rgba(201, 162, 39, 0.45);
    box-shadow: 0 0 50px rgba(201, 162, 39, 0.08), inset 0 0 30px rgba(201, 162, 39, 0.03);
  }

  .timer-display.expired {
    border-color: rgba(224, 90, 58, 0.65);
    box-shadow: 0 0 70px rgba(224, 90, 58, 0.2), inset 0 0 30px rgba(224, 90, 58, 0.06);
    animation: expired-pulse 1.2s ease-in-out infinite;
  }

  @keyframes expired-pulse {
    0%, 100% { box-shadow: 0 0 70px rgba(224, 90, 58, 0.2); }
    50%       { box-shadow: 0 0 100px rgba(224, 90, 58, 0.45); }
  }

  .timer-eyebrow {
    font-family: 'Courier New', Courier, monospace;
    font-size: 9px;
    letter-spacing: 2.5px;
    text-transform: uppercase;
    color: rgba(201, 162, 39, 0.38);
  }

  .timer-display.expired .timer-eyebrow { color: rgba(224, 90, 58, 0.45); }

  .timer-digits {
    display: flex;
    align-items: flex-end;
    line-height: 1;
  }

  .timer-main {
    font-family: 'Courier New', Courier, monospace;
    font-size: 84px;
    font-weight: 700;
    color: #c9a227;
    letter-spacing: -4px;
    font-variant-numeric: tabular-nums;
    line-height: 1;
  }

  .timer-msec {
    font-family: 'Courier New', Courier, monospace;
    font-size: 34px;
    font-weight: 700;
    color: rgba(201, 162, 39, 0.38);
    letter-spacing: -1px;
    font-variant-numeric: tabular-nums;
    padding-bottom: 10px;
  }

  .timer-display.expired .timer-main { color: #e05a3a; }
  .timer-display.expired .timer-msec  { color: rgba(224, 90, 58, 0.4); }

  .timer-status-row {
    font-family: 'Courier New', Courier, monospace;
    font-size: 10px;
    letter-spacing: 3px;
    text-transform: uppercase;
    color: rgba(232, 223, 200, 0.22);
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .timer-display.running .timer-status-row { color: rgba(201, 162, 39, 0.65); }
  .timer-display.expired .timer-status-row { color: rgba(224, 90, 58, 0.7); }

  .status-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: currentColor;
    flex-shrink: 0;
  }

  .status-dot--run { animation: dot-blink 1.2s ease-in-out infinite; }

  @keyframes dot-blink {
    0%, 100% { opacity: 0.35; }
    50%       { opacity: 1; }
  }
</style>
