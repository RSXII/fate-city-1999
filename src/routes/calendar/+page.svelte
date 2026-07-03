<script>
  import { base } from '$app/paths';
  import { browser } from '$app/environment';
  import { onMount, onDestroy } from 'svelte';
  import { dbGet } from '$lib/firebase-db.js';

  const DEFAULT_DATE = { year: 1999, month: 2, day: 2 };

  const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const DOW_LABELS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

  let currentDate = { ...DEFAULT_DATE };
  let viewYear = DEFAULT_DATE.year;
  let viewMonth = DEFAULT_DATE.month; // 1-indexed
  let firstLoad = true;
  let pollTimer;

  async function loadCurrentDate() {
    const data = await dbGet('calendar/currentDate');
    if (data && data.year && data.month && data.day) {
      currentDate = data;
    } else {
      currentDate = { ...DEFAULT_DATE };
    }
    if (firstLoad) {
      viewYear = currentDate.year;
      viewMonth = currentDate.month;
      firstLoad = false;
    }
  }

  function daysInMonth(year, month) {
    // new Date(year, month, 0) → day 0 of next month = last day of this month
    return new Date(year, month, 0).getDate();
  }

  function firstDayOfMonth(year, month) {
    return new Date(year, month - 1, 1).getDay(); // 0 = Sunday
  }

  function prevMonth() {
    if (viewMonth === 1) { viewMonth = 12; viewYear -= 1; }
    else { viewMonth -= 1; }
  }

  function nextMonth() {
    if (viewMonth === 12) { viewMonth = 1; viewYear += 1; }
    else { viewMonth += 1; }
  }

  $: isToday = (day) =>
    viewYear === currentDate.year &&
    viewMonth === currentDate.month &&
    day === currentDate.day;

  $: totalDays = daysInMonth(viewYear, viewMonth);
  $: offset = firstDayOfMonth(viewYear, viewMonth);

  onMount(() => {
    if (!browser) return;
    loadCurrentDate();
    pollTimer = setInterval(loadCurrentDate, 10000);
  });

  onDestroy(() => {
    clearInterval(pollTimer);
  });
</script>

<svelte:head>
  <title>Fate City: 1999 — Calendar</title>
</svelte:head>

<wire-status-bar jail layout="flex"></wire-status-bar>
<wire-header back="{base}/home" title="Calendar" subtitle="Fate City: 1999"></wire-header>

<div class="cal-wrap">
  <!-- Month navigation -->
  <div class="cal-nav">
    <button class="cal-nav-btn" on:click={prevMonth} aria-label="Previous month">‹</button>
    <span class="cal-nav-label">{MONTH_NAMES[viewMonth - 1]} {viewYear}</span>
    <button class="cal-nav-btn" on:click={nextMonth} aria-label="Next month">›</button>
  </div>

  <!-- Calendar grid -->
  <div class="cal-grid">
    <!-- Day-of-week header -->
    {#each DOW_LABELS as dow}
      <div class="cal-dow">{dow}</div>
    {/each}

    <!-- Leading empty cells for offset -->
    {#each { length: offset } as _}
      <div class="cal-empty" aria-hidden="true"></div>
    {/each}

    <!-- Day cells -->
    {#each { length: totalDays } as _, i}
      {@const day = i + 1}
      <div class="cal-day" class:cal-day--today={isToday(day)}>
        <span class="cal-day-num">{day}</span>
      </div>
    {/each}
  </div>

  <!-- In-game date footer -->
  <div class="cal-footer">
    <span class="cal-footer-label">In-Game Date</span>
    <span class="cal-footer-date">
      {MONTH_NAMES[currentDate.month - 1]} {currentDate.day}, {currentDate.year}
    </span>
  </div>
</div>

<style>
  .cal-wrap {
    flex: 1;
    overflow-y: auto;
    background: #0d1118;
    padding: 20px 10px 48px;
    display: flex;
    flex-direction: column;
  }

  /* ── Navigation ─────────────────────────────────────────────────────────── */
  .cal-nav {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 6px 18px;
    border-bottom: 1px solid rgba(201, 162, 39, 0.18);
    margin-bottom: 14px;
    flex-shrink: 0;
  }

  .cal-nav-btn {
    background: none;
    border: none;
    color: #c9a227;
    font-size: 30px;
    line-height: 1;
    padding: 4px 16px 6px;
    cursor: pointer;
    border-radius: 6px;
    transition: background 0.15s;
    -webkit-tap-highlight-color: transparent;
  }
  .cal-nav-btn:active {
    background: rgba(201, 162, 39, 0.12);
  }

  .cal-nav-label {
    font-size: 14px;
    font-weight: 700;
    letter-spacing: 3px;
    text-transform: uppercase;
    color: #e8dfc8;
    font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif;
  }

  /* ── Grid ───────────────────────────────────────────────────────────────── */
  .cal-grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 4px 0;
    flex: 1;
  }

  .cal-dow {
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: rgba(201, 162, 39, 0.45);
    text-align: center;
    padding: 2px 0 12px;
    font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif;
  }

  .cal-empty {
    aspect-ratio: 1;
  }

  .cal-day {
    aspect-ratio: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
  }

  .cal-day-num {
    font-size: 13px;
    color: rgba(232, 223, 200, 0.5);
    font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif;
    letter-spacing: 0.2px;
    position: relative;
    z-index: 1;
  }

  /* ── Today indicator (gold filled circle) ──────────────────────────────── */
  .cal-day--today::before {
    content: '';
    position: absolute;
    inset: 8%;
    border-radius: 50%;
    background: #c9a227;
    box-shadow:
      0 0 10px rgba(201, 162, 39, 0.7),
      0 0 22px rgba(201, 162, 39, 0.3);
  }

  .cal-day--today .cal-day-num {
    color: #0a0710;
    font-weight: 800;
  }

  /* ── In-game date footer ────────────────────────────────────────────────── */
  .cal-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin: 16px 6px 0;
    padding: 12px 14px;
    border: 1px solid rgba(201, 162, 39, 0.18);
    border-radius: 6px;
    background: rgba(201, 162, 39, 0.04);
    flex-shrink: 0;
  }

  .cal-footer-label {
    font-size: 8px;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: rgba(201, 162, 39, 0.5);
    font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif;
    font-weight: 600;
  }

  .cal-footer-date {
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.4px;
    color: #c9a227;
    font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif;
  }
</style>
