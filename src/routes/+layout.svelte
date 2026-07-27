<script>
  import { onMount, onDestroy } from 'svelte';
  import { browser } from '$app/environment';
  import { page } from '$app/stores';
  import { base } from '$app/paths';
  import { dbGet, dbDelete } from '$lib/firebase-db.js';
  import { visibilityAwareInterval, getCodename } from '$lib/utils.js';

  $: isConsole = $page.route.id?.startsWith('/ops-7e4f');
  $: isTimerPage = $page.route.id?.startsWith('/timer');

  let clockCleanup;

  // ── Global timer expiry sound ─────────────────────────────────────────────
  let timerEndsAt = null;
  let lastAlertedEndsAt = null;
  let timerPoll;
  let timerCheckId;

  // ── Timer display state ───────────────────────────────────────────────────
  let stripRunning = false;
  let stripMins = '00';
  let stripSecs = '00';
  let stripMs  = '000';
  let stripRafId = null;

  let panicMode   = false;   // last 10 seconds — full-screen countdown
  let timesUp     = false;   // timer hit zero — overlay persists until GM clears
  let panicSecs   = '10';
  let panicMs     = '000';

  function stripTick() {
    if (!timerEndsAt) { stripRunning = false; panicMode = false; stripRafId = null; return; }
    const rem = timerEndsAt - Date.now();

    if (rem <= 0) {
      stripRunning = false; panicMode = false; stripRafId = null;
      stripMins = '00'; stripSecs = '00'; stripMs = '000';
      if (!timesUp) timesUp = true;
      return;
    }

    stripRunning = true;
    const ts = Math.floor(rem / 1000);
    stripMins = String(Math.floor(ts / 60)).padStart(2, '0');
    stripSecs = String(ts % 60).padStart(2, '0');
    stripMs   = String(Math.floor(rem % 1000)).padStart(3, '0');

    // Last 10 seconds: panic mode
    if (rem <= 10000) {
      panicMode = true;
      panicSecs = String(ts % 60).padStart(2, '0');
      panicMs   = String(Math.floor(rem % 1000)).padStart(3, '0');
    } else {
      panicMode = false;
    }

    stripRafId = requestAnimationFrame(stripTick);
  }

  async function pollTimerGlobal() {
    try {
      const data = await dbGet('timer/endsAt');
      const val = (typeof data === 'number') ? data : null;
      if (val !== timerEndsAt) {
        timerEndsAt = val;
        if (val && val !== lastAlertedEndsAt) lastAlertedEndsAt = null;
        // Reset all overlay states when GM changes the timer
        panicMode = false;
        timesUp   = false;
        if (stripRafId) cancelAnimationFrame(stripRafId);
        stripRafId = val ? requestAnimationFrame(stripTick) : null;
        if (!val) stripRunning = false;
      }
    } catch {}
  }

  // ── Incoming call ─────────────────────────────────────────────────────────────
  let incomingCallData = null;
  let callState = null;          // null | 'ringing' | 'connected'
  let incomingCallPoll;
  let ringtoneAudio = null;

  function playRingtone() {
    stopRingtone();
    try {
      ringtoneAudio = new Audio(`${base}/sounds/ringtone.mp3`);
      ringtoneAudio.loop = true;
      ringtoneAudio.play().catch(() => {});
    } catch {}
  }

  function stopRingtone() {
    if (ringtoneAudio) {
      ringtoneAudio.pause();
      ringtoneAudio.currentTime = 0;
      ringtoneAudio = null;
    }
  }

  async function pollIncomingCall() {
    try {
      const data = await dbGet('incomingCall');
      const codename = getCodename();
      const callActive = data && data.active && data.targetCodename === codename;
      if (callActive && !callState) {
        incomingCallData = data;
        callState = 'ringing';
        playRingtone();
      } else if (!callActive && callState) {
        stopRingtone();
        callState = null;
        incomingCallData = null;
      }
    } catch {}
  }

  async function acceptCall() {
    stopRingtone();
    callState = 'connected';
  }

  async function declineCall() {
    stopRingtone();
    callState = null;
    incomingCallData = null;
    try { await dbDelete('incomingCall'); } catch {}
  }

  async function hangUpCall() {
    callState = null;
    incomingCallData = null;
    try { await dbDelete('incomingCall'); } catch {}
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
      pollIncomingCall();
      incomingCallPoll = visibilityAwareInterval(pollIncomingCall, 4000);
    }
  });

  onDestroy(() => {
    if (clockCleanup) clockCleanup();
    if (timerPoll) timerPoll();
    clearTimeout(timerCheckId);
    if (stripRafId) cancelAnimationFrame(stripRafId);
    if (incomingCallPoll) incomingCallPoll();
    stopRingtone();
  });
</script>

<slot />

{#if panicMode && !isConsole}
  <div class="timer-panic" aria-live="assertive" aria-label="Timer critical: {panicSecs} seconds remaining">
    <div class="panic-eyebrow">
      <span class="panic-dot" aria-hidden="true"></span>// TIMER CRITICAL
    </div>
    <div class="panic-clock">
      <span class="panic-main">{panicSecs}</span><span class="panic-ms">.{panicMs}</span>
    </div>
  </div>
{/if}

{#if timesUp && !isConsole}
  <div class="timer-timesup" role="alertdialog" aria-label="Time's up — operation terminated">
    <div class="timesup-scanline" aria-hidden="true"></div>
    <div class="timesup-sys">// OPERATION TERMINATED</div>
    <div class="timesup-divider" aria-hidden="true"></div>
    <div class="timesup-title">TIME'S UP</div>
    <div class="timesup-sub">COUNTDOWN REACHED ZERO</div>
  </div>
{/if}

{#if stripRunning && !isConsole && !isTimerPage && !panicMode}
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

{#if callState && !isConsole}
  <div class="incoming-call-overlay">

    <div class="ic-top-label">
      {callState === 'ringing' ? 'Incoming Call' : 'Connected'}
    </div>

    <div class="ic-identity">
      <div class="ic-avatar-wrap">
        {#if callState === 'ringing'}
          <div class="ic-ring ic-ring--1"></div>
          <div class="ic-ring ic-ring--2"></div>
        {/if}
        <div class="ic-avatar" style="background:{incomingCallData?.callerColor ?? '#c9a227'}">
          {#if incomingCallData?.callerAvatar}
            <img src="{base}/{incomingCallData.callerAvatar}" alt={incomingCallData?.callerName ?? ''} />
          {:else}
            {incomingCallData?.callerName?.[0]?.toUpperCase() ?? '?'}
          {/if}
        </div>
      </div>
      <div class="ic-name">{incomingCallData?.callerName ?? 'Unknown'}</div>
      {#if incomingCallData?.callerSubtitle}
        <div class="ic-subtitle">{incomingCallData.callerSubtitle}</div>
      {/if}
    </div>

    <div class="ic-bottom">
      {#if callState === 'ringing'}
        <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
        <div class="ic-action-col">
          <div class="ic-btn ic-btn--decline" on:click={declineCall} aria-label="Decline call">
            <svg viewBox="0 0 24 24" width="30" height="30" fill="white" aria-hidden="true">
              <path d="M17.3 20h-2.7l-1.4-3.8 2-1.6a12.3 12.3 0 0 0-5.8-5.8L7.8 11 4 9.7V7a2 2 0 0 1 2-2C12.9 5 19 11.1 19 18a2 2 0 0 1-2 2z" transform="rotate(135 12 12)" />
            </svg>
          </div>
          <span class="ic-action-label">Decline</span>
        </div>
        <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
        <div class="ic-action-col">
          <div class="ic-btn ic-btn--accept" on:click={acceptCall} aria-label="Accept call">
            <svg viewBox="0 0 24 24" width="28" height="28" fill="white" aria-hidden="true">
              <path d="M6.7 4h2.7l1.4 3.8-2 1.6a12.3 12.3 0 0 0 5.8 5.8l1.6-2 3.8 1.4v2.7a2 2 0 0 1-2 2C10.8 19.3 4.7 13.2 4.7 6a2 2 0 0 1 2-2z" />
            </svg>
          </div>
          <span class="ic-action-label">Accept</span>
        </div>
      {:else}
        <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
        <div class="ic-action-col">
          <div class="ic-btn ic-btn--hangup" on:click={hangUpCall} aria-label="Hang up">
            <svg viewBox="0 0 24 24" width="30" height="30" fill="white" aria-hidden="true">
              <path d="M17.3 20h-2.7l-1.4-3.8 2-1.6a12.3 12.3 0 0 0-5.8-5.8L7.8 11 4 9.7V7a2 2 0 0 1 2-2C12.9 5 19 11.1 19 18a2 2 0 0 1-2 2z" transform="rotate(135 12 12)" />
            </svg>
          </div>
          <span class="ic-action-label">Hang Up</span>
        </div>
      {/if}
    </div>

  </div>
{/if}

<style>
  /* Global resets — applied once by the root layout */
  :global(*, *::before, *::after) {
    box-sizing: border-box;
  }
  :global(html, body) {
    margin: 0;
    height: 100%;
    overflow: hidden;
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

  /* ── Panic mode — last 10 seconds ────────────────────────────────────── */
  .timer-panic {
    position: fixed;
    inset: 0;
    z-index: 1500;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    animation: panic-bg 0.18s steps(1) infinite;
  }
  @keyframes panic-bg {
    0%  { background: #060000; }
    50% { background: #130000; }
  }
  .timer-panic::before {
    content: '';
    position: absolute;
    inset: 0;
    border: 2px solid transparent;
    pointer-events: none;
    animation: panic-border 0.18s steps(1) infinite;
  }
  @keyframes panic-border {
    0%  { border-color: rgba(255, 20, 20, 0.2); }
    50% { border-color: rgba(255, 20, 20, 0.7); }
  }
  .panic-eyebrow {
    font-family: 'Courier New', Courier, monospace;
    font-size: 10px;
    letter-spacing: 3.5px;
    text-transform: uppercase;
    color: rgba(255, 40, 40, 0.55);
    display: flex;
    align-items: center;
    gap: 8px;
    animation: panic-text 0.18s steps(1) infinite;
  }
  @keyframes panic-text {
    0%  { opacity: 0.55; }
    50% { opacity: 1; }
  }
  .panic-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #ff2424;
    flex-shrink: 0;
    animation: panic-text 0.18s steps(1) infinite;
  }
  .panic-clock {
    display: flex;
    align-items: flex-end;
    gap: 2px;
    line-height: 1;
  }
  .panic-main {
    font-family: 'Courier New', Courier, monospace;
    font-size: clamp(100px, 28vw, 180px);
    font-weight: 700;
    color: #ff2424;
    letter-spacing: -6px;
    font-variant-numeric: tabular-nums;
    line-height: 0.9;
    animation: panic-num 0.18s steps(1) infinite;
  }
  @keyframes panic-num {
    0%  { color: #ff2424; }
    50% { color: #ff7070; }
  }
  .panic-ms {
    font-family: 'Courier New', Courier, monospace;
    font-size: clamp(36px, 9vw, 60px);
    font-weight: 700;
    color: rgba(255, 36, 36, 0.38);
    font-variant-numeric: tabular-nums;
    padding-bottom: clamp(12px, 3vw, 22px);
    animation: panic-ms 0.18s steps(1) infinite;
  }
  @keyframes panic-ms {
    0%  { color: rgba(255, 36, 36, 0.38); }
    50% { color: rgba(255, 112, 112, 0.6); }
  }

  /* ── TIME'S UP overlay ────────────────────────────────────────────────── */
  .timer-timesup {
    position: fixed;
    inset: 0;
    z-index: 2000;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 14px;
    animation: timesup-bg 0.28s steps(1) infinite;
  }
  @keyframes timesup-bg {
    0%  { background-color: #070000; }
    50% { background-color: #180000; }
  }
  .timesup-scanline {
    position: absolute;
    inset: 0;
    pointer-events: none;
    background: repeating-linear-gradient(
      to bottom,
      transparent 0px, transparent 3px,
      rgba(0, 0, 0, 0.3) 3px, rgba(0, 0, 0, 0.3) 4px
    );
  }
  .timesup-sys {
    font-family: 'Courier New', Courier, monospace;
    font-size: 9px;
    letter-spacing: 3px;
    text-transform: uppercase;
    color: rgba(255, 30, 30, 0.45);
    animation: timesup-flick 0.28s steps(1) infinite;
  }
  @keyframes timesup-flick {
    0%  { opacity: 0.45; }
    50% { opacity: 1; }
  }
  .timesup-divider {
    width: 60px;
    height: 1px;
    background: rgba(255, 30, 30, 0.35);
    animation: timesup-flick 0.28s steps(1) infinite;
  }
  .timesup-title {
    font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif;
    font-size: clamp(52px, 14vw, 88px);
    font-weight: 900;
    letter-spacing: clamp(4px, 1.5vw, 10px);
    text-transform: uppercase;
    line-height: 1;
    animation: timesup-title 0.28s steps(1) infinite;
  }
  @keyframes timesup-title {
    0%  { color: #ff1a1a; }
    50% { color: #ff7070; }
  }
  .timesup-sub {
    font-family: 'Courier New', Courier, monospace;
    font-size: 9px;
    letter-spacing: 3px;
    text-transform: uppercase;
    color: rgba(255, 30, 30, 0.3);
    animation: timesup-flick 0.28s steps(1) infinite;
  }

  /* ── Incoming call overlay ────────────────────────────────────────────────── */
  .incoming-call-overlay {
    position: fixed;
    inset: 0;
    z-index: 300;
    display: flex;
    flex-direction: column;
    align-items: center;
    background: linear-gradient(180deg, #1a1a2e 0%, #0d0d1a 60%, #111 100%);
  }

  .ic-top-label {
    padding: 64px 24px 0;
    font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif;
    font-size: 16px;
    font-weight: 400;
    color: rgba(255, 255, 255, 0.55);
    letter-spacing: 0.5px;
    text-align: center;
  }

  .ic-identity {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 0 32px;
  }

  .ic-avatar-wrap {
    position: relative;
    width: 180px;
    height: 180px;
    margin-bottom: 8px;
  }

  .ic-ring {
    position: absolute;
    inset: -14px;
    border-radius: 50%;
    border: 2px solid rgba(255, 255, 255, 0.18);
    animation: ic-ring-pulse 1.5s ease-out infinite;
  }
  .ic-ring--2 { animation-delay: 0.5s; }

  @keyframes ic-ring-pulse {
    0%   { transform: scale(1); opacity: 0.7; }
    100% { transform: scale(1.4); opacity: 0; }
  }

  .ic-avatar {
    position: absolute;
    inset: 0;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif;
    font-size: 72px;
    font-weight: 600;
    color: #fff;
    overflow: hidden;
  }
  .ic-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: 50%;
  }

  .ic-name {
    font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif;
    font-size: 30px;
    font-weight: 300;
    color: #fff;
    text-align: center;
    letter-spacing: 0.3px;
  }
  .ic-subtitle {
    font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif;
    font-size: 14px;
    color: rgba(255, 255, 255, 0.45);
    text-align: center;
    margin-top: -6px;
  }

  .ic-bottom {
    padding: 0 24px 72px;
    display: flex;
    justify-content: center;
    gap: 48px;
  }

  .ic-action-col {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
  }

  .ic-action-label {
    font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif;
    font-size: 12px;
    color: rgba(255, 255, 255, 0.5);
    letter-spacing: 0.3px;
  }

  .ic-btn {
    width: 70px;
    height: 70px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: transform 0.08s ease, box-shadow 0.1s ease;
  }
  .ic-btn:active { transform: scale(0.92); }

  .ic-btn--decline {
    background: #e03e3e;
    box-shadow: 0 6px 24px rgba(224, 62, 62, 0.45);
  }
  .ic-btn--accept {
    background: #34c759;
    box-shadow: 0 6px 24px rgba(52, 199, 89, 0.45);
  }
  .ic-btn--hangup {
    background: #e03e3e;
    box-shadow: 0 6px 24px rgba(224, 62, 62, 0.45);
  }
</style>
