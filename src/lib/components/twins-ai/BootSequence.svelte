<script>
  // Cinematic pre-roll played once when a takeover begins: a hard-cut-to-
  // black "cold open" line of dialogue, a logo cross-fade, then a ~9s main
  // phase (sync-bar fill + screen shake + cascading warning popups) with
  // boot terminal lines printing throughout. Dispatches `done` when finished
  // so the parent can swap in the HUD.
  //
  // prefers-reduced-motion rule (matches the reference module): keep state
  // changes, skip animated waits. The cold open is dropped entirely; the
  // logo's fade-in class is still applied but its hold is skipped; the main
  // phase still runs its full duration (so boot lines have time to print)
  // but the bar snaps to 100% instantly with no shake/popups.

  import { onMount, createEventDispatcher } from 'svelte';
  import { COLD_OPEN_LINES, BOOT_LINES } from '$lib/data/twins-ai-content.js';

  export let reducedMotion = false;

  const dispatch = createEventDispatcher();

  const COLD_OPEN_CHAR_MS = 40;
  const COLD_OPEN_PAUSE_MS = 1400;
  const COLD_OPEN_HOLD_MS = 600;
  const LOGO_FADE_MS = 1800;
  const LOGO_HOLD_MS = 400;
  const MAIN_DURATION_MS = 6000;
  const SHAKE_START_PX = 1;
  const SHAKE_END_PX = 10;
  const POPUP_MAX = 18;

  let stage = 'cold'; // 'cold' | 'logo' | 'main'
  let coldLine1 = '';
  let coldLine2 = '';
  let coldShowLine2 = false;
  let logoIn = false;
  let barPct = 0;
  let shakeX = 0;
  let shakeY = 0;
  let popups = [];
  let popupId = 0;
  let bootLines = [];

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  async function typeLine(text, onTick) {
    for (let i = 1; i <= text.length; i++) {
      onTick(text.slice(0, i));
      await wait(COLD_OPEN_CHAR_MS);
    }
  }

  async function playColdOpen() {
    if (reducedMotion) return;
    stage = 'cold';
    await typeLine(COLD_OPEN_LINES[0], (v) => (coldLine1 = v));
    await wait(COLD_OPEN_PAUSE_MS);
    coldShowLine2 = true;
    await typeLine(COLD_OPEN_LINES[1], (v) => (coldLine2 = v));
    await wait(COLD_OPEN_HOLD_MS);
  }

  async function playLogoReveal() {
    stage = 'logo';
    logoIn = true;
    if (!reducedMotion) await wait(LOGO_FADE_MS + LOGO_HOLD_MS);
  }

  async function playMainPhase() {
    stage = 'main';
    const startTime = performance.now();
    let rafId = null;
    let popupTimer = null;
    let shakeTimer = null;

    function ease(t) { return t * t; }

    function frame() {
      const elapsed = performance.now() - startTime;
      const t = Math.min(elapsed / MAIN_DURATION_MS, 1);
      barPct = reducedMotion ? 100 : t * 100;
      if (t < 1) rafId = requestAnimationFrame(frame);
    }

    function shake() {
      const elapsed = performance.now() - startTime;
      const t = Math.min(elapsed / MAIN_DURATION_MS, 1);
      const amp = SHAKE_START_PX + ease(t) * (SHAKE_END_PX - SHAKE_START_PX);
      shakeX = (Math.random() * 2 - 1) * amp;
      shakeY = (Math.random() * 2 - 1) * amp;
      const nextDelay = 110 - ease(t) * 85;
      if (elapsed < MAIN_DURATION_MS) shakeTimer = setTimeout(shake, nextDelay);
      else { shakeX = 0; shakeY = 0; }
    }

    function popupLoop() {
      const elapsed = performance.now() - startTime;
      const t = Math.min(elapsed / MAIN_DURATION_MS, 1);
      if (popups.length < POPUP_MAX) {
        const id = popupId++;
        popups = [...popups, { id, x: Math.random() * 80 + 5, y: Math.random() * 70 + 10 }];
        setTimeout(() => { popups = popups.filter((p) => p.id !== id); }, 900);
      }
      const nextDelay = 250 - ease(t) * 150;
      if (elapsed < MAIN_DURATION_MS) popupTimer = setTimeout(popupLoop, nextDelay);
    }

    if (reducedMotion) {
      barPct = 100;
    } else {
      rafId = requestAnimationFrame(frame);
      shake();
      popupLoop();
    }

    // Boot terminal lines print on a fixed cadence regardless of motion
    // preference — only the frame-by-frame animation above is skipped.
    const perLine = MAIN_DURATION_MS / BOOT_LINES.length;
    const feedPromise = (async () => {
      for (const line of BOOT_LINES) {
        bootLines = [...bootLines, line];
        await wait(perLine);
      }
    })();

    await Promise.all([wait(MAIN_DURATION_MS), feedPromise]);

    if (rafId) cancelAnimationFrame(rafId);
    if (shakeTimer) clearTimeout(shakeTimer);
    if (popupTimer) clearTimeout(popupTimer);
    shakeX = 0;
    shakeY = 0;
    popups = [];
  }

  onMount(() => {
    (async () => {
      await playColdOpen();
      await playLogoReveal();
      await playMainPhase();
      dispatch('done');
    })();
  });
</script>

<div class="boot" class:boot--cold={stage === 'cold'}>
  {#if stage === 'cold'}
    <div class="boot-cold">
      <div class="boot-cold-line">{coldLine1}</div>
      {#if coldShowLine2}
        <div class="boot-cold-line">{coldLine2}</div>
      {/if}
    </div>
  {:else}
    <div class="boot-logo" class:in={logoIn}>THE TWINS</div>

    {#if stage === 'main'}
      <div class="boot-main" style="transform: translate({shakeX}px, {shakeY}px)">
        <div class="boot-bar-track">
          <div class="boot-bar-fill" style="width: {barPct}%"></div>
        </div>

        <div class="boot-terminal">
          {#each bootLines as line, i (i)}
            <div class="boot-terminal-line">{line}</div>
          {/each}
        </div>

        {#each popups as p (p.id)}
          <div class="boot-popup" style="left:{p.x}%; top:{p.y}%">// WARNING</div>
        {/each}
      </div>
    {/if}
  {/if}
</div>

<style>
  .boot {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: #000;
    color: var(--twins-ink, #eafff2);
    font-family: 'Courier New', Courier, monospace;
    overflow: hidden;
  }

  .boot-cold-line {
    font-size: 14px;
    letter-spacing: 0.5px;
    min-height: 20px;
    text-align: center;
    padding: 0 24px;
  }

  .boot-logo {
    font-size: 28px;
    font-weight: 700;
    letter-spacing: 6px;
    color: var(--twins-accent, #3dffa0);
    opacity: 0;
    transition: opacity 1.8s ease;
    text-shadow: 0 0 14px rgba(61, 255, 160, 0.55);
  }
  .boot-logo.in { opacity: 1; }

  .boot-main {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-end;
    padding-bottom: 15%;
    gap: 14px;
  }

  .boot-bar-track {
    width: 70%;
    max-width: 320px;
    height: 3px;
    background: rgba(234, 255, 242, 0.15);
    overflow: hidden;
  }
  .boot-bar-fill {
    height: 100%;
    background: var(--twins-accent, #3dffa0);
  }

  .boot-terminal {
    width: 80%;
    max-width: 340px;
    font-size: 10.5px;
    letter-spacing: 1px;
    color: rgba(234, 255, 242, 0.65);
    text-align: left;
  }
  .boot-terminal-line { padding: 1px 0; }

  .boot-popup {
    position: absolute;
    font-size: 9.5px;
    letter-spacing: 1px;
    color: var(--twins-danger, #ff3d5e);
    border: 1px solid var(--twins-danger, #ff3d5e);
    padding: 2px 6px;
    background: rgba(255, 61, 94, 0.08);
    pointer-events: none;
  }

  @media (prefers-reduced-motion: reduce) {
    .boot-logo { transition-duration: 0.01ms; }
  }
</style>
