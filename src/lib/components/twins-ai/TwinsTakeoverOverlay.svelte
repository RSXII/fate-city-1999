<script>
  // Twins AI device takeover — full-screen HUD shown on a seized player's
  // phone until the GM releases the device from the ops console.
  //
  // Stage 4: terminal input + intrusion escalation. A GM-triggered
  // intrusion (entry.intrusion) recolors the frame; typing the matching
  // `purge <HANDLE>` command resolves it by clearing that flag directly
  // from the player's own phone — consistent with this app's existing
  // client-side trust model (no server-side access control anywhere else
  // in the app either).
  //
  // Z-INDEX: 10000 — must stay above every other full-screen state in the
  // app (evernear/gacha use up to 9999).

  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { dbPatch } from '$lib/firebase-db.js';
  import { codenameKey } from '$lib/data/twins-ai.js';
  import BootSequence from './BootSequence.svelte';
  import Hud from './Hud.svelte';
  import TerminalLog from './TerminalLog.svelte';
  import TerminalInput from './TerminalInput.svelte';

  export let entry = null;       // { codename, seizedAt, intrusion }
  export let totalActive = 0;    // live count of all currently-seized devices

  let phase = 'boot'; // 'boot' | 'hud'
  let reducedMotion = false;
  let termLog;
  let lastResult = null;

  $: breach = !!entry?.intrusion;

  onMount(() => {
    if (browser) {
      reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
  });

  function handleEcho(e) {
    termLog?.enqueue(e.detail.text, { urgent: e.detail.urgent });
  }

  function handleResult(e) {
    lastResult = { text: e.detail.text, danger: e.detail.danger };
  }

  async function handleResolve() {
    if (!entry?.codename) return;
    try {
      await dbPatch(`twinsTakeover/${codenameKey(entry.codename)}`, { intrusion: null });
    } catch {}
  }
</script>

<div class="twins-overlay" class:breach role="alertdialog" aria-label="Device compromised">
  <div class="twins-tint" aria-hidden="true"></div>
  <div class="twins-vignette" aria-hidden="true"></div>
  <div class="twins-scanlines" aria-hidden="true"></div>

  {#if phase === 'boot'}
    <BootSequence {reducedMotion} on:done={() => (phase = 'hud')} />
  {:else}
    <div class="twins-content">
      {#if breach}
        <div class="twins-breach-banner">// SECURITY BREACH — {entry.intrusion.handle}</div>
      {/if}
      <Hud {entry} {totalActive} />
      <TerminalLog bind:this={termLog} {lastResult} />
      <TerminalInput
        codename={entry?.codename}
        intrusion={entry?.intrusion}
        on:echo={handleEcho}
        on:result={handleResult}
        on:resolve={handleResolve}
      />
    </div>
  {/if}
</div>

<style>
  .twins-overlay {
    position: fixed;
    inset: 0;
    z-index: 10000;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #05100b;
    color: var(--twins-ink, #eafff2);
    font-family: 'Courier New', Courier, monospace;
  }

  /* Visual layers stack purely by DOM order — no z-index/isolation on any
     of them, or the tint's mix-blend-mode stops compositing correctly. */
  .twins-tint {
    position: absolute;
    inset: 0;
    background: var(--twins-accent, #3dffa0);
    mix-blend-mode: saturation;
    opacity: 0.28;
  }
  .twins-vignette {
    position: absolute;
    inset: 0;
    background: radial-gradient(ellipse 75% 70% at 50% 48%, transparent 40%, rgba(0, 0, 0, 0.55) 100%);
  }
  .twins-scanlines {
    position: absolute;
    inset: 0;
    background: linear-gradient(to bottom, transparent 50%, rgba(0, 0, 0, 0.14) 51%);
    background-size: 100% 4px;
  }

  .twins-content {
    position: relative;
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 24px 0;
  }

  /* Intrusion state: a moderate pulse, not a hard strobe — the reference
     module's full-screen flash is a genuine photosensitivity hazard, not
     just a decorative choice, so this deviates from it deliberately. */
  .twins-overlay.breach .twins-vignette {
    background: radial-gradient(ellipse 75% 70% at 50% 48%, transparent 30%, rgba(255, 61, 94, 0.35) 100%);
    animation: twins-breach-pulse 1.2s ease-in-out infinite;
  }
  @keyframes twins-breach-pulse {
    0%, 100% { opacity: 0.6; }
    50% { opacity: 1; }
  }

  .twins-breach-banner {
    color: var(--twins-danger, #ff3d5e);
    font-size: 11px;
    letter-spacing: 1.5px;
    margin-bottom: 10px;
    text-align: center;
  }

  @media (prefers-reduced-motion: reduce) {
    .twins-overlay.breach .twins-vignette {
      animation: none;
      opacity: 1;
    }
  }
</style>
