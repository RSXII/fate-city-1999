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

  onMount(() => {
    if (!browser) return;
    codename = getCodename() || 'UNKNOWN';
    loadAccount();
  });
</script>

<svelte:head>
  <title>Vandewalle Bank</title>
</svelte:head>

<wire-status-bar jail layout="flex"></wire-status-bar>
<wire-header back="{base}/home" title="Vandewalle Bank" layout="flex"></wire-header>

<div class="vb-shell">

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
</style>
