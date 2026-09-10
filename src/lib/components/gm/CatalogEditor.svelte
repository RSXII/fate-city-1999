<script>
  import { onMount, onDestroy } from 'svelte';
  import { subscribeContent, setContentEntry, deleteContentEntry } from '$lib/content-db.js';

  // ── Config ───────────────────────────────────────────────────────────────
  export let collection;           // Firestore collection name, e.g. 'persons'
  export let label;                // Display label, e.g. 'Persons'
  export let typeField = null;     // 'category' | 'district' | null
  export let typeOptions = [];     // static [{ key, label }] — ignored if typeOptionsSource is set
  export let typeOptionsSource = null; // collection name to derive live type options from (by `name`)
  export let supportsRedacted = false; // persons only — password-gated section content
  export let githubImagesApi;      // GitHub contents API URL for the images/ folder

  const emptyForm = () => ({
    id: '',
    fileNo: '',
    stamp: '',
    name: '',
    epithet: '',
    type: '',
    order: 0,
    accentColor: '#c9a227',
    images: [], // { name, path, url }
    stats: [],  // { label, value }
    sections: [], // { heading, paragraphsText, hooksText, redacted, redactedText }
    quoteText: '',
    quoteCite: '',
  });

  let entries = [];
  let _sub = null;
  let dynamicTypeOptions = [];
  let _typeSub = null;

  $: resolvedTypeOptions = typeOptionsSource ? dynamicTypeOptions : typeOptions;

  onMount(() => {
    _sub = subscribeContent(collection, data => { entries = data; });
    if (typeOptionsSource) {
      _typeSub = subscribeContent(typeOptionsSource, data => {
        dynamicTypeOptions = data.map(d => ({ key: d.name, label: d.name }));
      });
    }
  });
  onDestroy(() => {
    if (_sub) _sub();
    if (_typeSub) _typeSub();
  });

  let search = '';
  $: filteredEntries = entries.filter(e => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (e.name || '').toLowerCase().includes(q) || (e.fileNo || '').toLowerCase().includes(q);
  });

  function typeLabel(key) {
    return resolvedTypeOptions.find(o => o.key === key)?.label ?? key ?? '—';
  }

  // ── Form state ───────────────────────────────────────────────────────────
  let mode = 'list'; // 'list' | 'edit' | 'create'
  let form = emptyForm();
  let status = { text: '', type: '' };
  let saving = false;
  let deletingId = null;

  function slugify(str) {
    return String(str).toLowerCase().trim()
      .replace(/['"]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  function decodeRedacted(encoded) {
    try {
      return decodeURIComponent(
        Array.prototype.map.call(atob(encoded), c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')
      );
    } catch { return ''; }
  }
  function encodeRedacted(text) {
    return btoa(encodeURIComponent(text));
  }

  function startCreate() {
    form = emptyForm();
    form.order = entries.length ? Math.max(...entries.map(e => e.order ?? 0)) + 1 : 0;
    status = { text: '', type: '' };
    mode = 'create';
  }

  function startEdit(entry) {
    const redactedText = entry.redactedEncoded ? decodeRedacted(entry.redactedEncoded) : '';
    form = {
      id: entry.id,
      fileNo: entry.fileNo || '',
      stamp: entry.stamp || '',
      name: entry.name || '',
      epithet: entry.epithet || '',
      type: (typeField && entry[typeField]) || '',
      order: entry.order ?? 0,
      accentColor: entry.colors?.accent || '#c9a227',
      images: (entry.images || []).map(src => ({ name: src.split('/').pop(), path: src, url: src })),
      stats: (entry.stats || []).map(s => ({ ...s })),
      sections: (entry.sections || []).map(sec => {
        const redacted = (sec.paragraphs || []).includes('PASSWORD');
        return {
          heading: sec.heading || '',
          paragraphsText: redacted ? '' : (sec.paragraphs || []).join('\n\n'),
          hooksText: (sec.hooks || []).join('\n'),
          redacted,
          redactedText: redacted ? redactedText : '',
        };
      }),
      quoteText: entry.quote?.text || '',
      quoteCite: entry.quote?.cite || '',
    };
    status = { text: '', type: '' };
    mode = 'edit';
  }

  function cancelEdit() {
    mode = 'list';
    status = { text: '', type: '' };
  }

  function addStat() { form.stats = [...form.stats, { label: '', value: '' }]; }
  function removeStat(i) { form.stats = form.stats.filter((_, idx) => idx !== i); }

  function addSection() {
    form.sections = [...form.sections, { heading: '', paragraphsText: '', hooksText: '', redacted: false, redactedText: '' }];
  }
  function removeSection(i) { form.sections = form.sections.filter((_, idx) => idx !== i); }
  function toggleSectionRedacted(i) {
    form.sections = form.sections.map((s, idx) => idx === i ? { ...s, redacted: !s.redacted } : s);
  }

  // ── Images (GitHub repo browser — same source the Case Files tab uses) ────
  let imagePicker = { open: false, loading: false, error: '', images: [] };

  async function toggleImagePicker() {
    if (imagePicker.open) { imagePicker = { ...imagePicker, open: false }; return; }
    imagePicker = { open: true, loading: true, error: '', images: [] };
    try {
      const res = await fetch(githubImagesApi);
      if (res.status === 404) {
        imagePicker = { ...imagePicker, loading: false, error: 'No images found in images/ yet.' };
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const images = data.filter(f => f.type === 'file' && /\.(png|jpe?g|gif|webp)$/i.test(f.name));
      imagePicker = { ...imagePicker, loading: false, images, error: images.length ? '' : 'No images found.' };
    } catch (e) {
      imagePicker = { ...imagePicker, loading: false, error: `Failed: ${e?.message ?? 'error'}` };
    }
  }

  function addImage(img) {
    // img.path is repo-relative from the API root (static/images/...) — strip
    // the static/ prefix so it matches the images/foo.png convention every
    // dossier entry already uses (static/ is the SvelteKit web root).
    const relPath = img.path.replace(/^static\//, '');
    if (form.images.some(i => i.path === relPath)) return;
    form.images = [...form.images, { name: img.name, path: relPath, url: img.download_url }];
  }
  function removeImage(name) {
    form.images = form.images.filter(i => i.name !== name);
  }

  async function save() {
    const name = form.name.trim();
    const id = (mode === 'create' ? slugify(form.id || name) : form.id);
    if (!name) { status = { text: 'A name is required.', type: 'err' }; return; }
    if (!id) { status = { text: 'An ID is required.', type: 'err' }; return; }
    if (mode === 'create' && entries.some(e => e.id === id)) {
      status = { text: `An entry with ID "${id}" already exists.`, type: 'err' };
      return;
    }

    saving = true;
    status = { text: 'Saving…', type: '' };

    const sections = form.sections.map(sec => ({
      heading: sec.heading.trim(),
      paragraphs: sec.redacted
        ? ['PASSWORD']
        : sec.paragraphsText.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean),
      ...(sec.hooksText.trim()
        ? { hooks: sec.hooksText.split('\n').map(h => h.trim()).filter(Boolean) }
        : {}),
    }));

    const redactedSection = form.sections.find(s => s.redacted && s.redactedText.trim());

    const data = {
      id,
      fileNo: form.fileNo.trim(),
      stamp: form.stamp.trim(),
      name,
      epithet: form.epithet.trim(),
      order: Number(form.order) || 0,
      colors: {
        rule: form.accentColor,
        accent: form.accentColor,
        stripe: form.accentColor,
        stampColor: form.accentColor,
      },
      images: form.images.map(i => i.path),
      stats: form.stats.filter(s => s.label.trim() || s.value.trim()).map(s => ({ label: s.label.trim(), value: s.value.trim() })),
      sections,
      quote: form.quoteText.trim() ? { text: form.quoteText.trim(), cite: form.quoteCite.trim() } : null,
      ...(typeField ? { [typeField]: form.type } : {}),
      ...(supportsRedacted && redactedSection ? { redactedEncoded: encodeRedacted(redactedSection.redactedText.trim()) } : {}),
    };

    try {
      await setContentEntry(collection, id, data);
      status = { text: 'Saved.', type: 'ok' };
      mode = 'list';
    } catch (e) {
      status = { text: `Failed: ${e?.message ?? 'unknown error'}`, type: 'err' };
    }
    saving = false;
  }

  async function remove(entry) {
    if (!confirm(`Delete "${entry.name}" permanently? This can't be undone.`)) return;
    deletingId = entry.id;
    try {
      await deleteContentEntry(collection, entry.id);
    } catch (e) {
      status = { text: `Delete failed: ${e?.message ?? 'unknown error'}`, type: 'err' };
    }
    deletingId = null;
  }
</script>

{#if mode === 'list'}
  <div class="ce-header">
    <h2 class="ce-title">{label}</h2>
    <button class="ce-primary ce-primary--sm" on:click={startCreate}>+ New {label.replace(/s$/, '')}</button>
  </div>
  <input class="ce-input" placeholder="Search {label.toLowerCase()}…" bind:value={search} />

  <div class="ce-log">
    {#if !filteredEntries.length}
      <div class="ce-empty">No entries{search ? ' match your search' : ' yet'}.</div>
    {:else}
      {#each filteredEntries as entry (entry.id)}
        <div class="ce-row">
          <div class="ce-row-main">
            <span class="ce-row-name">{@html entry.name}</span>
            {#if typeField}<span class="ce-badge">{typeLabel(entry[typeField])}</span>{/if}
            <span class="ce-row-meta">{entry.fileNo}</span>
          </div>
          <div class="ce-row-actions">
            <button class="ce-ghost" on:click={() => startEdit(entry)}>Edit</button>
            <button class="ce-danger" disabled={deletingId === entry.id} on:click={() => remove(entry)}>
              {deletingId === entry.id ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </div>
      {/each}
    {/if}
  </div>
{:else}
  <div class="ce-header">
    <h2 class="ce-title">{mode === 'create' ? `New ${label.replace(/s$/, '')}` : `Edit — ${form.name || '…'}`}</h2>
    <button class="ce-ghost" on:click={cancelEdit}>&larr; Back to list</button>
  </div>

  <div class="ce-field-row">
    <label class="ce-field">
      <span class="ce-label">ID / slug</span>
      <input class="ce-input" placeholder="auto from name…" bind:value={form.id} disabled={mode === 'edit'} />
    </label>
    <label class="ce-field">
      <span class="ce-label">File No.</span>
      <input class="ce-input" placeholder="e.g. CE-014" bind:value={form.fileNo} />
    </label>
  </div>

  <label class="ce-field">
    <span class="ce-label">Stamp</span>
    <input class="ce-input" placeholder="e.g. PUBLIC RECORD — POLITICAL" bind:value={form.stamp} />
  </label>

  <label class="ce-field">
    <span class="ce-label">Name</span>
    <input class="ce-input" placeholder="Name…" bind:value={form.name} />
  </label>

  <label class="ce-field">
    <span class="ce-label">Epithet / tagline</span>
    <input class="ce-input" placeholder="One-line tagline…" bind:value={form.epithet} />
  </label>

  <div class="ce-field-row">
    {#if typeField}
      <label class="ce-field">
        <span class="ce-label">{typeField === 'district' ? 'District' : 'Category'}</span>
        <select class="ce-input" bind:value={form.type}>
          <option value="">—</option>
          {#each resolvedTypeOptions as opt (opt.key)}
            <option value={opt.key}>{opt.label}</option>
          {/each}
        </select>
      </label>
    {/if}
    <label class="ce-field ce-field--narrow">
      <span class="ce-label">Sort position</span>
      <input class="ce-input" type="number" bind:value={form.order} />
    </label>
    <label class="ce-field ce-field--narrow">
      <span class="ce-label">Accent color</span>
      <input class="ce-color" type="color" bind:value={form.accentColor} />
    </label>
  </div>

  <div class="ce-section">
    <div class="ce-section-label-row">
      <span class="ce-section-label">Images ({form.images.length})</span>
      <button class="ce-ghost" type="button" on:click={toggleImagePicker}>
        {imagePicker.open ? 'Close picker' : '+ Add image'}
      </button>
    </div>
    {#if form.images.length}
      <div class="ce-chips">
        {#each form.images as img (img.name)}
          <div class="ce-chip">
            <img src={img.url} alt="" />
            <span>{img.name}</span>
            <button type="button" on:click={() => removeImage(img.name)}>&times;</button>
          </div>
        {/each}
      </div>
    {/if}
    {#if imagePicker.open}
      <div class="ce-image-picker">
        {#if imagePicker.loading}
          <div class="ce-picker-status">Loading…</div>
        {:else if imagePicker.error}
          <div class="ce-picker-status ce-err">{imagePicker.error}</div>
        {:else}
          {#each imagePicker.images as img (img.name)}
            <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
            <div class="ce-img-thumb" on:click={() => addImage(img)}>
              <img src={img.download_url} alt={img.name} loading="lazy" />
            </div>
          {/each}
        {/if}
      </div>
    {/if}
  </div>

  <div class="ce-section">
    <div class="ce-section-label-row">
      <span class="ce-section-label">Stats</span>
      <button class="ce-ghost" type="button" on:click={addStat}>+ Add stat</button>
    </div>
    {#each form.stats as stat, i (i)}
      <div class="ce-stat-row">
        <input class="ce-input" placeholder="Label" bind:value={stat.label} />
        <input class="ce-input" placeholder="Value" bind:value={stat.value} />
        <button class="ce-danger ce-danger--icon" on:click={() => removeStat(i)}>&times;</button>
      </div>
    {/each}
  </div>

  <div class="ce-section">
    <div class="ce-section-label-row">
      <span class="ce-section-label">Sections</span>
      <button class="ce-ghost" type="button" on:click={addSection}>+ Add section</button>
    </div>
    {#each form.sections as section, i (i)}
      <div class="ce-section-block">
        <div class="ce-section-block-head">
          <input class="ce-input" placeholder="Heading (e.g. Overview)" bind:value={section.heading} />
          <button class="ce-danger ce-danger--icon" on:click={() => removeSection(i)}>&times;</button>
        </div>
        {#if !section.redacted}
          <textarea class="ce-textarea" placeholder="Paragraphs — blank line between paragraphs…" bind:value={section.paragraphsText}></textarea>
        {/if}
        <textarea class="ce-textarea ce-textarea--sm" placeholder="Hooks — one per line…" bind:value={section.hooksText}></textarea>
        {#if supportsRedacted}
          <label class="ce-checkbox-row">
            <input type="checkbox" checked={section.redacted} on:change={() => toggleSectionRedacted(i)} />
            <span>Password-gated content (replaces this section's paragraphs)</span>
          </label>
          {#if section.redacted}
            <textarea class="ce-textarea" placeholder="Redacted content, revealed after the password gate…" bind:value={section.redactedText}></textarea>
          {/if}
        {/if}
      </div>
    {/each}
  </div>

  <div class="ce-section">
    <span class="ce-section-label">Quote (optional)</span>
    <input class="ce-input" placeholder="Quote text…" bind:value={form.quoteText} />
    <input class="ce-input" placeholder="Citation…" bind:value={form.quoteCite} />
  </div>

  <button class="ce-primary" disabled={saving} on:click={save}>
    {saving ? 'Saving…' : mode === 'create' ? 'Create entry' : 'Save changes'}
  </button>
  <div class="ce-status" class:ok={status.type === 'ok'} class:err={status.type === 'err'}>{status.text}</div>
{/if}

<style>
  .ce-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; gap: 10px; }
  .ce-title { font-size: 15px; font-weight: 700; color: #e8dfc8; margin: 0; }

  .ce-input, select.ce-input {
    width: 100%; background: #0c0f16; border: 1px solid #1a2030; border-radius: 8px;
    color: #e8dfc8; font-family: inherit; font-size: 13.5px; padding: 10px 12px; outline: none;
    margin-bottom: 10px; box-sizing: border-box;
  }
  .ce-input:focus { border-color: #c9a227; }
  .ce-input:disabled { color: #6a7d90; }

  .ce-field { display: block; margin-bottom: 0; flex: 1; min-width: 0; }
  .ce-field--narrow { flex: 0 0 140px; }
  .ce-field-row { display: flex; gap: 10px; align-items: flex-end; }
  .ce-label { display: block; font-size: 10px; letter-spacing: 0.8px; text-transform: uppercase; color: #6a7d90; margin-bottom: 5px; }

  .ce-color { width: 100%; height: 40px; padding: 0; border: 1px solid #1a2030; border-radius: 6px; background: none; cursor: pointer; }

  .ce-section { margin: 20px 0; }
  .ce-section-label { font-size: 10.5px; font-weight: 600; letter-spacing: 1.5px; text-transform: uppercase; color: #6a7d90; }
  .ce-section-label-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }

  .ce-textarea {
    width: 100%; min-height: 80px; background: #0c0f16; border: 1px solid #1a2030; border-radius: 8px;
    color: #e8dfc8; font-family: inherit; font-size: 13px; padding: 10px 12px; resize: vertical; outline: none;
    margin-bottom: 8px; box-sizing: border-box;
  }
  .ce-textarea--sm { min-height: 50px; }
  .ce-textarea:focus { border-color: #c9a227; }

  .ce-stat-row { display: flex; gap: 8px; margin-bottom: 8px; align-items: center; }
  .ce-stat-row .ce-input { margin-bottom: 0; }

  .ce-section-block { background: #0a0d14; border: 1px solid #1a2030; border-radius: 8px; padding: 12px; margin-bottom: 10px; }
  .ce-section-block-head { display: flex; gap: 8px; margin-bottom: 8px; align-items: center; }
  .ce-section-block-head .ce-input { margin-bottom: 0; }

  .ce-checkbox-row { display: flex; align-items: center; gap: 8px; font-size: 12px; color: #6a7d90; margin: 6px 0; cursor: pointer; }

  .ce-chips { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 10px; }
  .ce-chip { display: flex; align-items: center; gap: 8px; background: #0c0f16; border: 1px solid #1a2030; border-radius: 8px; padding: 4px 8px 4px 4px; font-size: 11.5px; color: #6a7d90; }
  .ce-chip img { width: 28px; height: 28px; border-radius: 5px; object-fit: cover; }
  .ce-chip button { background: none; border: none; color: #6a7d90; font-size: 15px; cursor: pointer; line-height: 1; padding: 0 2px; }
  .ce-chip button:hover { color: #e24b4a; }

  .ce-image-picker { background: #0c0f16; border: 1px solid #1a2030; border-radius: 8px; padding: 10px; display: grid; grid-template-columns: repeat(auto-fill, minmax(72px, 1fr)); gap: 8px; max-height: 220px; overflow-y: auto; }
  .ce-img-thumb { cursor: pointer; border-radius: 6px; overflow: hidden; aspect-ratio: 1; border: 1px solid #1a2030; transition: border-color 0.15s ease; }
  .ce-img-thumb:hover { border-color: #c9a227; }
  .ce-img-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .ce-picker-status { grid-column: 1/-1; font-size: 12px; font-style: italic; color: #3a4a5a; text-align: center; padding: 10px 0; }
  .ce-picker-status.ce-err { color: #e24b4a; font-style: normal; }

  .ce-log { background: #0c0f16; border: 1px solid #1a2030; border-radius: 8px; padding: 6px 14px; max-height: 560px; overflow-y: auto; }
  .ce-empty { font-size: 12px; font-style: italic; color: #3a4a5a; text-align: center; padding: 20px 0; }
  .ce-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.05); }
  .ce-row:last-child { border-bottom: none; }
  .ce-row-main { display: flex; align-items: baseline; gap: 8px; min-width: 0; flex-wrap: wrap; }
  .ce-row-name { font-size: 13px; font-weight: 600; color: #e8dfc8; }
  .ce-row-meta { font-size: 10px; color: #3a4a5a; font-family: 'Courier New', monospace; }
  .ce-badge { display: inline-block; font-size: 9.5px; font-weight: 700; letter-spacing: 0.8px; text-transform: uppercase; color: #6a7d90; border: 1px solid #3a4a5a; border-radius: 4px; padding: 1px 6px; }
  .ce-row-actions { display: flex; gap: 6px; flex-shrink: 0; }

  .ce-primary {
    background: #c9a227; color: #15130f; border: none; border-radius: 8px;
    padding: 11px 18px; font-size: 13px; font-weight: 700; letter-spacing: 0.3px; cursor: pointer; width: 100%;
  }
  .ce-primary--sm { width: auto; padding: 7px 14px; font-size: 11.5px; }
  .ce-primary:disabled { background: #2a2a26; color: #5a5650; cursor: not-allowed; }

  .ce-ghost {
    background: none; border: 1px solid #3a4a5a; color: #6a7d90; border-radius: 6px;
    padding: 4px 10px; font-size: 10.5px; letter-spacing: 0.5px; text-transform: uppercase; cursor: pointer; white-space: nowrap;
  }
  .ce-ghost:hover { border-color: #6a7d90; color: #c9a227; }

  .ce-danger { background: none; border: 1px solid rgba(226,75,74,0.35); color: #e24b4a; border-radius: 6px; padding: 4px 10px; font-size: 10.5px; cursor: pointer; }
  .ce-danger:hover { background: rgba(226,75,74,0.08); }
  .ce-danger:disabled { opacity: 0.5; cursor: not-allowed; }
  .ce-danger--icon { padding: 4px 10px; flex-shrink: 0; }

  .ce-status { font-size: 11px; color: #6a7d90; margin-top: 8px; min-height: 14px; }
  .ce-status.ok { color: #639922; }
  .ce-status.err { color: #e24b4a; }
</style>
