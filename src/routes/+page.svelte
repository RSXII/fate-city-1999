<script>
  import { base } from '$app/paths';
  import { browser } from '$app/environment';
  import { onMount } from 'svelte';

  onMount(() => {
    // Auto-redirect to home after splash — for now just navigate immediately
    // Phase 6 will build the full splash screen here
    window.location.replace(base + '/home');
  });
</script>

<svelte:head>
  <title>Fate City: 1999 — Wire</title>
</svelte:head>
