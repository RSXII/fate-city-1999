<script>
  import { onMount, onDestroy } from 'svelte';
  import { browser } from '$app/environment';
  import { page } from '$app/stores';

  $: isConsole = $page.route.id?.startsWith('/gm-console');

  let clockCleanup;

  onMount(async () => {
    if (browser) {
      const { startClock } = await import('$lib/wire-clock.js');
      clockCleanup = startClock();
    }
  });

  onDestroy(() => {
    if (clockCleanup) clockCleanup();
  });
</script>

<!-- Each page renders its own wire-status-bar with the attributes it needs.
     The layout only handles the clock and wire-home-bar. -->
<slot />

{#if !isConsole}
  <wire-home-bar layout="flex"></wire-home-bar>
{/if}

<style>
  /* Global resets — applied once by the root layout */
  :global(*, *::before, *::after) {
    box-sizing: border-box;
  }
  :global(html, body) {
    margin: 0;
    height: 100%;
    overflow: hidden; /* prevent window-level scroll; all scrolling in designated containers */
  }
  :global(body) {
    display: flex;
    flex-direction: column;
    height: 100vh;
    background: #0d1118;
    font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif;
  }
</style>
