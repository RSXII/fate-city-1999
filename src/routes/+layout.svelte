<script>
  import { onMount, onDestroy } from 'svelte';
  import { browser } from '$app/environment';
  import { statusBarConfig } from '$lib/stores/statusBar.js';

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

  // Build the wire-status-bar attribute string reactively
  $: statusAttrs = buildAttrs($statusBarConfig);

  function buildAttrs(cfg) {
    if (cfg.appLabel) return `app-label="${cfg.appLabel}" layout="flex"`;
    if (cfg.jail !== false) return 'jail layout="flex"';
    return 'layout="flex"';
  }
</script>

<!-- wire-status-bar rendered here so it appears on every page.
     Per-page overrides come through the statusBarConfig store. -->
{#if $statusBarConfig.appLabel}
  <wire-status-bar app-label={$statusBarConfig.appLabel} layout="flex"></wire-status-bar>
{:else if $statusBarConfig.jail !== false}
  <wire-status-bar jail layout="flex"></wire-status-bar>
{:else}
  <wire-status-bar layout="flex"></wire-status-bar>
{/if}

<slot />

<wire-home-bar layout="flex"></wire-home-bar>
