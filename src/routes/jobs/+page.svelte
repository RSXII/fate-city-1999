<script>
  import { base } from '$app/paths';
  import { browser } from '$app/environment';
  import { onMount, onDestroy } from 'svelte';
  import { dbGet } from '$lib/firebase-db.js';
  import { visibilityAwareInterval } from '$lib/utils.js';

  const STATUS_CONFIG = {
    active:      { label: 'Active',      color: '#22c55e', rule: '#166534' },
    danger:      { label: 'In Danger',   color: '#f59e0b', rule: '#92400e' },
    compromised: { label: 'Compromised', color: '#e05a3a', rule: '#7c1d0d' },
  };

  let jobs = [];
  let pollInterval;

  async function loadJobs() {
    try {
      const data = await dbGet('jobs');
      if (!data) { jobs = []; return; }
      jobs = Object.keys(data)
        .map(k => { const j = data[k]; j._id = k; return j; })
        .filter(j => j.title && j.staged !== false)
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    } catch { jobs = []; }
  }

  onMount(() => {
    if (!browser) return;
    loadJobs();
    pollInterval = visibilityAwareInterval(loadJobs, 8000);
  });

  onDestroy(() => {
    if (pollInterval) pollInterval();
  });
</script>

<svelte:head>
  <title>Fate City: 1999 — Jobs</title>
</svelte:head>

<wire-status-bar jail layout="flex"></wire-status-bar>
<wire-header back="{base}/home" title="Jobs" subtitle="Active Operations — Fate City: 1999" layout="flex"></wire-header>

<div class="jobs-scroll">
  {#if jobs.length === 0}
    <div class="empty">
      <div class="empty-icon">
        <svg viewBox="0 0 24 24" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V7l-5-4z" />
          <polyline points="14 3 14 7 18 7" />
          <line x1="8" y1="12" x2="16" y2="12" />
          <line x1="8" y1="15.5" x2="16" y2="15.5" />
          <line x1="8" y1="19" x2="12" y2="19" />
        </svg>
      </div>
      <p class="empty-label">No active jobs</p>
      <p class="empty-sub">Your Benefactor hasn't filed any active operations.</p>
    </div>
  {:else}
    {#each jobs as job (job._id)}
      {@const sc = STATUS_CONFIG[job.status] ?? STATUS_CONFIG.active}
      {@const steps = Array.isArray(job.steps) ? [...job.steps].reverse() : []}
      <div class="job-card">
        <div class="job-stripe" style="background:{sc.rule}"></div>
        <div class="job-head">
          <span class="job-fileno">FILE NO. {job.fileNo ?? '—'}</span>
          <span class="job-status" style="color:{sc.color};border-color:{sc.color}40;background:{sc.color}18">
            ● {sc.label}
          </span>
        </div>
        <div class="job-hr" style="border-color:{sc.rule}99"></div>
        <div class="job-body">
          <h2 class="job-title">{job.title}</h2>
          {#if job.brief}
            <p class="job-brief">{job.brief}</p>
          {/if}
          {#if steps.length}
            <div class="steps-head">// Progress</div>
            <ul class="steps">
              {#each steps as step}
                <li class="step">
                  {step.text}{#if step.date}<span class="step-date">&nbsp;— {step.date}</span>{/if}
                </li>
              {/each}
            </ul>
          {/if}
        </div>
      </div>
    {/each}
  {/if}
</div>

<style>
  .jobs-scroll {
    flex: 1;
    overflow-y: auto;
    background: #0d1118;
    padding: 20px 16px 64px;
    scrollbar-width: thin;
    scrollbar-color: rgba(201, 162, 39, 0.2) transparent;
  }

  /* ── Empty state ─────────────────────────────────────────────────────────── */
  .empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 60px 32px;
    gap: 12px;
    text-align: center;
  }
  .empty-icon svg {
    width: 44px;
    height: 44px;
    stroke: rgba(201, 162, 39, 0.22);
    fill: none;
  }
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

  /* ── Job card ────────────────────────────────────────────────────────────── */
  .job-card {
    max-width: 520px;
    margin: 0 auto 18px;
    background: #0c0f16;
    border: 1px solid rgba(201, 162, 39, 0.22);
    border-radius: 2px;
    position: relative;
    overflow: hidden;
  }

  .job-stripe {
    position: absolute;
    top: 0; left: 0; bottom: 0;
    width: 4px;
  }

  .job-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 11px 16px 0 20px;
  }

  .job-fileno {
    font-family: 'Courier New', monospace;
    font-size: 9px;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: rgba(201, 162, 39, 0.45);
  }

  .job-status {
    font-family: 'Courier New', monospace;
    font-size: 9px;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    padding: 3px 8px;
    border: 1px solid;
    border-radius: 2px;
  }

  .job-hr {
    margin: 10px 16px 0 20px;
    border: none;
    border-top: 2px solid;
  }

  .job-body {
    padding: 14px 16px 18px 20px;
  }

  .job-title {
    font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif;
    font-size: 17px;
    font-weight: 800;
    letter-spacing: 2.5px;
    text-transform: uppercase;
    color: #c9a227;
    margin: 0 0 6px;
    line-height: 1.2;
  }

  .job-brief {
    font-size: 12px;
    line-height: 1.6;
    color: rgba(232, 223, 200, 0.42);
    margin: 0 0 14px;
    letter-spacing: 0.3px;
  }

  .steps-head {
    font-family: 'Courier New', monospace;
    font-size: 9px;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: rgba(201, 162, 39, 0.32);
    margin-bottom: 9px;
    padding-top: 11px;
    border-top: 1px solid rgba(201, 162, 39, 0.1);
  }

  .steps {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 7px;
  }

  .step {
    font-size: 12px;
    line-height: 1.5;
    color: rgba(232, 223, 200, 0.65);
    padding-left: 16px;
    position: relative;
    letter-spacing: 0.2px;
  }
  .step::before {
    content: '—';
    position: absolute;
    left: 0;
    color: rgba(201, 162, 39, 0.38);
    font-weight: 700;
  }
  .step-date {
    color: #c9a227;
    font-size: 11px;
    letter-spacing: 0.3px;
  }
</style>
