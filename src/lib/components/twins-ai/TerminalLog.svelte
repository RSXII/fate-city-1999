<script>
  // Non-scrolling display for the last terminal command's result (set by
  // TerminalInput). No ambient/idle chatter — the HUD stays quiet until the
  // player actually types something.

  export let lastResult = null; // { text, danger } | null
</script>

{#if lastResult}
  <div class="term-result" class:danger={lastResult.danger}>{lastResult.text}</div>
{/if}

<style>
  .term-result {
    width: 88%;
    max-width: 360px;
    margin: 12px auto 0;
    font-family: 'Courier New', Courier, monospace;
    font-size: 11px;
    letter-spacing: 0.5px;
    text-align: center;
    color: var(--twins-accent, #3dffa0);
    min-height: 14px;
  }
  .term-result.danger { color: var(--twins-danger, #ff3d5e); }
</style>
