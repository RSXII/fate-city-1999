<script>
  // Ambient AI-chatter terminal — a scheduler enqueues a random line from
  // the placeholder content pool on an irregular gap; a pump prints one
  // line at a time and prunes the oldest once past the max count. This is
  // DOM pruning, not real scrolling, matching the reference module.
  //
  // A separate non-scrolling "last result" slot holds real command output
  // (Stage 4) so fast ambient chatter can't scroll a meaningful answer out
  // of view before the player reads it.

  import { onMount, onDestroy } from 'svelte';
  import { AMBIENT_LINES } from '$lib/data/twins-ai-content.js';

  export let lastResult = null; // { text, danger } — set by TerminalInput (Stage 4)

  const MAX_LINES = 7;
  const LINE_MS = 420;
  const GAP_MIN_MS = 2600;
  const GAP_MAX_MS = 4400;

  let lines = [];
  let queue = [];
  let scheduleTimer;
  let pumpTimer;

  export function enqueue(text, { urgent = false } = {}) {
    if (urgent) queue = [text, ...queue];
    else queue = [...queue, text];
    pump();
  }

  function pump() {
    if (pumpTimer || !queue.length) return;
    const [next, ...rest] = queue;
    queue = rest;
    lines = [...lines.slice(-(MAX_LINES - 1)), next];
    pumpTimer = setTimeout(() => {
      pumpTimer = null;
      if (queue.length) pump();
    }, LINE_MS);
  }

  function scheduleAmbient() {
    const gap = GAP_MIN_MS + Math.random() * (GAP_MAX_MS - GAP_MIN_MS);
    scheduleTimer = setTimeout(() => {
      const line = AMBIENT_LINES[Math.floor(Math.random() * AMBIENT_LINES.length)];
      enqueue(line);
      scheduleAmbient();
    }, gap);
  }

  onMount(() => {
    scheduleAmbient();
  });

  onDestroy(() => {
    if (scheduleTimer) clearTimeout(scheduleTimer);
    if (pumpTimer) clearTimeout(pumpTimer);
  });
</script>

<div class="term-log">
  <div class="term-log-lines" aria-live="polite">
    {#each lines as line, i (i)}
      <div class="term-log-line">{line}</div>
    {/each}
  </div>

  {#if lastResult}
    <div class="term-result" class:danger={lastResult.danger}>{lastResult.text}</div>
  {/if}
</div>

<style>
  .term-log {
    width: 88%;
    max-width: 360px;
    margin: 12px auto 0;
    font-family: 'Courier New', Courier, monospace;
    font-size: 10.5px;
    letter-spacing: 0.5px;
    text-align: left;
  }

  .term-log-lines {
    height: 92px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    color: rgba(234, 255, 242, 0.55);
    border-top: 1px solid rgba(234, 255, 242, 0.12);
    border-bottom: 1px solid rgba(234, 255, 242, 0.12);
    padding: 4px 0;
  }
  .term-log-line { padding: 1px 0; }

  .term-result {
    margin-top: 6px;
    color: var(--twins-accent, #3dffa0);
    min-height: 14px;
  }
  .term-result.danger { color: var(--twins-danger, #ff3d5e); }
</style>
