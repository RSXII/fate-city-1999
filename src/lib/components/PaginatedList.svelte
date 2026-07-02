<script>
  import { createEventDispatcher } from 'svelte';

  /** Array of items to paginate. */
  export let items = [];
  /** Number of items per page. */
  export let pageSize = 20;

  const dispatch = createEventDispatcher();

  let currentPage = 0;

  $: totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  // Clamp page index if items shrink (e.g. after a filter change)
  $: if (currentPage >= totalPages) currentPage = totalPages - 1;
  $: pageItems = items.slice(currentPage * pageSize, (currentPage + 1) * pageSize);

  function prev() {
    if (currentPage > 0) { currentPage--; dispatch('pagechange', currentPage); }
  }
  function next() {
    if (currentPage < totalPages - 1) { currentPage++; dispatch('pagechange', currentPage); }
  }
</script>

{#each pageItems as item, i}
  <slot {item} index={currentPage * pageSize + i} />
{/each}

{#if totalPages > 1}
  <div class="pg-controls">
    <button class="pg-btn" disabled={currentPage === 0} on:click={prev} aria-label="Previous page">‹</button>
    <span class="pg-label">{currentPage + 1} / {totalPages}</span>
    <button class="pg-btn" disabled={currentPage >= totalPages - 1} on:click={next} aria-label="Next page">›</button>
  </div>
{/if}

<style>
  .pg-controls {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 14px;
    padding: 14px 0 6px;
    max-width: 480px;
    margin: 0 auto;
  }
  .pg-btn {
    background: none;
    border: 1px solid #1a2030;
    color: #6a7d90;
    font-size: 18px;
    line-height: 1;
    padding: 3px 14px 5px;
    border-radius: 4px;
    cursor: pointer;
    transition: border-color 0.15s ease, color 0.15s ease;
  }
  .pg-btn:hover:not(:disabled) {
    border-color: #c9a227;
    color: #c9a227;
  }
  .pg-btn:disabled {
    opacity: 0.28;
    cursor: not-allowed;
  }
  .pg-label {
    font-size: 10px;
    letter-spacing: 1.2px;
    text-transform: uppercase;
    color: #3a4a5a;
    min-width: 40px;
    text-align: center;
  }
</style>
