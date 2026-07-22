<script>
  /** url — the full URL to the attached file */
  export let url;

  $: filename = (() => {
    try {
      return decodeURIComponent(url.split('/').pop().split('?')[0]);
    } catch {
      return url;
    }
  })();

  $: isPdf = filename.toLowerCase().endsWith('.pdf');
</script>

<a href={url} class="attachment" target="_blank" rel="noopener noreferrer">
  {isPdf ? '📄' : '📎'} {filename} — View
</a>

<style>
  .attachment {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin-top: 8px;
    padding: 6px 12px;
    background: rgba(201, 162, 39, 0.07);
    border: 1px solid rgba(201, 162, 39, 0.22);
    border-radius: 5px;
    font-size: 11.5px;
    font-family: 'Courier New', Courier, monospace;
    color: #c9a227;
    text-decoration: none;
    letter-spacing: 0.3px;
    word-break: break-all;
  }
  .attachment:hover {
    background: rgba(201, 162, 39, 0.14);
  }
</style>
