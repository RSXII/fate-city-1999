<script>
  import { base } from '$app/paths';
  import { browser } from '$app/environment';
  import { onMount } from 'svelte';
  import { dbGet, dbPost, dbDelete } from '$lib/firebase-db.js';
  import { getCodename } from '$lib/utils.js';

  const TIERS = [
    {
      id: 'silver',
      name: 'Silver',
      label: 'SILVER',
      monthly: 500,
      weekly: 125,
      tagline: 'Basic emergency response coverage.',
      benefits: [
        '₱100/min deployment charge, billed on extraction',
        'Ammo used billed at full cost',
        'Surgery billed out of pocket',
      ],
      exclusions: ['No response time guarantee', 'No surgery coverage'],
    },
    {
      id: 'gold',
      name: 'Gold',
      label: 'GOLD',
      monthly: 1500,
      weekly: 375,
      tagline: 'Enhanced coverage with surgical benefits.',
      benefits: [
        '₱100/min deployment charge, billed on extraction',
        'Ammo used at 50% discount',
        'Surgery included',
        'Cosmetic surgery billed out of pocket',
      ],
      exclusions: ['No response time guarantee'],
    },
    {
      id: 'platinum',
      name: 'Platinum',
      label: 'PLATINUM',
      monthly: 10000,
      weekly: 2500,
      tagline: 'Full-service extraction and medical coverage.',
      benefits: [
        'No deployment charge',
        '5-minute response time guarantee',
        'Ammo included',
        'Surgery included',
        'Cosmetic surgery included',
      ],
      exclusions: [],
    },
    {
      id: 'executive',
      name: 'Executive',
      label: 'EXECUTIVE',
      monthly: 30000,
      weekly: 7500,
      tagline: 'Priority protection for you and your personnel.',
      benefits: [
        'No deployment charge',
        '3-minute response time guarantee',
        'Ammo included',
        'Surgery included',
        'Cosmetic surgery included',
        'Coverage extends to up to 3 personal guards or executive personnel on scene',
      ],
      exclusions: [],
    },
  ];

  const TIER_ORDER = ['silver', 'gold', 'platinum', 'executive'];

  let codename = '';
  let loading = true;
  let error = '';
  let currentSubId = null;
  let currentTierId = null;
  let acting = false;
  let actionStatus = '';
  let actionStatusType = '';

  $: currentTier = TIERS.find(t => t.id === currentTierId) ?? null;

  function tierRank(id) { return TIER_ORDER.indexOf(id); }

  async function loadSubscription() {
    loading = true;
    error = '';
    try {
      const data = await dbGet(`bank/${codename}/subscriptions`);
      if (data) {
        const entry = Object.entries(data).find(([, v]) => v._type === 'trauma-team');
        if (entry) { currentSubId = entry[0]; currentTierId = entry[1]._tier; }
      }
    } catch { error = 'Connection error — try again.'; }
    loading = false;
  }

  async function subscribe(tier) {
    if (acting) return;
    acting = true;
    actionStatus = '';
    try {
      if (currentSubId) {
        await dbDelete(`bank/${codename}/subscriptions/${currentSubId}`);
        currentSubId = null;
        currentTierId = null;
      }
      const res = await dbPost(`bank/${codename}/subscriptions`, {
        name: `Trauma Team — ${tier.name}`,
        cost: tier.weekly,
        _type: 'trauma-team',
        _tier: tier.id,
      });
      currentSubId = res.name;
      currentTierId = tier.id;
      actionStatus = `${tier.label} plan activated.`;
      actionStatusType = 'ok';
    } catch {
      actionStatus = 'Transaction failed — try again.';
      actionStatusType = 'err';
    }
    acting = false;
  }

  async function cancelSubscription() {
    if (acting || !currentSubId) return;
    acting = true;
    actionStatus = '';
    try {
      await dbDelete(`bank/${codename}/subscriptions/${currentSubId}`);
      currentSubId = null;
      currentTierId = null;
      actionStatus = 'Subscription cancelled.';
      actionStatusType = 'ok';
    } catch {
      actionStatus = 'Cancellation failed — try again.';
      actionStatusType = 'err';
    }
    acting = false;
  }

  function btnLabel(tier) {
    if (currentTierId === tier.id) return 'CANCEL PLAN';
    if (!currentTierId) return 'SUBSCRIBE';
    return tierRank(tier.id) > tierRank(currentTierId) ? 'UPGRADE' : 'DOWNGRADE';
  }

  onMount(() => {
    if (!browser) return;
    codename = getCodename() || 'UNKNOWN';
    loadSubscription();
  });
</script>

<svelte:head>
  <title>Trauma Team</title>
</svelte:head>

<wire-status-bar jail layout="flex"></wire-status-bar>
<wire-header back="{base}/home" title="Trauma Team" layout="flex"></wire-header>

<div class="tt-shell">

  <!-- Brand header -->
  <header class="tt-brand">
    <div class="tt-brand-logo" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="9"/>
        <line x1="12" y1="7.5" x2="12" y2="16.5"/>
        <line x1="7.5" y1="12" x2="16.5" y2="12"/>
      </svg>
    </div>
    <div class="tt-brand-text">
      <span class="tt-brand-name">TRAUMA TEAM</span>
      <span class="tt-brand-sub">INTERNATIONAL // EMERGENCY RESPONSE</span>
    </div>
  </header>

  <!-- Active status banner -->
  {#if !loading && currentTier}
    <div class="tt-active-banner tt-active-banner--{currentTier.id}">
      <div class="tt-active-dot" aria-hidden="true"></div>
      <div class="tt-active-text">
        <span class="tt-active-label">ACTIVE PLAN</span>
        <span class="tt-active-tier">{currentTier.label} — ₱{currentTier.monthly.toLocaleString()}/mo</span>
      </div>
    </div>
  {/if}

  <!-- Status message -->
  {#if actionStatus}
    <p class="tt-action-status" class:ok={actionStatusType === 'ok'} class:err={actionStatusType === 'err'}>{actionStatus}</p>
  {/if}

  <!-- Content -->
  <div class="tt-content">
    {#if loading}
      <div class="tt-loading">
        <div class="tt-dots"><span></span><span></span><span></span></div>
        <p>Connecting to network…</p>
      </div>
    {:else if error}
      <div class="tt-error">
        <p>{error}</p>
        <button class="tt-btn tt-btn--ghost" on:click={loadSubscription}>Retry</button>
      </div>
    {:else}
      {#each TIERS as tier}
        {@const isActive = currentTierId === tier.id}
        {@const isCancel = isActive}
        <div class="tt-card tt-card--{tier.id}" class:tt-card--active={isActive}>
          <div class="tt-card-shine" aria-hidden="true"></div>

          <div class="tt-card-header">
            <div>
              <div class="tt-tier-badge tt-tier-badge--{tier.id}">{tier.label}</div>
              <div class="tt-tagline">{tier.tagline}</div>
            </div>
            <div class="tt-price-block">
              <span class="tt-price-sym">₱</span>
              <span class="tt-price-num">{tier.monthly >= 10000 ? (tier.monthly / 1000) + 'K' : tier.monthly.toLocaleString()}</span>
              {#if tier.id === 'executive'}<span class="tt-price-plus">+</span>{/if}
              <span class="tt-price-period">/mo</span>
            </div>
          </div>

          <div class="tt-divider" aria-hidden="true"></div>

          <ul class="tt-benefits-list" aria-label="Plan benefits">
            {#each tier.benefits as b}
              <li class="tt-benefit-item">
                <span class="tt-check" aria-hidden="true">✓</span>
                <span>{b}</span>
              </li>
            {/each}
          </ul>

          <div class="tt-card-footer">
            <span class="tt-weekly-note">≈ ₱{tier.weekly.toLocaleString()}/wk billed</span>
            {#if isCancel}
              <button class="tt-btn tt-btn--cancel" on:click={cancelSubscription} disabled={acting}>
                {acting ? '…' : 'CANCEL PLAN'}
              </button>
            {:else}
              <button
                class="tt-btn tt-btn--subscribe tt-btn--{tier.id}"
                on:click={() => subscribe(tier)}
                disabled={acting}
              >
                {acting ? '…' : btnLabel(tier)}
              </button>
            {/if}
          </div>
        </div>
      {/each}
    {/if}
  </div>

  <p class="tt-disclaimer">Trauma Team International is not responsible for losses incurred during delayed response due to combat obstruction, airspace lockdown, or corp jurisdiction conflicts. All billings are final.</p>

</div>

<style>
  .tt-shell {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    background: #060406;
  }

  /* ── Brand header ── */
  .tt-brand {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px 20px 14px;
    border-bottom: 1px solid rgba(220, 38, 38, 0.25);
    background: linear-gradient(180deg, rgba(220,38,38,0.07) 0%, transparent 100%);
  }
  .tt-brand-logo {
    width: 34px;
    height: 34px;
    flex-shrink: 0;
    color: #ef4444;
  }
  .tt-brand-logo svg { width: 100%; height: 100%; }
  .tt-brand-text { display: flex; flex-direction: column; gap: 1px; }
  .tt-brand-name {
    font-size: 14px;
    font-weight: 800;
    letter-spacing: 3px;
    color: #ef4444;
    line-height: 1.1;
    font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif;
  }
  .tt-brand-sub {
    font-size: 8px;
    letter-spacing: 1.5px;
    color: rgba(220, 38, 38, 0.45);
    font-family: 'Courier New', Courier, monospace;
  }

  /* ── Active banner ── */
  .tt-active-banner {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 20px;
    border-bottom: 1px solid rgba(220,38,38,0.15);
    background: rgba(220,38,38,0.05);
  }
  .tt-active-dot {
    width: 7px; height: 7px;
    border-radius: 50%;
    background: #4ade80;
    flex-shrink: 0;
    box-shadow: 0 0 8px rgba(74,222,128,0.7);
    animation: tt-dot-pulse 2s ease-in-out infinite;
  }
  @keyframes tt-dot-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }
  .tt-active-text { display: flex; flex-direction: column; gap: 1px; }
  .tt-active-label {
    font-size: 8px;
    letter-spacing: 2px;
    color: rgba(74,222,128,0.6);
    font-family: 'Courier New', Courier, monospace;
  }
  .tt-active-tier {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 1px;
    color: #e8dfc8;
  }
  .tt-active-banner--silver  .tt-active-tier { color: #cbd5e1; }
  .tt-active-banner--gold    .tt-active-tier { color: #fbbf24; }
  .tt-active-banner--platinum .tt-active-tier { color: #38bdf8; }
  .tt-active-banner--executive .tt-active-tier { color: #f87171; }

  /* ── Action status ── */
  .tt-action-status {
    text-align: center;
    font-size: 10px;
    letter-spacing: 1.5px;
    font-family: 'Courier New', Courier, monospace;
    padding: 8px 20px;
    margin: 0;
    flex-shrink: 0;
  }
  .tt-action-status.ok { color: #86efac; }
  .tt-action-status.err { color: #fca5a5; }

  /* ── Content ── */
  .tt-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding: 18px 16px 8px;
  }

  /* ── Loading ── */
  .tt-loading {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
  }
  .tt-loading p {
    font-size: 10px;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: rgba(239,68,68,0.4);
    margin: 0;
  }
  .tt-dots { display: flex; gap: 7px; }
  .tt-dots span {
    width: 7px; height: 7px;
    border-radius: 50%;
    background: #ef4444;
    animation: tt-dot 1.3s ease-in-out infinite;
  }
  .tt-dots span:nth-child(2) { animation-delay: 0.18s; }
  .tt-dots span:nth-child(3) { animation-delay: 0.36s; }
  @keyframes tt-dot {
    0%, 100% { opacity: 0.2; transform: scale(0.7); }
    50% { opacity: 1; transform: scale(1); }
  }

  .tt-error {
    text-align: center;
    padding: 40px 0;
    color: rgba(248,113,113,0.7);
    font-size: 12px;
    letter-spacing: 1px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 14px;
  }

  /* ── Tier cards ── */
  .tt-card {
    position: relative;
    border-radius: 14px;
    padding: 18px 16px 14px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    overflow: hidden;
    border: 1px solid rgba(255,255,255,0.08);
    background: rgba(12,8,12,0.7);
    transition: border-color 0.2s, box-shadow 0.2s;
  }
  .tt-card-shine {
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 1px;
    pointer-events: none;
  }

  /* Silver */
  .tt-card--silver { border-color: rgba(148,163,184,0.25); }
  .tt-card--silver .tt-card-shine { background: linear-gradient(90deg, transparent, rgba(203,213,225,0.4), transparent); }
  .tt-card--silver.tt-card--active { border-color: rgba(148,163,184,0.7); box-shadow: 0 0 24px rgba(148,163,184,0.12); }

  /* Gold */
  .tt-card--gold { border-color: rgba(251,191,36,0.25); }
  .tt-card--gold .tt-card-shine { background: linear-gradient(90deg, transparent, rgba(251,191,36,0.5), transparent); }
  .tt-card--gold.tt-card--active { border-color: rgba(251,191,36,0.7); box-shadow: 0 0 24px rgba(251,191,36,0.14); }

  /* Platinum */
  .tt-card--platinum { border-color: rgba(56,189,248,0.25); }
  .tt-card--platinum .tt-card-shine { background: linear-gradient(90deg, transparent, rgba(56,189,248,0.5), transparent); }
  .tt-card--platinum.tt-card--active { border-color: rgba(56,189,248,0.7); box-shadow: 0 0 24px rgba(56,189,248,0.14); }

  /* Executive */
  .tt-card--executive { border-color: rgba(220,38,38,0.3); background: rgba(14,6,6,0.8); }
  .tt-card--executive .tt-card-shine { background: linear-gradient(90deg, transparent, rgba(220,38,38,0.5), rgba(251,191,36,0.3), transparent); }
  .tt-card--executive.tt-card--active { border-color: rgba(220,38,38,0.8); box-shadow: 0 0 28px rgba(220,38,38,0.16); }

  /* ── Card header ── */
  .tt-card-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 10px;
  }

  /* ── Tier badge ── */
  .tt-tier-badge {
    display: inline-block;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 3px;
    padding: 2px 8px;
    border-radius: 3px;
    margin-bottom: 5px;
    font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif;
  }
  .tt-tier-badge--silver  { color: #cbd5e1; background: rgba(148,163,184,0.12); border: 1px solid rgba(148,163,184,0.3); }
  .tt-tier-badge--gold    { color: #fbbf24; background: rgba(251,191,36,0.1);  border: 1px solid rgba(251,191,36,0.35); }
  .tt-tier-badge--platinum { color: #38bdf8; background: rgba(56,189,248,0.1); border: 1px solid rgba(56,189,248,0.35); }
  .tt-tier-badge--executive { color: #f87171; background: rgba(220,38,38,0.1); border: 1px solid rgba(220,38,38,0.4); }

  .tt-tagline {
    font-size: 10px;
    color: rgba(226,232,240,0.35);
    letter-spacing: 0.4px;
  }

  /* ── Price ── */
  .tt-price-block {
    display: flex;
    align-items: baseline;
    gap: 1px;
    flex-shrink: 0;
  }
  .tt-price-sym { font-size: 13px; font-weight: 600; color: rgba(226,232,240,0.5); }
  .tt-price-num { font-size: 28px; font-weight: 800; letter-spacing: -1px; color: #e2e8f0; line-height: 1; font-variant-numeric: tabular-nums; }
  .tt-price-plus { font-size: 16px; font-weight: 700; color: rgba(226,232,240,0.5); align-self: flex-end; padding-bottom: 3px; }
  .tt-price-period { font-size: 11px; color: rgba(226,232,240,0.35); align-self: flex-end; padding-bottom: 2px; margin-left: 1px; }

  .tt-card--gold    .tt-price-num { color: #fbbf24; }
  .tt-card--platinum .tt-price-num { color: #38bdf8; }
  .tt-card--executive .tt-price-num { color: #f87171; }

  /* ── Divider ── */
  .tt-divider { height: 1px; background: rgba(255,255,255,0.06); }

  /* ── Benefits ── */
  .tt-benefits-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 7px;
  }
  .tt-benefit-item {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    font-size: 11px;
    line-height: 1.4;
    color: rgba(226,232,240,0.65);
  }
  .tt-check {
    font-size: 10px;
    flex-shrink: 0;
    margin-top: 1px;
  }
  .tt-card--silver   .tt-check { color: #94a3b8; }
  .tt-card--gold     .tt-check { color: #fbbf24; }
  .tt-card--platinum .tt-check { color: #38bdf8; }
  .tt-card--executive .tt-check { color: #f87171; }

  /* ── Card footer ── */
  .tt-card-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding-top: 4px;
  }
  .tt-weekly-note {
    font-size: 9px;
    letter-spacing: 0.5px;
    color: rgba(226,232,240,0.2);
    font-family: 'Courier New', Courier, monospace;
  }

  /* ── Buttons ── */
  .tt-btn {
    padding: 9px 16px;
    border-radius: 6px;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 1.5px;
    cursor: pointer;
    transition: opacity 0.15s, box-shadow 0.15s;
    font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif;
    white-space: nowrap;
  }
  .tt-btn:disabled { opacity: 0.4; cursor: not-allowed; }

  .tt-btn--cancel {
    background: rgba(239,68,68,0.1);
    border: 1px solid rgba(239,68,68,0.4);
    color: #fca5a5;
  }
  .tt-btn--cancel:not(:disabled):active { box-shadow: 0 0 12px rgba(239,68,68,0.25); }

  .tt-btn--subscribe { border: 1px solid; }
  .tt-btn--subscribe.tt-btn--silver   { background: rgba(148,163,184,0.1); border-color: rgba(148,163,184,0.4); color: #cbd5e1; }
  .tt-btn--subscribe.tt-btn--gold     { background: rgba(251,191,36,0.1);  border-color: rgba(251,191,36,0.45); color: #fbbf24; }
  .tt-btn--subscribe.tt-btn--platinum { background: rgba(56,189,248,0.1);  border-color: rgba(56,189,248,0.45); color: #38bdf8; }
  .tt-btn--subscribe.tt-btn--executive { background: rgba(220,38,38,0.12); border-color: rgba(220,38,38,0.5);  color: #f87171; }

  .tt-btn--ghost {
    background: none;
    border: 1px solid rgba(239,68,68,0.2);
    color: rgba(239,68,68,0.5);
  }

  /* ── Disclaimer ── */
  .tt-disclaimer {
    font-size: 8px;
    line-height: 1.6;
    color: rgba(226,232,240,0.1);
    padding: 12px 20px 24px;
    text-align: center;
    letter-spacing: 0.3px;
    flex-shrink: 0;
  }
</style>
