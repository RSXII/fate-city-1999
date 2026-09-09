<script>
  // Terminal command input. Enter splits on whitespace; the first token is
  // looked up case-insensitively in the shared COMMANDS registry. Unknown
  // commands print "COMMAND NOT RECOGNIZED", matching the reference module.
  // Typed input is always echoed into the ambient log as an urgent
  // (queue-jumping) entry.

  import { createEventDispatcher } from 'svelte';
  import { COMMANDS } from '$lib/data/twins-ai.js';

  export let codename = null;
  export let intrusion = null; // { startedAt, handle, deadlineMs } | null

  const dispatch = createEventDispatcher();

  let draft = '';

  function submit() {
    const raw = draft.trim();
    draft = '';
    if (!raw) return;

    dispatch('echo', { text: `> ${raw}`, urgent: true });

    const [keyword, ...args] = raw.split(/\s+/);
    const handler = COMMANDS.get(keyword.toLowerCase());
    if (!handler) {
      dispatch('result', { text: 'COMMAND NOT RECOGNIZED.', danger: true });
      return;
    }

    const outcome = handler.run({ codename, intrusion }, args);
    if (typeof outcome === 'string') {
      dispatch('result', { text: outcome });
    } else if (outcome?.resolve) {
      dispatch('result', { text: outcome.text });
      dispatch('resolve');
    } else if (outcome) {
      dispatch('result', { text: outcome.text, danger: outcome.danger });
    }
  }

  function handleKey(e) {
    if (e.key === 'Enter') submit();
  }
</script>

<div class="term-input-row">
  <span class="term-prompt" aria-hidden="true">&gt;</span>
  <input
    class="term-input"
    type="text"
    autocomplete="off"
    autocapitalize="off"
    spellcheck="false"
    placeholder="type a command…"
    bind:value={draft}
    on:keydown={handleKey}
  />
</div>

<style>
  .term-input-row {
    width: 88%;
    max-width: 360px;
    margin: 8px auto 0;
    display: flex;
    align-items: center;
    gap: 6px;
    font-family: 'Courier New', Courier, monospace;
    font-size: 12px;
  }
  .term-prompt {
    color: var(--twins-accent, #3dffa0);
  }
  .term-input {
    flex: 1;
    background: transparent;
    border: none;
    border-bottom: 1px solid rgba(234, 255, 242, 0.25);
    color: var(--twins-ink, #eafff2);
    font-family: inherit;
    font-size: inherit;
    padding: 4px 2px;
    outline: none;
  }
  .term-input:focus {
    border-bottom-color: var(--twins-accent, #3dffa0);
  }
</style>
