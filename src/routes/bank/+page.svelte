<script>
  import { base } from '$app/paths';
  import { browser } from '$app/environment';
  import { onMount } from 'svelte';
  import { dbGet, dbPut } from '$lib/firebase-db.js';
  import { getCodename } from '$lib/utils.js';

  let codename = '';
  let accountNumber = '';
  let balance = 0;
  let loading = true;
  let error = '';

  let frozen = false;
  let subscriptions = {};

  let adjustAmount = '';
  let adjusting = false;
  let adjustStatus = '';
  let adjustStatusType = '';

  function genAccountNumber(cn) {
    let h = 5381;
    for (const c of cn) h = ((h << 5) + h + c.charCodeAt(0)) & 0x7fffffff;
    const n = String(Math.abs(h)).padStart(8, '0');
    return `VDB-${n.slice(0, 4)}-${n.slice(4, 8)}`;
  }

  async function loadAccount() {
    loading = true;
    error = '';
    try {
      const data = await dbGet(`bank/${codename}`);
      if (data && typeof data.balance === 'number') {
        balance = data.balance;
        accountNumber = data.accountNumber || genAccountNumber(codename);
        frozen = data.frozen ?? false;
        subscriptions = data.subscriptions ?? {};
        if (!data.accountNumber) {
          await dbPut(`bank/${codename}/accountNumber`, accountNumber);
        }
      } else {
        accountNumber = genAccountNumber(codename);
        balance = 0;
        await dbPut(`bank/${codename}`, { balance: 0, accountNumber });
      }
    } catch (e) {
      error = 'Connection error — try again.';
    }
    loading = false;
  }

  async function applyAdjustment(sign) {
    const amt = parseInt(adjustAmount);
    if (!amt || amt <= 0) { adjustStatus = 'Enter a valid amount'; adjustStatusType = 'err'; return; }
    if (sign === -1 && amt > balance) { adjustStatus = 'Insufficient balance'; adjustStatusType = 'err'; return; }
    adjusting = true;
    adjustStatus = '';
    try {
      const newBalance = balance + sign * amt;
      await dbPut(`bank/${codename}/balance`, newBalance);
      balance = newBalance;
      adjustAmount = '';
      adjustStatus = sign === 1 ? `+₱${amt} deposited` : `-₱${amt} withdrawn`;
      adjustStatusType = 'ok';
      setTimeout(() => { adjustStatus = ''; }, 3000);
    } catch {
      adjustStatus = 'Transaction failed';
      adjustStatusType = 'err';
    }
    adjusting = false;
  }

  function onAmountKey(e) {
    if (e.key === 'Enter') applyAdjustment(1);
    else { adjustStatus = ''; adjustStatusType = ''; }
  }

  // ── Intro ──────────────────────────────────────────────────────────────────
  let showIntro = false;
  let introPhase = 'login'; // 'login' | 'animate'
  const fakePassword = 'vdb2077secure';
  let dismissTimer;

  function handleLogin() {
    introPhase = 'animate';
    const audio = document.getElementById('vb-jingle-audio');
    if (audio) audio.play().catch(() => {});
    dismissTimer = setTimeout(dismissIntro, 12500);
  }

  function dismissIntro() {
    clearTimeout(dismissTimer);
    showIntro = false;
    if (typeof sessionStorage !== 'undefined')
      sessionStorage.setItem('vb_intro_seen', '1');
  }

  onMount(() => {
    if (!browser) return;
    codename = getCodename() || 'UNKNOWN';
    if (!sessionStorage.getItem('vb_intro_seen')) {
      showIntro = true;
    }
    loadAccount();
  });
</script>

<svelte:head>
  <title>Vandewalle Bank</title>
</svelte:head>

{#if showIntro}
  <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
  <div class="vb-intro-overlay">
    <audio id="vb-jingle-audio" src="{base}/sounds/vandewalle_jingle.mp3" preload="auto"></audio>

    {#if introPhase === 'login'}
      <!-- ── Login modal ── -->
      <div class="vb-intro-login">
        <!-- Logo mark -->
        <svg class="vb-intro-login-logo" viewBox="0 0 80 72" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="il-grad1" x1="0" y1="0" x2="80" y2="72" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stop-color="#a78bfa"/>
              <stop offset="40%" stop-color="#818cf8"/>
              <stop offset="100%" stop-color="#60a5fa"/>
            </linearGradient>
          </defs>
          <path d="M40 68 L4 8 L76 8 Z" stroke="url(#il-grad1)" stroke-width="3.5" stroke-linejoin="round" fill="rgba(109,40,217,0.12)"/>
          <path d="M40 52 L18 22 L62 22 Z" stroke="url(#il-grad1)" stroke-width="2.5" stroke-linejoin="round" fill="rgba(96,165,250,0.07)"/>
        </svg>

        <div class="vb-intro-login-title">LOG IN TO ACCOUNT</div>
        <div class="vb-intro-login-divider"></div>

        <div class="vb-intro-field-group">
          <label class="vb-intro-field-label">ACCOUNT HOLDER</label>
          <div class="vb-intro-field-box vb-intro-field-box--readonly">
            <span class="vb-intro-field-value">{codename || 'OPERATIVE'}</span>
          </div>
        </div>

        <div class="vb-intro-field-group">
          <label class="vb-intro-field-label">PASSWORD</label>
          <div class="vb-intro-field-box">
            <input
              class="vb-intro-password"
              type="password"
              value={fakePassword}
              readonly
              tabindex="-1"
            />
          </div>
        </div>

        <button class="vb-intro-login-btn" on:click={handleLogin}>
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M13 10H4m0 0l3-3m-3 3l3 3M17 4v12"/>
          </svg>
          ACCESS NETWORK
        </button>
      </div>

    {:else}
      <!-- ── Animation phase ── -->
      <div class="vb-intro-anim">
        <div class="vb-intro-scanlines"></div>

        <!-- Triangle logo draws in -->
        <div class="vb-intro-logo-wrap">
          <svg class="vb-intro-anim-svg" viewBox="0 0 80 72" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="ia-grad1" x1="0" y1="0" x2="80" y2="72" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stop-color="#a78bfa"/>
                <stop offset="40%" stop-color="#818cf8"/>
                <stop offset="100%" stop-color="#60a5fa"/>
              </linearGradient>
              <linearGradient id="ia-grad2" x1="80" y1="0" x2="0" y2="72" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stop-color="#c4b5fd"/>
                <stop offset="50%" stop-color="#818cf8"/>
                <stop offset="100%" stop-color="#38bdf8"/>
              </linearGradient>
            </defs>
            <path class="vb-anim-path-outer" d="M40 68 L4 8 L76 8 Z"
              stroke="url(#ia-grad1)" stroke-width="3.5" stroke-linejoin="round" fill="rgba(109,40,217,0.08)"/>
            <path class="vb-anim-path-inner" d="M40 52 L18 22 L62 22 Z"
              stroke="url(#ia-grad2)" stroke-width="2.5" stroke-linejoin="round" fill="rgba(96,165,250,0.06)"/>
            <!-- Corner accents -->
            <line class="vb-anim-accent" x1="4" y1="8" x2="12" y2="8" stroke="#c4b5fd" stroke-width="2" opacity="0"/>
            <line class="vb-anim-accent" x1="4" y1="8" x2="8" y2="15" stroke="#c4b5fd" stroke-width="2" opacity="0"/>
          </svg>
        </div>

        <!-- VANDEWALLE name — fires at 8s to sync with jingle -->
        <div class="vb-anim-name-wrap">
          <div class="vb-anim-name">VANDEWALLE</div>
          <div class="vb-anim-bank">BANK</div>
          <div class="vb-anim-tagline">SECURE FINANCIAL NETWORK · EST. 2047</div>
        </div>
      </div>
    {/if}
  </div>
{/if}

<wire-status-bar jail layout="flex"></wire-status-bar>
<wire-header back="{base}/home" title="Vandewalle Bank" layout="flex"></wire-header>

<div class="vb-shell">
  {#if frozen}
    <div class="vb-frozen-overlay" role="alert" aria-live="assertive">
      <div class="vb-frozen-scanline" aria-hidden="true"></div>
      <svg class="vb-frozen-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <rect x="5" y="11" width="14" height="10" rx="2"/>
        <path d="M8 11V7a4 4 0 0 1 8 0v4"/>
        <circle cx="12" cy="16" r="1" fill="currentColor" stroke="none"/>
      </svg>
      <p class="vb-frozen-label">ACCOUNT FROZEN</p>
      <div class="vb-frozen-divider" aria-hidden="true"></div>
      <p class="vb-frozen-sub">This account has been suspended by FCPD directive. All transactions are blocked pending review.</p>
    </div>
  {/if}

  <!-- Header -->
  <header class="vb-header">
    <div class="vb-logo-wrap">
      <!-- Vandewalle Bank triangle logo mark (SVG) -->
      <svg class="vb-logo-mark" viewBox="0 0 80 72" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <defs>
          <linearGradient id="vb-grad1" x1="0" y1="0" x2="80" y2="72" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stop-color="#a78bfa"/>
            <stop offset="40%" stop-color="#818cf8"/>
            <stop offset="100%" stop-color="#60a5fa"/>
          </linearGradient>
          <linearGradient id="vb-grad2" x1="80" y1="0" x2="0" y2="72" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stop-color="#c4b5fd"/>
            <stop offset="50%" stop-color="#818cf8"/>
            <stop offset="100%" stop-color="#38bdf8"/>
          </linearGradient>
        </defs>
        <!-- Outer downward triangle -->
        <path d="M40 68 L4 8 L76 8 Z" stroke="url(#vb-grad1)" stroke-width="3.5" stroke-linejoin="round" fill="rgba(109,40,217,0.08)"/>
        <!-- Inner V shape / smaller triangle -->
        <path d="M40 52 L18 22 L62 22 Z" stroke="url(#vb-grad2)" stroke-width="2.5" stroke-linejoin="round" fill="rgba(96,165,250,0.07)"/>
        <!-- Corner accent marks -->
        <line x1="4" y1="8" x2="12" y2="8" stroke="#c4b5fd" stroke-width="2" opacity="0.7"/>
        <line x1="4" y1="8" x2="8" y2="15" stroke="#c4b5fd" stroke-width="2" opacity="0.7"/>
      </svg>
      <div class="vb-wordmark">
        <span class="vb-name">VANDEWALLE</span>
        <span class="vb-word-bank">BANK</span>
      </div>
    </div>
  </header>

  <div class="vb-content">
    {#if loading}
      <div class="vb-loading">
        <div class="vb-loading-dots">
          <span></span><span></span><span></span>
        </div>
        <p>Connecting to network…</p>
      </div>
    {:else if error}
      <div class="vb-error-state">
        <p>{error}</p>
        <button class="vb-btn vb-btn--ghost" on:click={loadAccount}>Retry</button>
      </div>
    {:else}
      <!-- Account card -->
      <div class="vb-card">
        <div class="vb-card-shine" aria-hidden="true"></div>
        <div class="vb-card-top">
          <div class="vb-card-label">ACCOUNT HOLDER</div>
          <div class="vb-card-codename">{codename}</div>
        </div>
        <div class="vb-card-mid">
          <div class="vb-card-label">ACCOUNT NUMBER</div>
          <div class="vb-card-acct">{accountNumber}</div>
        </div>
        <div class="vb-card-balance-wrap">
          <div class="vb-card-label">CURRENT BALANCE</div>
          <div class="vb-balance">
            <span class="vb-balance-sym">₱</span><span class="vb-balance-num">{balance.toLocaleString()}</span>
          </div>
          <div class="vb-balance-unit">PLATINUM</div>
        </div>
        <div class="vb-card-logo-watermark" aria-hidden="true">
          <svg viewBox="0 0 60 54" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M30 50 L3 6 L57 6 Z" stroke="currentColor" stroke-width="2" opacity="0.12" fill="none"/>
            <path d="M30 38 L13 16 L47 16 Z" stroke="currentColor" stroke-width="1.5" opacity="0.08" fill="none"/>
          </svg>
        </div>
      </div>

      <!-- Transaction controls -->
      <div class="vb-transaction">
        <div class="vb-tx-label">// TRANSACTION</div>
        <div class="vb-tx-divider"></div>

        <div class="vb-amount-row">
          <span class="vb-amount-sym">₱</span>
          <input
            class="vb-amount-input"
            type="number"
            min="1"
            placeholder="AMOUNT"
            bind:value={adjustAmount}
            on:keydown={onAmountKey}
            disabled={adjusting}
          />
        </div>

        <div class="vb-tx-buttons">
          <button class="vb-btn vb-btn--withdraw" on:click={() => applyAdjustment(-1)} disabled={adjusting || !adjustAmount}>
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true">
              <line x1="4" y1="10" x2="16" y2="10"/>
            </svg>
            WITHDRAW
          </button>
          <button class="vb-btn vb-btn--deposit" on:click={() => applyAdjustment(1)} disabled={adjusting || !adjustAmount}>
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true">
              <line x1="10" y1="4" x2="10" y2="16"/>
              <line x1="4" y1="10" x2="16" y2="10"/>
            </svg>
            DEPOSIT
          </button>
        </div>

        {#if adjustStatus}
          <p class="vb-tx-status" class:ok={adjustStatusType === 'ok'} class:err={adjustStatusType === 'err'}>{adjustStatus}</p>
        {/if}

        <p class="vb-honor-note">Platinum is tracked on the honor system.<br>Keep your ledger accurate.</p>
      </div>

      {#if Object.keys(subscriptions).length > 0}
        <div class="vb-subs">
          <div class="vb-subs-label">// ACTIVE SERVICES</div>
          <div class="vb-subs-divider"></div>
          {#each Object.values(subscriptions) as sub}
            <div class="vb-sub-row">
              <span class="vb-sub-name">{sub.name}</span>
              <span class="vb-sub-cost">-₱{(sub.cost ?? 0).toLocaleString()}<span class="vb-sub-unit">/wk</span></span>
            </div>
          {/each}
        </div>
      {/if}
    {/if}
  </div>
</div>

<style>
  .vb-shell {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    background: #050508;
    position: relative;
  }

  /* ── Header ── */
  .vb-header {
    flex-shrink: 0;
    padding: 20px 22px 16px;
    border-bottom: 1px solid rgba(109, 40, 217, 0.25);
    background: linear-gradient(180deg, rgba(109,40,217,0.06) 0%, transparent 100%);
  }
  .vb-logo-wrap {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .vb-logo-mark {
    width: 36px;
    height: 32px;
    flex-shrink: 0;
  }
  .vb-wordmark {
    display: flex;
    flex-direction: column;
    gap: 0;
  }
  .vb-name {
    font-size: 15px;
    font-weight: 800;
    letter-spacing: 4px;
    background: linear-gradient(90deg, #c4b5fd, #818cf8, #60a5fa);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    line-height: 1.1;
  }
  .vb-word-bank {
    font-size: 8px;
    letter-spacing: 6px;
    color: rgba(196, 181, 253, 0.45);
    padding-left: 1px;
    font-weight: 600;
  }

  /* ── Content ── */
  .vb-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    padding: 22px 18px 30px;
    gap: 22px;
    max-width: 420px;
    width: 100%;
    margin: 0 auto;
  }

  /* ── Loading ── */
  .vb-loading {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
  }
  .vb-loading p {
    font-size: 10px;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: rgba(196, 181, 253, 0.4);
    margin: 0;
  }
  .vb-loading-dots {
    display: flex;
    gap: 7px;
  }
  .vb-loading-dots span {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #7c3aed;
    animation: vb-dot 1.3s ease-in-out infinite;
  }
  .vb-loading-dots span:nth-child(2) { animation-delay: 0.18s; }
  .vb-loading-dots span:nth-child(3) { animation-delay: 0.36s; }
  @keyframes vb-dot {
    0%, 100% { opacity: 0.2; transform: scale(0.7); }
    50% { opacity: 1; transform: scale(1); }
  }

  .vb-error-state {
    text-align: center;
    padding: 40px 0;
    color: rgba(248, 113, 113, 0.7);
    font-size: 12px;
    letter-spacing: 1px;
  }

  /* ── Account card ── */
  .vb-card {
    position: relative;
    background: linear-gradient(135deg, #0e0b1a 0%, #0a0d1a 60%, #070b16 100%);
    border: 1px solid rgba(124, 58, 237, 0.45);
    border-radius: 16px;
    padding: 22px 20px 20px;
    overflow: hidden;
    box-shadow:
      0 0 40px rgba(109, 40, 217, 0.18),
      0 0 80px rgba(96, 165, 250, 0.06),
      inset 0 0 30px rgba(109, 40, 217, 0.06);
  }
  .vb-card-shine {
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 1px;
    background: linear-gradient(90deg, transparent 0%, rgba(196,181,253,0.5) 40%, rgba(96,165,250,0.4) 60%, transparent 100%);
  }
  .vb-card-logo-watermark {
    position: absolute;
    bottom: -10px; right: -10px;
    width: 80px; height: 80px;
    color: #818cf8;
    pointer-events: none;
  }
  .vb-card-top,
  .vb-card-mid {
    margin-bottom: 16px;
  }
  .vb-card-label {
    font-size: 8px;
    letter-spacing: 2.5px;
    text-transform: uppercase;
    color: rgba(196, 181, 253, 0.35);
    margin-bottom: 3px;
    font-family: 'Courier New', Courier, monospace;
  }
  .vb-card-codename {
    font-size: 18px;
    font-weight: 700;
    letter-spacing: 3px;
    color: #e2e8f0;
  }
  .vb-card-acct {
    font-size: 14px;
    font-weight: 600;
    letter-spacing: 2px;
    color: rgba(196, 181, 253, 0.65);
    font-family: 'Courier New', Courier, monospace;
  }
  .vb-card-balance-wrap {
    margin-top: 4px;
  }
  .vb-balance {
    display: flex;
    align-items: baseline;
    gap: 4px;
    margin: 4px 0 2px;
  }
  .vb-balance-sym {
    font-size: 22px;
    font-weight: 700;
    color: rgba(167, 139, 250, 0.7);
    line-height: 1;
  }
  .vb-balance-num {
    font-size: 48px;
    font-weight: 800;
    letter-spacing: -2px;
    background: linear-gradient(135deg, #c4b5fd 0%, #818cf8 50%, #60a5fa 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    line-height: 1;
    font-variant-numeric: tabular-nums;
  }
  .vb-balance-unit {
    font-size: 8px;
    letter-spacing: 3px;
    color: rgba(129, 140, 248, 0.4);
    text-transform: uppercase;
    font-family: 'Courier New', Courier, monospace;
  }

  /* ── Transaction panel ── */
  .vb-transaction {
    background: rgba(109, 40, 217, 0.05);
    border: 1px solid rgba(109, 40, 217, 0.2);
    border-radius: 12px;
    padding: 18px 16px;
  }
  .vb-tx-label {
    font-size: 9px;
    letter-spacing: 2px;
    color: rgba(167, 139, 250, 0.45);
    font-family: 'Courier New', Courier, monospace;
    margin-bottom: 10px;
  }
  .vb-tx-divider {
    height: 1px;
    background: linear-gradient(to right, rgba(124,58,237,0.4), rgba(96,165,250,0.2), transparent);
    margin-bottom: 16px;
  }
  .vb-amount-row {
    display: flex;
    align-items: center;
    gap: 8px;
    border: 1px solid rgba(124, 58, 237, 0.35);
    border-radius: 8px;
    padding: 10px 14px;
    background: rgba(109, 40, 217, 0.06);
    margin-bottom: 14px;
  }
  .vb-amount-sym {
    font-size: 16px;
    color: rgba(167, 139, 250, 0.6);
    flex-shrink: 0;
  }
  .vb-amount-input {
    flex: 1;
    background: transparent;
    border: none;
    outline: none;
    color: #e2e8f0;
    font-size: 18px;
    font-weight: 600;
    font-family: 'Courier New', Courier, monospace;
    letter-spacing: 1px;
    caret-color: #818cf8;
    width: 100%;
    min-width: 0;
    -moz-appearance: textfield;
  }
  .vb-amount-input::-webkit-outer-spin-button,
  .vb-amount-input::-webkit-inner-spin-button { -webkit-appearance: none; }
  .vb-amount-input::placeholder {
    color: rgba(226, 232, 240, 0.15);
    letter-spacing: 2px;
    font-size: 14px;
  }
  .vb-amount-input:disabled { opacity: 0.5; }

  .vb-tx-buttons {
    display: flex;
    gap: 10px;
    margin-bottom: 12px;
  }
  .vb-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 12px 10px;
    border-radius: 8px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 1.5px;
    cursor: pointer;
    transition: opacity 0.15s, box-shadow 0.15s;
    font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif;
  }
  .vb-btn svg { width: 16px; height: 16px; }
  .vb-btn:disabled { opacity: 0.35; cursor: not-allowed; }

  .vb-btn--withdraw {
    background: rgba(239, 68, 68, 0.08);
    border: 1px solid rgba(239, 68, 68, 0.35);
    color: #fca5a5;
  }
  .vb-btn--withdraw:not(:disabled):active {
    box-shadow: 0 0 14px rgba(239, 68, 68, 0.25);
  }
  .vb-btn--deposit {
    background: rgba(109, 40, 217, 0.12);
    border: 1px solid rgba(124, 58, 237, 0.5);
    color: #c4b5fd;
  }
  .vb-btn--deposit:not(:disabled):active {
    box-shadow: 0 0 14px rgba(124, 58, 237, 0.35);
  }
  .vb-btn--ghost {
    background: none;
    border: 1px solid rgba(196, 181, 253, 0.2);
    color: rgba(196, 181, 253, 0.5);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 1.5px;
    padding: 10px 20px;
    border-radius: 8px;
    cursor: pointer;
  }

  .vb-tx-status {
    text-align: center;
    font-size: 10px;
    letter-spacing: 1.5px;
    font-family: 'Courier New', Courier, monospace;
    margin: 4px 0 8px;
  }
  .vb-tx-status.ok { color: #86efac; }
  .vb-tx-status.err { color: #fca5a5; }

  .vb-honor-note {
    text-align: center;
    font-size: 9px;
    line-height: 1.6;
    color: rgba(196, 181, 253, 0.2);
    margin: 8px 0 0;
    letter-spacing: 0.5px;
  }

  /* ── Frozen overlay ── */
  .vb-frozen-overlay {
    position: absolute;
    inset: 0;
    z-index: 100;
    background: rgba(10, 2, 2, 0.97);
    border-top: 2px solid #ef4444;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 32px 28px;
    gap: 16px;
    overflow: hidden;
  }
  .vb-frozen-scanline {
    position: absolute;
    inset: 0;
    pointer-events: none;
    background: repeating-linear-gradient(
      to bottom,
      transparent 0px, transparent 3px,
      rgba(239,68,68,0.04) 3px, rgba(239,68,68,0.04) 4px
    );
  }
  .vb-frozen-icon {
    width: 48px;
    height: 48px;
    color: #ef4444;
    opacity: 0.85;
  }
  .vb-frozen-label {
    font-size: 20px;
    font-weight: 800;
    letter-spacing: 5px;
    color: #ef4444;
    margin: 0;
    font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif;
    text-align: center;
  }
  .vb-frozen-divider {
    width: 60px;
    height: 1px;
    background: linear-gradient(to right, transparent, rgba(239,68,68,0.6), transparent);
  }
  .vb-frozen-sub {
    font-size: 11px;
    line-height: 1.65;
    color: rgba(252,165,165,0.4);
    text-align: center;
    margin: 0;
    max-width: 280px;
    letter-spacing: 0.3px;
  }

  /* ── Active services ── */
  .vb-subs {
    background: rgba(109, 40, 217, 0.05);
    border: 1px solid rgba(109, 40, 217, 0.2);
    border-radius: 12px;
    padding: 14px 16px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .vb-subs-label {
    font-size: 9px;
    letter-spacing: 2px;
    color: rgba(167, 139, 250, 0.4);
    font-family: 'Courier New', Courier, monospace;
  }
  .vb-subs-divider {
    height: 1px;
    background: linear-gradient(to right, rgba(124,58,237,0.3), transparent);
    margin-bottom: 2px;
  }
  .vb-sub-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }
  .vb-sub-name {
    font-size: 12px;
    color: rgba(226, 232, 240, 0.75);
  }
  .vb-sub-cost {
    font-size: 12px;
    font-weight: 600;
    color: #fca5a5;
    font-family: 'Courier New', Courier, monospace;
    white-space: nowrap;
  }
  .vb-sub-unit {
    font-size: 9px;
    opacity: 0.6;
  }

  /* ═══════════════════════════════════════════════════════
     INTRO OVERLAY
  ════════════════════════════════════════════════════════ */
  .vb-intro-overlay {
    position: fixed;
    inset: 0;
    z-index: 500;
    background: #030306;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  /* ── Login modal ── */
  .vb-intro-login {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: min(340px, 90vw);
    background: linear-gradient(145deg, #0e0b1a 0%, #080c1a 70%, #050810 100%);
    border: 1px solid rgba(124, 58, 237, 0.55);
    border-radius: 20px;
    padding: 36px 28px 32px;
    box-shadow:
      0 0 60px rgba(109, 40, 217, 0.2),
      0 0 120px rgba(96, 165, 250, 0.08),
      inset 0 1px 0 rgba(196, 181, 253, 0.12);
    animation: vb-login-in 0.4s ease-out both;
  }
  @keyframes vb-login-in {
    from { opacity: 0; transform: translateY(16px) scale(0.97); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }

  .vb-intro-login-logo {
    width: 56px;
    height: 50px;
    margin-bottom: 18px;
    filter: drop-shadow(0 0 12px rgba(167, 139, 250, 0.5));
  }

  .vb-intro-login-title {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 3px;
    color: rgba(196, 181, 253, 0.7);
    text-align: center;
    margin-bottom: 16px;
    font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif;
  }

  .vb-intro-login-divider {
    width: 100%;
    height: 1px;
    background: linear-gradient(to right, transparent, rgba(124, 58, 237, 0.5), rgba(96, 165, 250, 0.3), transparent);
    margin-bottom: 22px;
  }

  .vb-intro-field-group {
    width: 100%;
    margin-bottom: 14px;
  }
  .vb-intro-field-label {
    display: block;
    font-size: 8px;
    letter-spacing: 2.5px;
    color: rgba(196, 181, 253, 0.35);
    margin-bottom: 5px;
    font-family: 'Courier New', Courier, monospace;
  }
  .vb-intro-field-box {
    width: 100%;
    background: rgba(109, 40, 217, 0.08);
    border: 1px solid rgba(124, 58, 237, 0.4);
    border-radius: 8px;
    padding: 11px 14px;
    box-sizing: border-box;
  }
  .vb-intro-field-box--readonly {
    border-color: rgba(124, 58, 237, 0.25);
    background: rgba(109, 40, 217, 0.04);
  }
  .vb-intro-field-value {
    font-size: 15px;
    font-weight: 700;
    letter-spacing: 2px;
    color: #e2e8f0;
    font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif;
  }
  .vb-intro-password {
    width: 100%;
    background: transparent;
    border: none;
    outline: none;
    font-size: 20px;
    letter-spacing: 3px;
    color: rgba(196, 181, 253, 0.6);
    font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif;
    cursor: default;
    -webkit-text-security: disc;
    pointer-events: none;
    padding: 0;
  }

  .vb-intro-login-btn {
    margin-top: 10px;
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 14px 20px;
    background: linear-gradient(135deg, rgba(109, 40, 217, 0.25) 0%, rgba(96, 165, 250, 0.15) 100%);
    border: 1px solid rgba(124, 58, 237, 0.65);
    border-radius: 10px;
    color: #c4b5fd;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 2px;
    cursor: pointer;
    font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif;
    transition: box-shadow 0.2s, border-color 0.2s;
    box-shadow: 0 0 20px rgba(109, 40, 217, 0.15);
  }
  .vb-intro-login-btn svg {
    width: 16px;
    height: 16px;
    opacity: 0.8;
  }
  .vb-intro-login-btn:active {
    box-shadow: 0 0 30px rgba(109, 40, 217, 0.4);
    border-color: rgba(167, 139, 250, 0.9);
  }

  /* ── Animation phase ── */
  .vb-intro-anim {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0;
    animation: vb-anim-fade-in 0.5s ease-out both;
  }
  @keyframes vb-anim-fade-in {
    from { opacity: 0; }
    to   { opacity: 1; }
  }

  /* Scanlines */
  .vb-intro-scanlines {
    position: absolute;
    inset: 0;
    pointer-events: none;
    background: repeating-linear-gradient(
      to bottom,
      transparent 0px, transparent 3px,
      rgba(109, 40, 217, 0.03) 3px, rgba(109, 40, 217, 0.03) 4px
    );
    animation: vb-scanlines-in 1s ease-out 0.3s both;
  }
  @keyframes vb-scanlines-in {
    from { opacity: 0; }
    to   { opacity: 1; }
  }

  /* Logo */
  .vb-intro-logo-wrap {
    position: relative;
    margin-bottom: 32px;
    animation: vb-logo-appear 0.4s ease-out 0.4s both;
  }
  @keyframes vb-logo-appear {
    from { opacity: 0; transform: scale(0.8); }
    to   { opacity: 1; transform: scale(1); }
  }

  .vb-intro-anim-svg {
    width: 140px;
    height: 126px;
    filter: drop-shadow(0 0 16px rgba(167, 139, 250, 0.4));
    animation: vb-logo-glow 2s ease-in-out 5s infinite alternate;
  }
  @keyframes vb-logo-glow {
    from { filter: drop-shadow(0 0 16px rgba(167, 139, 250, 0.4)); }
    to   { filter: drop-shadow(0 0 30px rgba(167, 139, 250, 0.85)) drop-shadow(0 0 60px rgba(96, 165, 250, 0.3)); }
  }

  /* Outer triangle draws in: perimeter ~212, delay 0.5s, duration 2.5s */
  .vb-anim-path-outer {
    stroke-dasharray: 215;
    stroke-dashoffset: 215;
    animation: vb-draw-path 2.5s cubic-bezier(0.4, 0, 0.2, 1) 0.5s forwards;
  }
  /* Inner triangle draws in: perimeter ~119, delay 2.8s, duration 1.8s */
  .vb-anim-path-inner {
    stroke-dasharray: 120;
    stroke-dashoffset: 120;
    animation: vb-draw-path 1.8s cubic-bezier(0.4, 0, 0.2, 1) 2.8s forwards;
  }
  @keyframes vb-draw-path {
    to { stroke-dashoffset: 0; }
  }

  /* Corner accent lines appear after inner triangle */
  .vb-anim-accent {
    animation: vb-accent-appear 0.4s ease-out 4.7s forwards;
  }
  .vb-anim-accent:nth-child(3) { animation-delay: 4.7s; }
  .vb-anim-accent:nth-child(4) { animation-delay: 4.9s; }
  @keyframes vb-accent-appear {
    to { opacity: 0.7; }
  }

  /* Name section */
  .vb-anim-name-wrap {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    overflow: hidden;
  }

  /* VANDEWALLE — fires at 8s, syncs with jingle vocal */
  .vb-anim-name {
    font-size: clamp(28px, 8vw, 42px);
    font-weight: 900;
    letter-spacing: 8px;
    background: linear-gradient(90deg, #c4b5fd 0%, #818cf8 45%, #60a5fa 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    opacity: 0;
    transform: translateX(-24px) scale(0.95);
    animation: vb-name-slam 0.7s cubic-bezier(0.16, 1, 0.3, 1) 8s forwards;
    text-shadow: none;
    filter: drop-shadow(0 0 20px rgba(167, 139, 250, 0.6));
  }
  @keyframes vb-name-slam {
    0%   { opacity: 0; transform: translateX(-24px) scale(0.95); }
    60%  { opacity: 1; transform: translateX(4px) scale(1.02); }
    100% { opacity: 1; transform: translateX(0) scale(1); }
  }

  /* BANK — appears just after the name */
  .vb-anim-bank {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 9px;
    color: rgba(96, 165, 250, 0.6);
    opacity: 0;
    animation: vb-bank-in 0.5s ease-out 8.6s forwards;
    font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif;
    padding-left: 9px; /* compensate for letter-spacing on last char */
  }
  @keyframes vb-bank-in {
    from { opacity: 0; transform: scaleX(0.8) translateY(-4px); }
    to   { opacity: 1; transform: scaleX(1) translateY(0); }
  }

  /* Tagline — appears at ~10s */
  .vb-anim-tagline {
    margin-top: 18px;
    font-size: 8px;
    letter-spacing: 2.5px;
    color: rgba(196, 181, 253, 0.25);
    font-family: 'Courier New', Courier, monospace;
    text-align: center;
    opacity: 0;
    animation: vb-tagline-in 0.8s ease-out 10s forwards;
  }
  @keyframes vb-tagline-in {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
</style>
