<script>
  // Twins AI HUD — corner-bracket frame, uplink readout, running clock,
  // Active Links chip row, and CPU/MEM meters with two small bar-graphs.
  //
  // Meter values are simulated on a plain setTimeout-reschedule loop (the
  // reference module's own cadence is 450-700ms, far below frame rate, so
  // requestAnimationFrame would be wasted work here). CPU has a real-state
  // floor derived from `totalActive`/`cap` — passed down from the layout's
  // own poll — so it can never drift from the GM's live roster; MEM is
  // pure idle jitter.

  import { onMount, onDestroy } from 'svelte';
  import { TAKEOVER_CAP } from '$lib/data/twins-ai.js';
  import { AI_NAME } from '$lib/data/twins-ai-content.js';

  export let entry = null;        // { codename, seizedAt, intrusion }
  export let totalActive = 0;
  export let cap = TAKEOVER_CAP;

  let clockText = 'T+ 00:00.000';
  let clockTimer;

  let cpu = 0;
  let mem = 0;
  let meterTimer;
  let cpuCanvas;
  let memCanvas;
  let cpuBars = Array(16).fill(0.2);
  let memBars = Array(16).fill(0.2);

  $: chips = Array.from({ length: cap }, (_, i) => i < Math.min(totalActive, cap));

  function tickClock() {
    const start = entry?.seizedAt ?? Date.now();
    const rem = Math.max(0, Date.now() - start);
    const totalMs = rem;
    const mins = Math.floor(totalMs / 60000);
    const secs = Math.floor((totalMs % 60000) / 1000);
    const ms = Math.floor(totalMs % 1000);
    clockText = `T+ ${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
    clockTimer = requestAnimationFrame(tickClock);
  }

  function cpuFloor() {
    return 2 + Math.min(totalActive, cap) * 10;
  }

  function drawBars(canvas, bars) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    const barW = w / bars.length;
    ctx.fillStyle = 'var(--twins-accent, #3dffa0)';
    bars.forEach((v, i) => {
      const barH = Math.max(1, v * h);
      ctx.fillRect(i * barW + 1, h - barH, barW - 2, barH);
    });
  }

  function tickMeters() {
    cpu = Math.min(100, cpuFloor() + Math.random() * 6);
    mem = Math.min(100, 14 + Math.random() * 12);

    cpuBars = [...cpuBars.slice(1), Math.min(1, cpu / 100 + Math.random() * 0.1)];
    memBars = [...memBars.slice(1), Math.min(1, mem / 100 + Math.random() * 0.1)];
    drawBars(cpuCanvas, cpuBars);
    drawBars(memCanvas, memBars);

    meterTimer = setTimeout(tickMeters, 450 + Math.random() * 250);
  }

  onMount(() => {
    tickClock();
    tickMeters();
  });

  onDestroy(() => {
    if (clockTimer) cancelAnimationFrame(clockTimer);
    if (meterTimer) clearTimeout(meterTimer);
  });
</script>

<div class="hud">
  <i class="hud-corner tl" aria-hidden="true"></i>
  <i class="hud-corner tr" aria-hidden="true"></i>
  <i class="hud-corner bl" aria-hidden="true"></i>
  <i class="hud-corner br" aria-hidden="true"></i>

  <div class="hud-message">User {AI_NAME} is requesting control of your device.</div>
  <div class="hud-clock">{clockText}</div>

  <div class="hud-chips" aria-label="Active links {Math.min(totalActive, cap)} of {cap}">
    {#each chips as filled, i (i)}
      <i class="hud-chip" class:filled></i>
    {/each}
  </div>

  <div class="hud-meters">
    <div class="hud-meter">
      <div class="hud-meter-label">CPU</div>
      <div class="hud-meter-track"><div class="hud-meter-fill" style="height:{cpu}%"></div></div>
      <canvas bind:this={cpuCanvas} width="56" height="22"></canvas>
    </div>
    <div class="hud-meter">
      <div class="hud-meter-label">MEM</div>
      <div class="hud-meter-track"><div class="hud-meter-fill" style="height:{mem}%"></div></div>
      <canvas bind:this={memCanvas} width="56" height="22"></canvas>
    </div>
  </div>
</div>

<style>
  .hud {
    position: relative;
    width: 88%;
    max-width: 360px;
    padding: 20px;
    color: var(--twins-ink, #eafff2);
    font-family: 'Courier New', Courier, monospace;
    text-align: center;
  }

  .hud-corner {
    position: absolute;
    width: 22px;
    height: 22px;
    border-color: var(--twins-accent, #3dffa0);
    filter: drop-shadow(0 0 4px var(--twins-accent, #3dffa0));
    animation: hud-corner-pulse 2.6s ease-in-out infinite;
  }
  .hud-corner.tl { top: -6px; left: -6px; border-top: 2px solid; border-left: 2px solid; }
  .hud-corner.tr { top: -6px; right: -6px; border-top: 2px solid; border-right: 2px solid; }
  .hud-corner.bl { bottom: -6px; left: -6px; border-bottom: 2px solid; border-left: 2px solid; }
  .hud-corner.br { bottom: -6px; right: -6px; border-bottom: 2px solid; border-right: 2px solid; }
  @keyframes hud-corner-pulse {
    0%, 100% { opacity: 0.65; }
    50% { opacity: 1; }
  }

  .hud-message {
    font-size: 13.5px;
    line-height: 1.4;
    letter-spacing: 0.5px;
    color: var(--twins-ink, #eafff2);
    margin-bottom: 14px;
    padding: 0 8px;
  }

  .hud-clock {
    font-size: 20px;
    letter-spacing: 1.5px;
    margin-bottom: 14px;
    color: var(--twins-accent, #3dffa0);
  }

  .hud-chips {
    display: flex;
    justify-content: center;
    gap: 5px;
    margin-bottom: 16px;
  }
  .hud-chip {
    width: 14px;
    height: 6px;
    background: rgba(234, 255, 242, 0.12);
    border: 1px solid rgba(234, 255, 242, 0.25);
  }
  .hud-chip.filled {
    background: var(--twins-accent, #3dffa0);
    border-color: var(--twins-accent, #3dffa0);
  }

  .hud-meters {
    display: flex;
    justify-content: center;
    gap: 24px;
  }
  .hud-meter {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }
  .hud-meter-label {
    font-size: 9px;
    letter-spacing: 1px;
    color: rgba(234, 255, 242, 0.55);
  }
  .hud-meter-track {
    width: 8px;
    height: 44px;
    background: rgba(234, 255, 242, 0.1);
    display: flex;
    align-items: flex-end;
  }
  .hud-meter-fill {
    width: 100%;
    background: var(--twins-accent, #3dffa0);
  }

  @media (prefers-reduced-motion: reduce) {
    .hud-corner { animation: none; opacity: 1; }
  }
</style>
