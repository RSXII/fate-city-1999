<script>
  import { base } from '$app/paths';
  import { browser } from '$app/environment';
  import { onMount } from 'svelte';

  let preBoot = true;   // dark power-on screen
  let showSplash = true; // S.K.AM boot splash (hidden behind pre-boot)
  let showWarning = false;
  let showGrid = false;

  onMount(() => {
    if (!browser) return;
    // If already booted this session, skip straight to home
    if (sessionStorage.getItem('wire-booted')) {
      window.location.replace(base + '/home');
    }
  });

  function handlePowerOn() {
    preBoot = false;

    const bootAudio = new Audio(base + '/sounds/boot.mp3');
    bootAudio.volume = 0.8;
    const jailbreakAudio = new Audio(base + '/sounds/jailbreak.mp3');
    jailbreakAudio.volume = 0.8;
    bootAudio.play().catch(() => {});

    setTimeout(() => { showSplash = false; }, 3100);
    setTimeout(() => {
      showWarning = true;
      jailbreakAudio.play().catch(() => {});
    }, 4250);
    setTimeout(() => {
      showWarning = false;
      showGrid = true;
      setTimeout(() => {
        sessionStorage.setItem('wire-booted', '1');
        window.location.replace(base + '/home');
      }, 800);
    }, 6650);
  }
</script>

<svelte:head>
  <title>Fate City: 1999 — Wire</title>
</svelte:head>

<!-- Pre-boot: dark power-on screen -->
{#if preBoot}
  <!-- svelte-ignore a11y-click-events-have-key-events a11y-interactive-supports-focus -->
  <div class="pre-boot" role="button" tabindex="0" on:click={handlePowerOn} on:keydown={e => e.key === 'Enter' && handlePowerOn()}>
    <div class="pre-boot-btn" aria-hidden="true">
      <svg viewBox="0 0 24 24" width="28" height="28" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 3v4M8.3 5.7A7 7 0 1 0 15.7 5.7" />
      </svg>
    </div>
    <span class="pre-boot-label">Power on</span>
  </div>
{/if}

<!-- Boot splash: S.K.AM branding + animated dots -->
{#if showSplash && !preBoot}
  <div class="boot-splash" class:hide={!showSplash}>
    <div class="boot-splash-top" aria-hidden="true"></div>
    <div class="boot-brand">S.K.AM</div>
    <div class="boot-tag">Wire &middot; Initializing</div>
    <div class="boot-dots">
      <span class="boot-dot"></span>
      <span class="boot-dot"></span>
      <span class="boot-dot"></span>
    </div>
  </div>
{/if}

<!-- Jailbreak warning flash -->
{#if showWarning}
  <div class="hs-warn-overlay">
    <div class="hs-warn-box">
      <span class="hs-warn-corner tl"></span>
      <span class="hs-warn-corner tr"></span>
      <span class="hs-warn-corner bl"></span>
      <span class="hs-warn-corner br"></span>
      <svg class="hs-warn-icon" viewBox="0 0 24 24" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M12 3.2L21.5 20H2.5L12 3.2z" stroke-linejoin="round" />
        <line x1="12" y1="9.5" x2="12" y2="14" />
        <circle cx="12" cy="16.8" r="0.6" fill="currentColor" stroke="none" />
      </svg>
      <div class="hs-warn-line">Unauthorized firmware detected</div>
      <div class="hs-warn-hr"></div>
      <div class="hs-warn-line">Device integrity unverified</div>
      <div class="hs-warn-hr"></div>
      <div class="hs-warn-big">Jailbroken</div>
    </div>
  </div>
{/if}

<style>
  /* Pre-boot */
  .pre-boot {
    position: fixed;
    inset: 0;
    background: #050709;
    z-index: 600;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    user-select: none;
  }
  .pre-boot-btn {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    border: 1.5px solid rgba(201, 162, 39, 0.25);
    display: flex;
    align-items: center;
    justify-content: center;
    color: rgba(201, 162, 39, 0.35);
    transition: border-color 0.2s ease, color 0.2s ease, box-shadow 0.2s ease;
  }
  .pre-boot:hover .pre-boot-btn {
    border-color: rgba(201, 162, 39, 0.6);
    color: rgba(201, 162, 39, 0.75);
    box-shadow: 0 0 20px rgba(201, 162, 39, 0.15);
  }
  .pre-boot:active .pre-boot-btn {
    border-color: rgba(201, 162, 39, 0.9);
    color: #c9a227;
    box-shadow: 0 0 30px rgba(201, 162, 39, 0.3);
  }
  .pre-boot-label {
    font-size: 9px;
    letter-spacing: 2.5px;
    text-transform: uppercase;
    color: rgba(201, 162, 39, 0.2);
  }

  /* Boot splash */
  .boot-splash {
    position: fixed;
    inset: 0;
    background: #0c0f16;
    z-index: 500;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 18px;
    transition: opacity 0.5s ease;
  }
  .boot-splash.hide {
    opacity: 0;
    pointer-events: none;
  }
  .boot-splash-top {
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 4px;
    background: #7c3aed;
  }
  .boot-brand {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 6px;
    text-transform: uppercase;
    color: #c9a227;
  }
  .boot-tag {
    font-size: 9px;
    letter-spacing: 2.5px;
    text-transform: uppercase;
    color: #2e3d4a;
    margin-top: -8px;
  }
  .boot-dots {
    display: flex;
    gap: 9px;
    margin-top: 2px;
  }
  .boot-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #7c3aed;
    animation: boot-pulse 1.2s ease-in-out infinite;
  }
  .boot-dot:nth-child(2) { animation-delay: 0.22s; }
  .boot-dot:nth-child(3) { animation-delay: 0.44s; }
  @keyframes boot-pulse {
    0%, 100% { opacity: 0.18; transform: scale(0.75); }
    50%       { opacity: 1;    transform: scale(1); }
  }

  /* Jailbreak warning overlay */
  .hs-warn-overlay {
    position: fixed;
    inset: 0;
    background: #0c0f16;
    z-index: 500;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 40px 22px;
  }
  .hs-warn-box {
    position: relative;
    width: 100%;
    max-width: 340px;
    border: 1px solid rgba(224, 90, 58, 0.32);
    border-radius: 4px;
    background: rgba(224, 90, 58, 0.07);
    box-shadow: 0 0 18px rgba(224, 90, 58, 0.22), inset 0 0 16px rgba(224, 90, 58, 0.08);
    padding: 20px 16px;
    text-align: center;
    animation: warn-pulse 0.9s ease-in-out infinite;
  }
  .hs-warn-corner {
    position: absolute;
    width: 13px;
    height: 13px;
    border: 2px solid rgba(224, 90, 58, 0.9);
  }
  .hs-warn-corner.tl { top: -2px; left: -2px; border-right: none; border-bottom: none; }
  .hs-warn-corner.tr { top: -2px; right: -2px; border-left: none; border-bottom: none; }
  .hs-warn-corner.bl { bottom: -2px; left: -2px; border-right: none; border-top: none; }
  .hs-warn-corner.br { bottom: -2px; right: -2px; border-left: none; border-top: none; }
  @keyframes warn-pulse {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0.3; }
  }
  .hs-warn-icon {
    width: 26px;
    height: 26px;
    color: #e05a3a;
    margin: 0 auto 10px;
    stroke: currentColor;
    fill: none;
  }
  .hs-warn-line {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 1.4px;
    text-transform: uppercase;
    color: #e05a3a;
  }
  .hs-warn-hr {
    height: 1px;
    width: 65%;
    background: rgba(224, 90, 58, 0.35);
    margin: 9px auto;
  }
  .hs-warn-big {
    font-size: 17px;
    font-weight: 700;
    letter-spacing: 3px;
    text-transform: uppercase;
    color: #e05a3a;
    margin-top: 4px;
  }
</style>
