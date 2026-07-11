<script>
  import { base } from '$app/paths';
  import { browser } from '$app/environment';
  import { onMount, onDestroy } from 'svelte';
  import { dbGet } from '$lib/firebase-db.js';
  import { visibilityAwareInterval } from '$lib/utils.js';
  import { CLASS_CONFIG, VEHICLE_UPGRADES } from '$lib/data/rides.js';

  let vehicles = [];
  let pollTimer;

  async function loadVehicles() {
    try {
      const data = await dbGet('rides');
      if (!data) { vehicles = []; return; }
      vehicles = Object.keys(data)
        .map(k => { const r = data[k]; r._id = k; return r; })
        .filter(r => r.make && r.staged === true)
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    } catch { vehicles = []; }
  }

  onMount(() => {
    if (!browser) return;
    loadVehicles();
    pollTimer = visibilityAwareInterval(loadVehicles, 10000);
  });

  onDestroy(() => {
    if (pollTimer) pollTimer();
  });
</script>

<svelte:head>
  <title>Fate City: 1999 — Rides</title>
</svelte:head>

<wire-status-bar jail layout="flex"></wire-status-bar>
<wire-header back="{base}/home" title="Rides" subtitle="Vehicle Registry" layout="flex"></wire-header>

<div class="rides-scroll">
  {#if vehicles.length === 0}
    <div class="empty">
      <div class="empty-icon">
        <svg style="fill:rgba(201,162,39,0.18);stroke:none" viewBox="0 0 15 15" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path d="M12.6,8.7,11.5,6.5a1.05,1.05,0,0,0-.9-.5H4.4a1.05,1.05,0,0,0-.9.5L2.4,8.7,1.16,9.852a.5.5,0,0,0-.16.367V14.5a.5.5,0,0,0,.5.5h2c.2,0,.5-.2.5-.4V14h7v.5c0,.2.2.5.4.5h2.1a.5.5,0,0,0,.5-.5V10.219a.5.5,0,0,0-.16-.367ZM4.5,7h6l1,2h-8ZM5,11.6c0,.2-.3.4-.5.4H2.4c-.2,0-.4-.3-.4-.5V10.4c.1-.3.3-.5.6-.4l2,.4c.2,0,.4.3.4.5Zm8-.1c0,.2-.2.5-.4.5H10.5c-.2,0-.5-.2-.5-.4v-.7c0-.2.2-.5.4-.5l2-.4c.3-.1.5.1.6.4ZM13.5,0H11a1,1,0,0,0-1,1H2L1,2V3L2,4,3.5,2.5,5,4,6.5,2.5,8,4h2a1,1,0,0,0,1,1h2.5a.5.5,0,0,0,.5-.5V.5A.5.5,0,0,0,13.5,0ZM13,3.5a.5.5,0,0,1-1,0v-2a.5.5,0,0,1,1,0Z"/>
        </svg>
      </div>
      <p class="empty-label">No Vehicles</p>
      <p class="empty-sub">Vehicles registered to the crew will appear here.</p>
    </div>
  {:else}
    {#each vehicles as v}
      {@const cc = CLASS_CONFIG[v.class] ?? CLASS_CONFIG.sedan}
      <div class="vehicle-card">
        <div class="card-stripe" style="background:{cc.stripe}"></div>

        {#if v.image}
          <img class="card-img" src="{base}/images/rides/{v.image}" alt="{v.make} {v.model}" loading="lazy" />
        {/if}

        <div class="card-body">
          <div class="card-head">
            <div class="card-title-block">
              <span class="card-make">{v.make}</span>
              <h2 class="card-model">{v.model}</h2>
              <span class="card-year">{v.year}</span>
            </div>
            <span class="card-class" style="background:{cc.badge}22;border-color:{cc.badge}66;color:{cc.badge}">
              {cc.label}
            </span>
          </div>

          <div class="card-rule" style="border-color:{cc.stripe}99"></div>

          <div class="card-stats">
            <div class="stat">
              <span class="stat-label">SDP</span>
              <span class="stat-value">{v.stats?.sdp ?? v.stats?.spd ?? '—'}</span>
            </div>
            <div class="stat-divider"></div>
            <div class="stat">
              <span class="stat-label">Seats</span>
              <span class="stat-value">{v.stats?.seats ?? '—'}</span>
            </div>
            <div class="stat-divider"></div>
            <div class="stat">
              <span class="stat-label">MOVE · Combat</span>
              <span class="stat-value">{v.stats?.speedCombat ?? '—'}</span>
            </div>
            <div class="stat-divider"></div>
            <div class="stat">
              <span class="stat-label">MOVE · Narrative</span>
              <span class="stat-value">{v.stats?.speedNarrative ?? '—'}</span>
            </div>
            <div class="stat-divider"></div>
            <div class="stat">
              <span class="stat-label">Cost</span>
              <span class="stat-value">{v.stats?.cost ?? '—'}</span>
            </div>
          </div>

          {#if v.upgrades?.length}
            {@const upgradeMap = Object.fromEntries(VEHICLE_UPGRADES.map(u => [u.key, u.label]))}
            <div class="upgrade-rule" style="border-color:{cc.stripe}99"></div>
            <div class="upgrade-chips">
              {#each v.upgrades as key (key)}
                <span class="upgrade-chip">{upgradeMap[key] ?? key}</span>
              {/each}
            </div>
          {/if}
        </div>
      </div>
    {/each}
  {/if}
</div>

<style>
  .rides-scroll {
    flex: 1;
    overflow-y: auto;
    background: #0d1118;
    padding: 20px 16px 64px;
    scrollbar-width: thin;
    scrollbar-color: rgba(201, 162, 39, 0.2) transparent;
  }

  .empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 80px 32px;
    gap: 14px;
    text-align: center;
  }
  .empty-icon svg { width: 52px; height: 52px; }
  .empty-label {
    font-family: 'Courier New', monospace;
    font-size: 11px;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: rgba(201, 162, 39, 0.35);
    margin: 0;
  }
  .empty-sub {
    font-size: 12px;
    color: rgba(232, 223, 200, 0.2);
    margin: 0;
    line-height: 1.55;
    max-width: 240px;
  }

  .vehicle-card {
    max-width: 520px;
    margin: 0 auto 20px;
    background: #0c0f16;
    border: 1px solid rgba(201, 162, 39, 0.18);
    border-radius: 2px;
    position: relative;
    overflow: hidden;
  }
  .card-stripe {
    position: absolute;
    top: 0; left: 0; bottom: 0;
    width: 4px;
  }
  .card-img {
    display: block;
    width: 100%;
    aspect-ratio: 16 / 9;
    object-fit: cover;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }
  .card-body { padding: 16px 16px 18px 20px; }

  .card-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
  }
  .card-title-block { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
  .card-make {
    font-family: 'Courier New', monospace;
    font-size: 9px;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: rgba(201, 162, 39, 0.45);
  }
  .card-model {
    font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif;
    font-size: 22px;
    font-weight: 800;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: #e8dfc8;
    margin: 0;
    line-height: 1.1;
  }
  .card-year {
    font-family: 'Courier New', monospace;
    font-size: 10px;
    letter-spacing: 1.5px;
    color: rgba(232, 223, 200, 0.3);
    margin-top: 2px;
  }
  .card-class {
    font-family: 'Courier New', monospace;
    font-size: 9px;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    padding: 4px 9px;
    border: 1px solid;
    border-radius: 2px;
    white-space: nowrap;
    flex-shrink: 0;
    margin-top: 2px;
  }
  .card-rule {
    margin: 14px 0 16px;
    border: none;
    border-top: 1px solid;
  }

  .card-stats { display: flex; align-items: stretch; }
  .stat {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 5px;
    min-width: 0;
  }
  .stat-label {
    font-family: 'Courier New', monospace;
    font-size: 7.5px;
    letter-spacing: 0.8px;
    text-transform: uppercase;
    color: rgba(201, 162, 39, 0.4);
    text-align: center;
    line-height: 1.3;
  }
  .stat-value {
    font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif;
    font-size: 17px;
    font-weight: 700;
    color: #e8dfc8;
    letter-spacing: -0.5px;
  }
  .stat-divider {
    width: 1px;
    background: rgba(201, 162, 39, 0.1);
    margin: 0 2px;
    flex-shrink: 0;
  }

  .upgrade-rule {
    margin: 14px 0 12px;
    border: none;
    border-top: 1px solid;
  }
  .upgrade-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
  .upgrade-chip {
    font-family: 'Courier New', monospace;
    font-size: 7.5px;
    letter-spacing: 0.7px;
    text-transform: uppercase;
    color: rgba(201, 162, 39, 0.7);
    background: rgba(201, 162, 39, 0.06);
    border: 1px solid rgba(201, 162, 39, 0.2);
    border-radius: 2px;
    padding: 4px 6px;
    white-space: nowrap;
  }
</style>
