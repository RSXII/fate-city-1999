<script>
  import { browser } from '$app/environment';
  import { base } from '$app/paths';
  import { onMount, onDestroy } from 'svelte';
  import { dbGet, dbPut, dbPatch } from '$lib/firebase-db.js';
  import { getCodename, visibilityAwareInterval } from '$lib/utils.js';
  import { CHARACTERS, ACTION_SLOTS, resolveAction, normActions, formatDelta } from '$lib/data/downtime.js';

  // ── State machine ─────────────────────────────────────────────────────────
  // loading | no-codename | no-character | inactive | picking | completed
  let state = 'loading';

  let codename = null;
  let character = null;
  let active = null;        // { enabled, index, period }
  let characterStats = {};
  let queue = [];           // action def objects, up to ACTION_SLOTS

  let submitting = false;
  let submitError = '';

  let completedResult = null; // { resolvedAt, actions[] }
  let sessionLog = [];        // past session entries for this character

  let pollInterval;

  onMount(async () => {
    if (!browser) return;
    codename = getCodename()?.toUpperCase() ?? null;
    if (!codename) { state = 'no-codename'; return; }
    character = CHARACTERS[codename] ?? null;
    if (!character) { state = 'no-character'; return; }

    await loadState();
    await loadSessionLog();
    pollInterval = visibilityAwareInterval(pollState, 5000);
  });

  onDestroy(() => { if (pollInterval) pollInterval(); });

  async function loadState() {
    try {
      const activeData = await dbGet('downtime/active');
      active = activeData;

      if (!activeData?.enabled) {
        state = 'inactive';
        return;
      }

      const done = await dbGet(`downtime/sessions/${activeData.index}/completedBy/${codename}`);
      if (done) {
        const result = await dbGet(`downtime/sessions/${activeData.index}/results/${codename}`);
        if (result) result.actions = normActions(result.actions);
        completedResult = result;
        state = 'completed';
      } else {
        const stats = await dbGet(`downtime/stats/${codename}`);
        characterStats = { ...character.statDefaults, ...(stats ?? {}) };
        state = 'picking';
      }
    } catch { /* network hiccup */ }
  }

  // Lighter poll that only refreshes result text (for GM narrative updates)
  async function pollState() {
    try {
      const activeData = await dbGet('downtime/active');
      // Detect GM toggling downtime
      if (activeData?.enabled !== active?.enabled || activeData?.index !== active?.index) {
        active = activeData;
        await loadState();
        return;
      }
      active = activeData;

      if (state === 'completed' && active?.enabled) {
        const result = await dbGet(`downtime/sessions/${active.index}/results/${codename}`);
        if (result) result.actions = normActions(result.actions);
        completedResult = result;
      }
    } catch { /* network hiccup */ }
  }

  async function loadSessionLog() {
    try {
      const sessions = await dbGet('downtime/sessions');
      if (!sessions) return;
      const log = [];
      for (const [idx, session] of Object.entries(sessions)) {
        const result = session?.results?.[codename];
        if (result) {
          log.push({
            sessionIndex: +idx,
            period: session.period,
            resolvedAt: result.resolvedAt,
            actions: normActions(result.actions),
          });
        }
      }
      log.sort((a, b) => b.sessionIndex - a.sessionIndex);
      sessionLog = log;
    } catch { /* network hiccup */ }
  }

  // ── Action queue ──────────────────────────────────────────────────────────
  function addToQueue(action) {
    if (queue.length >= ACTION_SLOTS) return;
    queue = [...queue, action];
  }

  function removeFromQueue(i) {
    queue = queue.filter((_, idx) => idx !== i);
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  async function submitDowntime() {
    if (queue.length === 0 || submitting) return;
    submitting = true;
    submitError = '';

    try {
      const resolvedActions = queue.map(def => {
        const { level, roll, deltas } = resolveAction(def);
        return { id: def.id, label: def.label, type: def.type, roll, level, text: '', deltas };
      });

      // Aggregate stat changes
      const statChanges = {};
      for (const a of resolvedActions) {
        for (const [k, v] of Object.entries(a.deltas)) {
          statChanges[k] = (statChanges[k] ?? 0) + v;
        }
      }
      const newStats = { ...characterStats };
      for (const [k, v] of Object.entries(statChanges)) {
        newStats[k] = (newStats[k] ?? 0) + v;
      }

      const resolvedAt = new Date().toLocaleString('en-US', {
        month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
      });

      await dbPut(`downtime/sessions/${active.index}/results/${codename}`, {
        resolvedAt,
        actions: resolvedActions,
      });
      await dbPut(`downtime/sessions/${active.index}/completedBy/${codename}`, true);
      await dbPatch(`downtime/stats/${codename}`, newStats);

      completedResult = { resolvedAt, actions: resolvedActions };
      characterStats = newStats;
      state = 'completed';
      queue = [];
      await loadSessionLog();
    } catch (e) {
      submitError = `Submission failed: ${e?.message ?? 'unknown error'}`;
    }

    submitting = false;
  }

  $: filledSlots = queue.length;
  $: canSubmit = filledSlots > 0 && !submitting;
  $: showLog = state !== 'loading' && sessionLog.length > 0;
</script>

<svelte:head>
  <title>Fate City: 1999 — Downtime</title>
</svelte:head>

<wire-status-bar jail layout="flex"></wire-status-bar>

<div class="dt-page">

  <!-- ── Header ────────────────────────────────────────────────────────────── -->
  <header class="dt-header">
    <a class="dt-back" href="{base}/home" aria-label="Back to home">&#8249;</a>
    <div>
      <div class="dt-header-title">DOWNTIME</div>
      <div class="dt-header-sub">FATE CITY: 1999</div>
    </div>
  </header>

  <!-- ── Main content ───────────────────────────────────────────────────────── -->
  <div class="dt-scroll">

    {#if active?.period && (state === 'picking' || state === 'completed')}
      <div class="dt-period-block">
        <h1 class="dt-period">{active.period.from} → {active.period.to}</h1>
        <p class="dt-subtitle">{ACTION_SLOTS} action slots per character · roll-based resolution</p>
      </div>
    {/if}

    {#if state === 'loading'}
      <div class="dt-empty-state">
        <div class="dt-empty-label">LOADING...</div>
      </div>

    {:else if state === 'no-codename'}
      <div class="dt-empty-state">
        <div class="dt-empty-label">NO CODENAME SET</div>
        <p class="dt-empty-sub">Set your operative codename in Settings before accessing Downtime.</p>
      </div>

    {:else if state === 'no-character'}
      <div class="dt-empty-state">
        <div class="dt-empty-label">CHARACTER NOT FOUND</div>
        <p class="dt-empty-sub">Codename <strong>{codename}</strong> is not registered in the downtime system. Contact your GM.</p>
      </div>

    {:else if state === 'inactive'}
      <div class="dt-empty-state">
        <div class="dt-empty-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
            <path d="M5 3h14M5 21h14M7 3v4l5 5-5 5v4M17 3v4l-5 5 5 5v4"/>
          </svg>
        </div>
        <div class="dt-empty-label">NO ACTIVE DOWNTIME</div>
        <p class="dt-empty-sub">The GM hasn't opened a downtime period yet. Check back when they do.</p>
      </div>

    {:else if state === 'picking'}

      <!-- Character card -->
      <div class="dt-char-card">
        <div class="dt-char-info">
          <div class="dt-char-name">{character.name}</div>
          <div class="dt-char-role">{character.role}</div>
        </div>
        <div class="dt-char-slots">{filledSlots}/{ACTION_SLOTS}</div>
      </div>

      <!-- Stats -->
      <div class="dt-section-label">CHARACTER STATS</div>
      <div class="dt-stats-row">
        {#each character.stats as stat}
          <div class="dt-stat">
            <div class="dt-stat-label">{stat.label}</div>
            <div class="dt-stat-value">{characterStats[stat.key] ?? 0}</div>
          </div>
        {/each}
      </div>

      <!-- Action queue -->
      <div class="dt-section-label">ACTION QUEUE — {filledSlots}/{ACTION_SLOTS} SLOTS</div>
      <div class="dt-queue">
        {#each {length: ACTION_SLOTS} as _, i}
          {#if queue[i]}
            <div class="dt-slot dt-slot--filled">
              <div class="dt-slot-inner">
                <span class="dt-slot-name">{queue[i].label}</span>
                <span class="dt-type-badge dt-type-{queue[i].type.toLowerCase()}">{queue[i].type}</span>
              </div>
              <button class="dt-slot-remove" on:click={() => removeFromQueue(i)} aria-label="Remove {queue[i].label}">✕</button>
            </div>
          {:else}
            <div class="dt-slot dt-slot--empty">
              <span class="dt-slot-placeholder">EMPTY SLOT</span>
            </div>
          {/if}
        {/each}
      </div>

      <!-- Available actions -->
      <div class="dt-section-label">AVAILABLE ACTIONS</div>
      <div class="dt-actions-list">
        {#each character.actions as action}
          <div class="dt-action-card">
            <div class="dt-action-info">
              <div class="dt-action-title">
                <span class="dt-action-name">{action.label}</span>
                <span class="dt-type-badge dt-type-{action.type.toLowerCase()}">{action.type}</span>
              </div>
              <p class="dt-action-desc">{action.description}</p>
              <p class="dt-action-reward">→ {action.rewardHint}</p>
            </div>
            <button
              class="dt-add-btn"
              disabled={queue.length >= ACTION_SLOTS}
              on:click={() => addToQueue(action)}
            >+ Add</button>
          </div>
        {/each}
      </div>

      {#if submitError}
        <p class="dt-error">{submitError}</p>
      {/if}

      <button class="dt-submit" disabled={!canSubmit} on:click={submitDowntime}>
        {submitting ? 'SUBMITTING...' : 'RUN DOWNTIME →'}
      </button>
      {#if filledSlots === 0}
        <p class="dt-submit-hint">Select actions for at least one character to continue.</p>
      {/if}

    {:else if state === 'completed'}

      <div class="dt-complete-banner">
        <div class="dt-complete-check" aria-hidden="true">✓</div>
        <div>
          <div class="dt-complete-title">DOWNTIME SUBMITTED</div>
          <p class="dt-complete-sub">Your actions for this period have been logged. The GM will add narrative shortly.</p>
        </div>
      </div>

      {#if completedResult?.actions?.length}
        <div class="dt-section-label">{character.name.toUpperCase()}</div>
        {#each completedResult.actions as action}
          <div class="dt-result-card">
            <div class="dt-result-head">
              <span class="dt-action-name">{action.label}</span>
              <span class="dt-level-badge dt-level-{action.level}">{action.level.toUpperCase()}</span>
              {#if action.roll != null}
                <span class="dt-roll-pill">{action.roll}</span>
              {/if}
              <span class="dt-result-type">{action.type.toLowerCase()}</span>
            </div>
            {#if action.text}
              <p class="dt-result-text">{action.text}</p>
            {/if}
            {#if Object.keys(action.deltas ?? {}).length > 0}
              <div class="dt-delta-row">
                {#each Object.entries(action.deltas) as [k, v]}
                  <span class="dt-delta-pill" class:negative={v < 0}>
                    {formatDelta(codename, k, v)}
                  </span>
                {/each}
              </div>
            {/if}
          </div>
        {/each}
      {/if}

    {/if}

    <!-- ── Session log ───────────────────────────────────────────────────── -->
    {#if showLog}
      <div class="dt-log">
        <div class="dt-section-label">SESSION LOG</div>
        {#each sessionLog as entry}
          <div class="dt-log-entry">
            <div class="dt-log-period">
              {entry.period?.from ?? '?'} → {entry.period?.to ?? '?'}
              {#if entry.resolvedAt}
                <span class="dt-log-ts">{entry.resolvedAt}</span>
              {/if}
            </div>
            <div class="dt-log-char">{character.name.toUpperCase()}</div>
            {#each entry.actions as action}
              <div class="dt-result-card dt-result-card--log">
                <div class="dt-result-head">
                  <span class="dt-action-name">{action.label}</span>
                  <span class="dt-level-badge dt-level-{action.level}">{action.level.toUpperCase()}</span>
                  {#if action.roll != null}
                    <span class="dt-roll-pill">{action.roll}</span>
                  {/if}
                  <span class="dt-result-type">{action.type?.toLowerCase()}</span>
                </div>
                {#if action.text}
                  <p class="dt-result-text">{action.text}</p>
                {/if}
                {#if Object.keys(action.deltas ?? {}).length > 0}
                  <div class="dt-delta-row">
                    {#each Object.entries(action.deltas) as [k, v]}
                      <span class="dt-delta-pill" class:negative={v < 0}>
                        {formatDelta(codename, k, v)}
                      </span>
                    {/each}
                  </div>
                {/if}
              </div>
            {/each}
          </div>
        {/each}
      </div>
    {/if}

  </div>
</div>

<style>
  .dt-page {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  /* ── Header ── */
  .dt-header {
    flex-shrink: 0;
    background: #0c0f16;
    border-bottom: 1px solid #1a2030;
    padding: 12px 20px;
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .dt-back {
    font-size: 20px;
    color: #c9a227;
    text-decoration: none;
    opacity: 0.9;
    line-height: 1;
    flex-shrink: 0;
    padding: 8px;
    margin: -8px;
  }
  .dt-back:hover { opacity: 1; }
  .dt-header-title {
    font-size: 15px;
    font-weight: 700;
    color: #e8dfc8;
    letter-spacing: 0.3px;
  }
  .dt-header-sub {
    font-size: 10px;
    color: #4a5a6a;
    letter-spacing: 1px;
    text-transform: uppercase;
    margin-top: 1px;
  }

  /* ── Period block (in scroll body) ── */
  .dt-period-block {
    padding: 14px 0 4px;
    margin-bottom: 4px;
  }
  .dt-period {
    font-size: 30px;
    font-weight: 800;
    letter-spacing: -0.5px;
    color: #e8dfc8;
    margin: 0 0 4px;
    line-height: 1.1;
  }
  /* dt-period--dim removed (period now lives in body, not header) */
  .dt-subtitle {
    font-size: 11px;
    color: #3a4a5a;
    margin: 0;
    letter-spacing: 0.3px;
  }

  /* ── Scrollable body ── */
  .dt-scroll {
    flex: 1;
    overflow-y: auto;
    padding: 18px 18px 80px;
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  /* ── Empty / idle states ── */
  .dt-empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 48px 24px;
    text-align: center;
    gap: 12px;
  }
  .dt-empty-icon svg {
    width: 44px;
    height: 44px;
    stroke: rgba(201, 162, 39, 0.3);
  }
  .dt-empty-label {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 2.5px;
    text-transform: uppercase;
    color: rgba(232, 223, 200, 0.35);
  }
  .dt-empty-sub {
    font-size: 12px;
    color: rgba(232, 223, 200, 0.35);
    line-height: 1.55;
    margin: 0;
    max-width: 280px;
  }

  /* ── Section labels ── */
  .dt-section-label {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 1.8px;
    text-transform: uppercase;
    color: #4a5a6a;
    margin: 20px 0 10px;
  }

  /* ── Character card ── */
  .dt-char-card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 16px;
    background: rgba(201, 162, 39, 0.1);
    border: 1px solid rgba(201, 162, 39, 0.4);
    border-radius: 6px;
    margin-top: 4px;
  }
  .dt-char-name {
    font-size: 16px;
    font-weight: 800;
    color: #e8dfc8;
    letter-spacing: 0.2px;
  }
  .dt-char-role {
    font-size: 9px;
    font-weight: 600;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: #c9a227;
    margin-top: 2px;
  }
  .dt-char-slots {
    font-family: 'Courier New', Courier, monospace;
    font-size: 13px;
    font-weight: 700;
    color: rgba(201, 162, 39, 0.55);
  }

  /* ── Stat row ── */
  .dt-stats-row {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
  .dt-stat {
    border: 1px solid rgba(201, 162, 39, 0.2);
    border-radius: 5px;
    padding: 8px 12px;
    min-width: 60px;
    background: rgba(255,255,255,0.02);
  }
  .dt-stat-label {
    font-size: 8.5px;
    font-weight: 600;
    letter-spacing: 1.2px;
    text-transform: uppercase;
    color: #4a5a6a;
    margin-bottom: 4px;
  }
  .dt-stat-value {
    font-size: 20px;
    font-weight: 700;
    color: #e8dfc8;
    line-height: 1;
    font-variant-numeric: tabular-nums;
  }

  /* ── Action queue ── */
  .dt-queue {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }
  .dt-slot {
    border-radius: 6px;
    min-height: 72px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 10px;
    position: relative;
  }
  .dt-slot--empty {
    border: 1.5px dashed rgba(201, 162, 39, 0.2);
  }
  .dt-slot--filled {
    border: 1px solid rgba(201, 162, 39, 0.5);
    background: rgba(201, 162, 39, 0.06);
    align-items: flex-start;
    flex-direction: column;
    justify-content: space-between;
    padding: 10px 10px 8px;
  }
  .dt-slot-placeholder {
    font-size: 8.5px;
    font-weight: 600;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: rgba(201, 162, 39, 0.2);
  }
  .dt-slot-inner {
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex: 1;
    min-width: 0;
  }
  .dt-slot-name {
    font-size: 11px;
    font-weight: 700;
    color: #e8dfc8;
    line-height: 1.2;
  }
  .dt-slot-remove {
    position: absolute;
    top: 5px;
    right: 6px;
    background: none;
    border: none;
    color: rgba(232, 223, 200, 0.3);
    font-size: 10px;
    cursor: pointer;
    padding: 2px 4px;
    line-height: 1;
  }
  .dt-slot-remove:hover { color: rgba(232, 223, 200, 0.7); }

  /* ── Type badges ── */
  .dt-type-badge {
    display: inline-block;
    font-size: 8px;
    font-weight: 700;
    letter-spacing: 1.2px;
    text-transform: uppercase;
    padding: 2px 6px;
    border-radius: 3px;
  }
  .dt-type-routine { background: rgba(56, 180, 130, 0.15); color: #38b482; }
  .dt-type-push    { background: rgba(124, 58, 237, 0.15); color: #9b6dff; }
  .dt-type-swing   { background: rgba(224, 90, 58, 0.15);  color: #e05a3a; }

  /* ── Available actions ── */
  .dt-actions-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .dt-action-card {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 14px 16px;
    border: 1px solid rgba(201, 162, 39, 0.15);
    border-radius: 6px;
    background: rgba(255,255,255,0.015);
  }
  .dt-action-info { flex: 1; min-width: 0; }
  .dt-action-title {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 5px;
    flex-wrap: wrap;
  }
  .dt-action-name {
    font-size: 13.5px;
    font-weight: 700;
    color: #e8dfc8;
  }
  .dt-action-desc {
    font-size: 11.5px;
    color: rgba(232, 223, 200, 0.55);
    margin: 0 0 5px;
    line-height: 1.45;
  }
  .dt-action-reward {
    font-size: 10.5px;
    color: #c9a227;
    margin: 0;
    letter-spacing: 0.2px;
  }
  .dt-add-btn {
    flex-shrink: 0;
    background: rgba(201, 162, 39, 0.12);
    border: 1px solid rgba(201, 162, 39, 0.4);
    border-radius: 5px;
    color: #c9a227;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.5px;
    padding: 8px 14px;
    cursor: pointer;
    white-space: nowrap;
    transition: background 0.15s ease;
    font-family: inherit;
  }
  .dt-add-btn:hover { background: rgba(201, 162, 39, 0.22); }
  .dt-add-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  /* ── Submit ── */
  .dt-submit {
    width: 100%;
    margin-top: 22px;
    padding: 17px;
    background: rgba(201, 162, 39, 0.18);
    border: 1px solid rgba(201, 162, 39, 0.6);
    border-radius: 5px;
    color: #c9a227;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 3px;
    text-transform: uppercase;
    cursor: pointer;
    font-family: inherit;
    transition: background 0.15s ease;
  }
  .dt-submit:hover:not(:disabled) { background: rgba(201, 162, 39, 0.28); }
  .dt-submit:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }
  .dt-submit-hint {
    text-align: center;
    font-size: 10.5px;
    color: rgba(232, 223, 200, 0.3);
    margin: 8px 0 0;
    letter-spacing: 0.3px;
  }
  .dt-error {
    font-family: 'Courier New', Courier, monospace;
    font-size: 10px;
    color: #e05a3a;
    letter-spacing: 1px;
    margin: 12px 0 0;
    text-transform: uppercase;
  }

  /* ── Completed banner ── */
  .dt-complete-banner {
    display: flex;
    align-items: flex-start;
    gap: 14px;
    padding: 16px;
    border: 1px solid rgba(56, 180, 130, 0.35);
    border-radius: 6px;
    background: rgba(56, 180, 130, 0.07);
    margin-bottom: 4px;
  }
  .dt-complete-check {
    font-size: 18px;
    color: #38b482;
    flex-shrink: 0;
    line-height: 1.4;
  }
  .dt-complete-title {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: #38b482;
    margin-bottom: 5px;
  }
  .dt-complete-sub {
    font-size: 11.5px;
    color: rgba(232, 223, 200, 0.5);
    margin: 0;
    line-height: 1.5;
  }

  /* ── Result cards ── */
  .dt-result-card {
    padding: 12px 14px;
    border: 1px solid rgba(201, 162, 39, 0.15);
    border-radius: 6px;
    background: rgba(255,255,255,0.015);
    margin-bottom: 10px;
  }
  .dt-result-card--log { margin-bottom: 8px; }
  .dt-result-head {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    margin-bottom: 6px;
  }
  .dt-result-type {
    font-size: 9px;
    color: #3a4a5a;
    letter-spacing: 0.5px;
    margin-left: auto;
  }
  .dt-result-text {
    font-size: 12px;
    color: rgba(232, 223, 200, 0.6);
    font-style: italic;
    line-height: 1.55;
    margin: 6px 0 8px;
  }

  /* ── Level badges ── */
  .dt-level-badge {
    font-size: 8px;
    font-weight: 700;
    letter-spacing: 1px;
    padding: 2px 7px;
    border-radius: 3px;
  }
  .dt-level-success { background: rgba(56, 180, 130, 0.18); color: #38b482; }
  .dt-level-partial { background: rgba(201, 162, 39, 0.18); color: #c9a227; }
  .dt-level-fail    { background: rgba(224, 90, 58, 0.18);  color: #e05a3a; }

  /* ── Roll pill ── */
  .dt-roll-pill {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    border: 1.5px solid rgba(201, 162, 39, 0.5);
    border-radius: 4px;
    font-size: 11px;
    font-weight: 700;
    font-family: 'Courier New', Courier, monospace;
    color: #c9a227;
  }

  /* ── Delta pills ── */
  .dt-delta-row {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .dt-delta-pill {
    font-size: 10.5px;
    font-weight: 700;
    padding: 3px 9px;
    border-radius: 4px;
    background: rgba(201, 162, 39, 0.15);
    color: #c9a227;
  }
  .dt-delta-pill.negative {
    background: rgba(224, 90, 58, 0.15);
    color: #e05a3a;
  }

  /* ── Session log ── */
  .dt-log {
    margin-top: 10px;
  }
  .dt-log-entry {
    border: 1px solid rgba(201, 162, 39, 0.12);
    border-radius: 6px;
    padding: 14px;
    margin-bottom: 14px;
    background: rgba(255,255,255,0.01);
  }
  .dt-log-period {
    font-size: 14px;
    font-weight: 700;
    color: #e8dfc8;
    margin-bottom: 4px;
    display: flex;
    align-items: baseline;
    gap: 10px;
  }
  .dt-log-ts {
    font-size: 10px;
    color: #3a4a5a;
    font-weight: 400;
  }
  .dt-log-char {
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: #c9a227;
    margin-bottom: 10px;
  }
</style>
