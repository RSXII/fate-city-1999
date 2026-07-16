<script>
  import { base } from '$app/paths';
  import { onMount, onDestroy } from 'svelte';
  import { dbGet, dbPost, dbPut, dbDelete } from '$lib/firebase-db.js';
  import { visibilityAwareInterval } from '$lib/utils.js';
  import { CASE_SECTIONS } from '$lib/data/case-sections.js';
  import { CLASS_CONFIG, CLASS_DEFAULTS, VEHICLE_UPGRADES } from '$lib/data/rides.js';
  import { NPCS } from '$lib/data/persons.js';
  import { CHARACTERS, normActions, formatDelta } from '$lib/data/downtime.js';

  let activeTab = 'wire';

  const GITHUB_IMAGES_API =
    'https://api.github.com/repos/RSXII/fate-city-1999/contents/images/messages';
  const GITHUB_ROOT_IMAGES_API =
    'https://api.github.com/repos/RSXII/fate-city-1999/contents/images';
  const GITHUB_FATESTAGRAM_API =
    'https://api.github.com/repos/RSXII/fate-city-1999/contents/static/images/fatestagram';
  const GITHUB_RIDES_API =
    'https://api.github.com/repos/RSXII/fate-city-1999/contents/static/images/rides';
  const GITHUB_WIRE_PROFILES_API =
    'https://api.github.com/repos/RSXII/fate-city-1999/contents/static/images/wire-profiles';

  // ── Helpers ───────────────────────────────────────────────────────────────
  function relTime(ts) {
    const diff = Math.max(0, Date.now() - ts);
    const s = Math.floor(diff / 1000);
    if (s < 10) return 'now';
    if (s < 60) return `${s}s ago`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  }

  function normMessages(raw) {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    return Object.keys(raw)
      .sort((a, b) => parseInt(a) - parseInt(b))
      .map(k => raw[k]);
  }

  // ── Section 1: Wire Messages ──────────────────────────────────────────────
  let selectedSender = null;
  let msgText = '';
  let selectedImage = null; // { url, name }
  let pickerOpen = false;
  let pickerImages = [];
  let pickerLoading = false;
  let pickerError = '';
  let stagedMsgs = [];
  let liveMsgs = [];
  let sendStatus = { text: '', type: '' };
  let sending = false;
  let liveMsgLogEl;
  let liveThreadFilter = null; // null=all, 'broadcast'=no recipients, string=codename

  let devices = []; // codenames registered in Firebase
  let selectedRecipients = []; // empty = broadcast to all

  async function refreshDevices() {
    try {
      const data = await dbGet('devices');
      if (!data) { devices = []; return; }
      const seen = new Set();
      devices = Object.values(data)
        .filter(d => d.codename)
        .map(d => d.codename)
        .filter(c => { if (seen.has(c)) return false; seen.add(c); return true; })
        .sort();
    } catch { devices = []; }
  }

  function toggleRecipient(codename) {
    selectedRecipients = selectedRecipients.includes(codename)
      ? selectedRecipients.filter(c => c !== codename)
      : [...selectedRecipients, codename];
  }

  $: sendEnabled = !sending && !!selectedSender && (msgText.trim().length > 0 || !!selectedImage);

  async function loadMsgs() {
    try {
      const data = await dbGet('messages', { orderBy: '$key', limitToLast: 200 });
      if (!data) { stagedMsgs = []; liveMsgs = []; return; }
      const all = Object.keys(data).map(k => { const m = data[k]; m._id = k; return m; })
        .sort((a, b) => a.ts - b.ts);
      stagedMsgs = all.filter(m => m.staged === false);
      liveMsgs   = all.filter(m => m.staged !== false);
    } catch { stagedMsgs = []; liveMsgs = []; }
    setTimeout(() => { if (liveMsgLogEl) liveMsgLogEl.scrollTop = liveMsgLogEl.scrollHeight; }, 0);
  }

  $: liveFilterOptions = (() => {
    const codenames = new Set();
    let hasBroadcast = false;
    for (const m of liveMsgs) {
      if (!m.recipients?.length) hasBroadcast = true;
      else m.recipients.forEach(c => codenames.add(c));
    }
    return { hasBroadcast, codenames: [...codenames].sort() };
  })();

  $: filteredLiveMsgs = liveThreadFilter === null
    ? liveMsgs
    : liveThreadFilter === 'broadcast'
      ? liveMsgs.filter(m => !m.recipients?.length)
      : liveMsgs.filter(m => m.recipients?.includes(liveThreadFilter));

  async function sendMessage() {
    const text = msgText.trim();
    if (!selectedSender || (!text && !selectedImage)) return;
    sending = true;
    sendStatus = { text: 'Staging…', type: '' };
    try {
      const payload = { sender: selectedSender.name, color: selectedSender.color, text, ts: Date.now(), staged: false };
      if (selectedImage) payload.imageUrl = selectedImage.url;
      if (selectedRecipients.length > 0) payload.recipients = [...selectedRecipients];
      await dbPost('messages', payload);
      msgText = '';
      selectedImage = null;
      pickerOpen = false;
      sendStatus = { text: 'Staged. Deploy when players are ready.', type: 'ok' };
      await loadMsgs();
    } catch (e) {
      sendStatus = { text: `Stage failed: ${e?.message ?? 'unknown error'}`, type: 'err' };
    }
    sending = false;
  }

  let deployingMsgId = null;
  async function deployMessage(id) {
    deployingMsgId = id;
    try { await dbPut(`messages/${id}/staged`, true); await loadMsgs(); }
    catch (e) { console.error('Deploy failed', e); }
    deployingMsgId = null;
  }

  async function recallMessage(id) {
    if (!confirm('Recall this message? It will disappear from player devices.')) return;
    try { await dbPut(`messages/${id}/staged`, false); await loadMsgs(); }
    catch (e) { console.error('Recall failed', e); }
  }

  async function deleteMessage(id) {
    const m = [...stagedMsgs, ...liveMsgs].find(x => x._id === id);
    const isLive = m?.staged !== false;
    if (!confirm(isLive ? 'Delete this message from all player devices?' : 'Delete this staged message?')) return;
    try { await dbDelete(`messages/${id}`); await loadMsgs(); }
    catch (e) { console.error('Delete failed', e); }
  }

  async function togglePicker() {
    if (pickerOpen) { pickerOpen = false; return; }
    pickerOpen = true;
    pickerImages = [];
    pickerLoading = true;
    pickerError = '';
    try {
      const res = await fetch(GITHUB_IMAGES_API);
      if (res.status === 404) { pickerLoading = false; pickerError = 'No images found in images/messages/ yet.'; return; }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      pickerImages = data.filter(f => f.type === 'file' && /\.(png|jpe?g|gif|webp)$/i.test(f.name));
      if (!pickerImages.length) pickerError = 'No images found in images/messages/ yet.';
    } catch (e) {
      pickerError = `Failed to load: ${e?.message ?? 'error'}`;
    }
    pickerLoading = false;
  }

  function selectImage(img) {
    selectedImage = { url: img.download_url, name: img.name };
    pickerOpen = false;
  }

  // ── Section 2: Email / Data Packets ──────────────────────────────────────
  let emailSubject = '';
  let emailTags = '';
  let replies = []; // { id, from, body, imageUrl, size, bold, color }
  let replyCounter = 0;
  let emailType = 'email';           // 'email' | 'log' | 'document' | 'transmission'
  let emailSource = '';
  let emailClassification = 'decrypted';
  let emailStatus = { text: '', type: '' };
  let staging = false;
  let stagedChains = [];
  let liveChains = [];
  let stagedTagFilter = null;
  let liveTagFilter = null;

  $: filteredStagedChains = stagedTagFilter
    ? stagedChains.filter(c => (c.tags || []).includes(stagedTagFilter))
    : stagedChains;
  $: filteredLiveChains = liveTagFilter
    ? liveChains.filter(c => (c.tags || []).includes(liveTagFilter))
    : liveChains;
  $: allStagedTags = [...new Set(stagedChains.flatMap(c => c.tags || []))].sort();
  $: allLiveTags   = [...new Set(liveChains.flatMap(c => c.tags || []))].sort();

  // Per-reply picker state keyed by reply id
  let replyPickers = {}; // id → { open, loading, error, images }

  function addReply(from = '', body = '') {
    const id = ++replyCounter;
    replies = [...replies, { id, from, body, imageUrl: '', size: 'md', bold: false, color: '' }];
    replyPickers = { ...replyPickers, [id]: { open: false, loading: false, error: '', images: [] } };
  }

  function removeReply(id) {
    replies = replies.filter(r => r.id !== id);
    const p = { ...replyPickers };
    delete p[id];
    replyPickers = p;
  }

  async function toggleReplyPicker(id) {
    const cur = replyPickers[id];
    if (cur.open) {
      replyPickers = { ...replyPickers, [id]: { ...cur, open: false } };
      return;
    }
    replyPickers = { ...replyPickers, [id]: { ...cur, open: true, loading: true, error: '', images: [] } };
    try {
      const res = await fetch(GITHUB_IMAGES_API);
      if (res.status === 404) {
        replyPickers = { ...replyPickers, [id]: { ...replyPickers[id], loading: false, error: 'No images found.' } };
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const images = data.filter(f => f.type === 'file' && /\.(png|jpe?g|gif|webp)$/i.test(f.name));
      replyPickers = { ...replyPickers, [id]: { ...replyPickers[id], loading: false, images, error: images.length ? '' : 'No images found.' } };
    } catch (e) {
      replyPickers = { ...replyPickers, [id]: { ...replyPickers[id], loading: false, error: `Failed: ${e?.message ?? 'error'}` } };
    }
  }

  function selectReplyImage(replyId, img) {
    replies = replies.map(r => r.id === replyId ? { ...r, imageUrl: img.download_url } : r);
    replyPickers = { ...replyPickers, [replyId]: { ...replyPickers[replyId], open: false } };
  }

  function clearReplyImage(replyId) {
    replies = replies.map(r => r.id === replyId ? { ...r, imageUrl: '' } : r);
  }

  async function stageChain() {
    const subject = emailSubject.trim();
    if (!subject) { emailStatus = { text: 'A subject line is required.', type: 'err' }; return; }
    const now = Date.now();

    const allMsgs = replies.map((r, i) => {
      const m = { body: r.body.trim(), ts: now + i * 60000 };
      if (emailType === 'email') {
        m.from = r.from.trim() || 'Unknown';
      } else {
        if (r.from.trim()) m.label = r.from.trim();
        if (r.size && r.size !== 'md') m.size = r.size;
        if (r.bold) m.bold = true;
        if (r.color) m.color = r.color;
      }
      if (r.imageUrl) m.imageUrl = r.imageUrl;
      return m;
    }).filter(m => m.body || m.imageUrl);

    const msgs = emailType === 'transmission' ? allMsgs.slice(0, 1) : allMsgs;

    if (!msgs.length) { emailStatus = { text: 'Add at least one message to the chain.', type: 'err' }; return; }
    const tags = emailTags.split(',').map(t => t.trim()).filter(Boolean);
    staging = true;
    emailStatus = { text: 'Staging…', type: '' };
    try {
      await dbPost('emails', {
        subject,
        type: emailType,
        source: emailSource.trim() || null,
        classification: emailClassification,
        staged: false,
        createdAt: now,
        messages: msgs,
        tags,
      });
      emailSubject = '';
      emailTags = '';
      emailType = 'email';
      emailSource = '';
      emailClassification = 'decrypted';
      replies = [];
      replyPickers = {};
      replyCounter = 0;
      addReply(); addReply();
      emailStatus = { text: 'Staged. Use Deploy when the players are ready.', type: 'ok' };
      await refreshStaged();
    } catch (e) {
      emailStatus = { text: `Failed: ${e?.message ?? 'unknown error'}`, type: 'err' };
    }
    staging = false;
  }

  async function loadChains(stagedValue) {
    try {
      const data = await dbGet('emails');
      if (!data) return [];
      return Object.keys(data)
        .map(k => { const c = data[k]; c._id = k; return c; })
        .filter(c => c.staged === stagedValue)
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    } catch { return []; }
  }

  async function refreshStaged() { stagedChains = await loadChains(false); }
  async function refreshLive()   { liveChains   = await loadChains(true);  }

  let deployingId = null;
  async function deployChain(id) {
    deployingId = id;
    try { await dbPut(`emails/${id}/staged`, true); await refreshStaged(); await refreshLive(); }
    catch (e) { console.error('Deploy failed', e); }
    deployingId = null;
  }

  let recallingId = null;
  async function recallChain(id) {
    if (!confirm('Recall this chain? It will disappear from player devices.')) return;
    recallingId = id;
    try { await dbPut(`emails/${id}/staged`, false); await refreshStaged(); await refreshLive(); }
    catch (e) { console.error('Recall failed', e); }
    recallingId = null;
  }

  async function deleteChain(id, isLive) {
    const msg = isLive
      ? 'Permanently delete this live chain from all devices?'
      : 'Delete this staged chain? This cannot be undone.';
    if (!confirm(msg)) return;
    try {
      await dbDelete(`emails/${id}`);
      if (isLive) await refreshLive(); else await refreshStaged();
    } catch (e) { console.error('Delete failed', e); }
  }

  // ── Section 2b: Case Files (persons / locations / intel builder) ──────────
  let caseSection = CASE_SECTIONS[0]?.key ?? 'persons';
  let caseFileNo = '';
  let caseName = '';
  let caseSpecies = '';
  let caseRep = '';
  let caseOverview = '';
  let caseNotes = '';
  let caseAccentColor = '#b8902f';
  let caseImages = []; // { name, path, url }
  let caseImagePicker = { open: false, loading: false, error: '', images: [] };
  let caseStatus = { text: '', type: '' };
  let stagingCase = false;
  let stagedCases = [];
  let liveCases = [];

  function caseSectionLabel(key) {
    return CASE_SECTIONS.find(s => s.key === key)?.label ?? key;
  }

  async function toggleCaseImagePicker() {
    if (caseImagePicker.open) { caseImagePicker = { ...caseImagePicker, open: false }; return; }
    caseImagePicker = { open: true, loading: true, error: '', images: [] };
    try {
      const res = await fetch(GITHUB_ROOT_IMAGES_API);
      if (res.status === 404) {
        caseImagePicker = { ...caseImagePicker, loading: false, error: 'No images found in images/ yet.' };
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const images = data.filter(f => f.type === 'file' && /\.(png|jpe?g|gif|webp)$/i.test(f.name));
      caseImagePicker = { ...caseImagePicker, loading: false, images, error: images.length ? '' : 'No images found.' };
    } catch (e) {
      caseImagePicker = { ...caseImagePicker, loading: false, error: `Failed: ${e?.message ?? 'error'}` };
    }
  }

  function addCaseImage(img) {
    if (caseImages.some(i => i.name === img.name)) return;
    caseImages = [...caseImages, { name: img.name, path: img.path, url: img.download_url }];
  }

  function removeCaseImage(name) {
    caseImages = caseImages.filter(i => i.name !== name);
  }

  async function stageCase() {
    const name = caseName.trim();
    if (!name) { caseStatus = { text: 'A name is required.', type: 'err' }; return; }
    stagingCase = true;
    caseStatus = { text: 'Staging…', type: '' };
    try {
      await dbPost('briefings', {
        section: caseSection,
        staged: false,
        createdAt: Date.now(),
        fileNo: caseFileNo.trim(),
        name,
        species: caseSpecies.trim(),
        rep: caseRep.trim(),
        overview: caseOverview.trim(),
        notes: caseNotes.trim(),
        accentColor: caseAccentColor,
        images: caseImages.map(i => i.path),
      });
      caseFileNo = '';
      caseName = '';
      caseSpecies = '';
      caseRep = '';
      caseOverview = '';
      caseNotes = '';
      caseImages = [];
      caseImagePicker = { open: false, loading: false, error: '', images: [] };
      caseStatus = { text: 'Staged. Use Deploy when the players are ready.', type: 'ok' };
      await refreshCaseStaged();
    } catch (e) {
      caseStatus = { text: `Failed: ${e?.message ?? 'unknown error'}`, type: 'err' };
    }
    stagingCase = false;
  }

  async function loadCases(stagedValue) {
    try {
      const data = await dbGet('briefings');
      if (!data) return [];
      return Object.keys(data)
        .map(k => { const c = data[k]; c._id = k; return c; })
        .filter(c => c.staged === stagedValue)
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    } catch { return []; }
  }

  async function refreshCaseStaged() { stagedCases = await loadCases(false); }
  async function refreshCaseLive()   { liveCases   = await loadCases(true);  }

  let deployingCaseId = null;
  async function deployCase(id) {
    deployingCaseId = id;
    try { await dbPut(`briefings/${id}/staged`, true); await refreshCaseStaged(); await refreshCaseLive(); }
    catch (e) { console.error('Deploy failed', e); }
    deployingCaseId = null;
  }

  let recallingCaseId = null;
  async function recallCase(id) {
    if (!confirm('Recall this case file? It will disappear from player devices.')) return;
    recallingCaseId = id;
    try { await dbPut(`briefings/${id}/staged`, false); await refreshCaseStaged(); await refreshCaseLive(); }
    catch (e) { console.error('Recall failed', e); }
    recallingCaseId = null;
  }

  async function deleteCase(id, isLive) {
    const msg = isLive
      ? 'Permanently delete this live case file from all devices?'
      : 'Delete this staged case file? This cannot be undone.';
    if (!confirm(msg)) return;
    try {
      await dbDelete(`briefings/${id}`);
      if (isLive) await refreshCaseLive(); else await refreshCaseStaged();
    } catch (e) { console.error('Delete failed', e); }
  }

  // ── Section 3: Contacts (unified wire senders + phone contacts) ──────────
  let contactList = [];
  let newCName = '';
  let newCNumber = '';
  let newCSubtitle = '';
  let newCColor = '#c9a227';
  let newCAvatar = '';
  let contactStatus = { text: '', type: '' };
  let addingContact = false;

  let contactAvatarPickerOpen = false;
  let contactAvatarPickerLoading = false;
  let contactAvatarPickerError = '';
  let contactAvatarPickerImages = [];

  let editingId = null;
  let editCName = '', editCNumber = '', editCSubtitle = '';
  let editCColor = '#c9a227', editCAvatar = '';
  let savingContact = false;
  let editAvatarPickerOpen = false, editAvatarPickerLoading = false;
  let editAvatarPickerError = '', editAvatarPickerImages = [];

  async function refreshContacts() {
    try {
      const data = await dbGet('contacts');
      if (!data) { contactList = []; return; }
      contactList = Object.keys(data)
        .map(k => { const c = data[k]; c._id = k; return c; })
        .sort((a, b) => a.name.localeCompare(b.name));
    } catch { contactList = []; }
  }

  async function addContact() {
    const name = newCName.trim();
    if (!name) { contactStatus = { text: 'Name is required.', type: 'err' }; return; }
    addingContact = true;
    contactStatus = { text: 'Adding…', type: '' };
    try {
      await dbPost('contacts', {
        name,
        number: newCNumber.trim() || null,
        subtitle: newCSubtitle.trim() || null,
        color: newCColor,
        avatar: newCAvatar || null,
        enabled: true,
        createdAt: Date.now(),
      });
      newCName = ''; newCNumber = ''; newCSubtitle = '';
      newCColor = '#c9a227'; newCAvatar = '';
      contactAvatarPickerOpen = false;
      contactStatus = { text: 'Contact added.', type: 'ok' };
      await refreshContacts();
    } catch (e) {
      contactStatus = { text: `Failed: ${e?.message ?? 'unknown error'}`, type: 'err' };
    }
    addingContact = false;
  }

  async function toggleContact(id, currentEnabled) {
    try {
      await dbPut(`contacts/${id}/enabled`, !currentEnabled);
      await refreshContacts();
    } catch (e) { console.error('Toggle failed', e); }
  }

  async function deleteContact(id) {
    if (!confirm('Remove this contact?')) return;
    try {
      await dbDelete(`contacts/${id}`);
      await refreshContacts();
    } catch (e) { console.error('Delete failed', e); }
  }

  async function toggleContactAvatarPicker() {
    if (contactAvatarPickerOpen) { contactAvatarPickerOpen = false; return; }
    contactAvatarPickerOpen = true;
    contactAvatarPickerLoading = true;
    contactAvatarPickerError = '';
    contactAvatarPickerImages = [];
    try {
      const res = await fetch(GITHUB_WIRE_PROFILES_API);
      if (res.status === 404) {
        contactAvatarPickerLoading = false;
        contactAvatarPickerError = 'No images in static/images/wire-profiles/ yet.';
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      contactAvatarPickerImages = data.filter(f => f.type === 'file' && /\.(png|jpe?g|gif|webp)$/i.test(f.name));
      contactAvatarPickerError = contactAvatarPickerImages.length ? '' : 'No images found yet.';
    } catch (e) {
      contactAvatarPickerError = `Failed: ${e?.message ?? 'error'}`;
    }
    contactAvatarPickerLoading = false;
  }

  function selectContactAvatar(img) {
    newCAvatar = `images/wire-profiles/${img.name}`;
    contactAvatarPickerOpen = false;
  }

  function startEdit(c) {
    editingId = c._id;
    editCName = c.name;
    editCNumber = c.number || '';
    editCSubtitle = c.subtitle || '';
    editCColor = c.color || '#c9a227';
    editCAvatar = c.avatar || '';
    editAvatarPickerOpen = false;
  }

  function cancelEdit() { editingId = null; }

  async function saveContact() {
    if (!editCName.trim()) return;
    savingContact = true;
    try {
      await dbPut(`contacts/${editingId}`, {
        name: editCName.trim(),
        number: editCNumber.trim() || null,
        subtitle: editCSubtitle.trim() || null,
        color: editCColor,
        avatar: editCAvatar || null,
      });
      await refreshContacts();
      editingId = null;
    } catch (e) {
      contactStatus = { text: `Save failed: ${e?.message ?? 'error'}`, type: 'err' };
    }
    savingContact = false;
  }

  async function toggleEditAvatarPicker() {
    if (editAvatarPickerOpen) { editAvatarPickerOpen = false; return; }
    editAvatarPickerOpen = true;
    editAvatarPickerLoading = true;
    editAvatarPickerError = '';
    editAvatarPickerImages = [];
    try {
      const res = await fetch(GITHUB_WIRE_PROFILES_API);
      if (res.status === 404) {
        editAvatarPickerLoading = false;
        editAvatarPickerError = 'No images in static/images/wire-profiles/ yet.';
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      editAvatarPickerImages = data.filter(f => f.type === 'file' && /\.(png|jpe?g|gif|webp)$/i.test(f.name));
      editAvatarPickerError = editAvatarPickerImages.length ? '' : 'No images found yet.';
    } catch (e) {
      editAvatarPickerError = `Failed: ${e?.message ?? 'error'}`;
    }
    editAvatarPickerLoading = false;
  }

  function selectEditAvatar(img) {
    editCAvatar = `images/wire-profiles/${img.name}`;
    editAvatarPickerOpen = false;
  }

  // ── Section 4: Current Date ────────────────────────────────────────────────
  const CAL_MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  let calYear  = 1999;
  let calMonth = 2;
  let calDay   = 2;
  let currentCalDate = null;
  let dateStatus = { text: '', type: '' };
  let settingDate = false;

  async function loadCurrentCalDate() {
    try {
      const data = await dbGet('calendar/currentDate');
      currentCalDate = (data && data.year && data.month && data.day) ? data : null;
    } catch { /* ignore */ }
  }

  async function setCalDate() {
    if (!calYear || !calMonth || !calDay) {
      dateStatus = { text: 'All fields required.', type: 'err' };
      return;
    }
    settingDate = true;
    dateStatus = { text: 'Setting…', type: '' };
    try {
      await dbPut('calendar/currentDate', { year: Number(calYear), month: Number(calMonth), day: Number(calDay) });
      await loadCurrentCalDate();
      dateStatus = { text: 'Date set.', type: 'ok' };
    } catch (e) {
      dateStatus = { text: `Failed: ${e?.message ?? 'unknown error'}`, type: 'err' };
    }
    settingDate = false;
  }

  // ── Section 5: O.N.C.E. Transmissions ──────────────────────────────────────
  let onceText = '';
  let onceSending = false;
  let onceStatus = { text: '', type: '' };
  let stagedOnce = [];
  let liveOnce = [];

  async function loadOnce(stagedValue) {
    try {
      const data = await dbGet('once-messages');
      if (!data) return [];
      return Object.keys(data)
        .map(k => { const m = data[k]; m._id = k; return m; })
        .filter(m => m.staged === stagedValue)
        .sort((a, b) => b.ts - a.ts);
    } catch { return []; }
  }

  async function refreshStagedOnce() { stagedOnce = await loadOnce(false); }
  async function refreshLiveOnce()   { liveOnce   = await loadOnce(true);  }

  async function refreshOnceLog() { await refreshStagedOnce(); await refreshLiveOnce(); }

  async function stageOnceMessage() {
    const text = onceText.trim();
    if (!text) return;
    onceSending = true;
    onceStatus = { text: 'Staging…', type: '' };
    try {
      await dbPost('once-messages', { text, ts: Date.now(), staged: false });
      onceText = '';
      onceStatus = { text: 'Staged. Use Deploy when players are ready.', type: 'ok' };
      await refreshStagedOnce();
    } catch (e) {
      onceStatus = { text: `Failed: ${e?.message ?? 'unknown error'}`, type: 'err' };
    }
    onceSending = false;
  }

  let deployingOnceId = null;
  async function deployOnce(id) {
    deployingOnceId = id;
    try {
      await dbPut(`once-messages/${id}/staged`, true);
      await dbPut('once-settings/onceMessageSeen', false);
      await refreshStagedOnce(); await refreshLiveOnce();
    }
    catch (e) { console.error('Deploy failed', e); }
    deployingOnceId = null;
  }

  let recallingOnceId = null;
  async function recallOnce(id) {
    if (!confirm('Recall this transmission? It will disappear from player devices.')) return;
    recallingOnceId = id;
    try { await dbPut(`once-messages/${id}/staged`, false); await refreshStagedOnce(); await refreshLiveOnce(); }
    catch (e) { console.error('Recall failed', e); }
    recallingOnceId = null;
  }

  async function deleteOnceMessage(id, isLive) {
    const msg = isLive
      ? 'Permanently delete this live transmission from all devices?'
      : 'Delete this staged transmission? This cannot be undone.';
    if (!confirm(msg)) return;
    try {
      await dbDelete(`once-messages/${id}`);
      if (isLive) await refreshLiveOnce(); else await refreshStagedOnce();
    } catch (e) { console.error('Delete failed', e); }
  }

  // ── Section 6: Jobs ──────────────────────────────────────────────────────────
  const JOB_STATUS = {
    active:      { label: 'Active',      color: '#22c55e' },
    danger:      { label: 'In Danger',   color: '#f59e0b' },
    compromised: { label: 'Compromised', color: '#e05a3a' },
  };

  let jobTitle = '';
  let jobBrief = '';
  let jobNewStatus = 'active';
  let stagedJobs = [];
  let liveJobs = [];
  let stepTexts = {};
  let stepDates = {};
  let jobCreateStatus = { text: '', type: '' };
  let creatingJob = false;

  function nextJobFileNo() {
    const nums = [...stagedJobs, ...liveJobs]
      .map(j => parseInt((j.fileNo ?? '').replace('JB-', '')))
      .filter(n => !isNaN(n));
    const next = nums.length ? Math.max(...nums) + 1 : 1;
    return `JB-${String(next).padStart(3, '0')}`;
  }

  function syncJobInputs() {
    const inputs = {};
    const dates = {};
    for (const j of [...stagedJobs, ...liveJobs]) {
      inputs[j._id] = stepTexts[j._id] ?? '';
      dates[j._id]  = stepDates[j._id] ?? '';
    }
    stepTexts = inputs;
    stepDates = dates;
  }

  async function loadJobsData(staged) {
    try {
      const data = await dbGet('jobs');
      if (!data) return [];
      const all = Object.keys(data)
        .map(k => { const j = data[k]; j._id = k; return j; })
        .filter(j => j.title);
      // Back-fill: jobs created before staging was added default to live
      for (const j of all) {
        if (j.staged == null) {
          j.staged = true;
          dbPut(`jobs/${j._id}/staged`, true);
        }
      }
      return all
        .filter(j => j.staged === staged)
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    } catch { return []; }
  }

  async function refreshStagedJobs() { stagedJobs = await loadJobsData(false); syncJobInputs(); }
  async function refreshLiveJobs()   { liveJobs   = await loadJobsData(true);  syncJobInputs(); }
  async function loadJobs() { await refreshStagedJobs(); await refreshLiveJobs(); }

  async function createJob() {
    const title = jobTitle.trim();
    if (!title) { jobCreateStatus = { text: 'A title is required.', type: 'err' }; return; }
    creatingJob = true;
    jobCreateStatus = { text: 'Staging…', type: '' };
    try {
      const fileNo = nextJobFileNo();
      await dbPost('jobs', { title, brief: jobBrief.trim(), status: jobNewStatus, fileNo, steps: [], staged: false, createdAt: Date.now() });
      jobTitle = '';
      jobBrief = '';
      jobNewStatus = 'active';
      jobCreateStatus = { text: `Staged (${fileNo}). Deploy when players are ready.`, type: 'ok' };
      await refreshStagedJobs();
    } catch (e) {
      jobCreateStatus = { text: `Failed: ${e?.message ?? 'unknown error'}`, type: 'err' };
    }
    creatingJob = false;
  }

  let deployingJobId = null;
  async function deployJob(id) {
    deployingJobId = id;
    try { await dbPut(`jobs/${id}/staged`, true); await refreshStagedJobs(); await refreshLiveJobs(); }
    catch (e) { console.error('Deploy failed', e); }
    deployingJobId = null;
  }

  let recallingJobId = null;
  async function recallJob(id) {
    if (!confirm('Recall this job? It will disappear from player devices.')) return;
    recallingJobId = id;
    try { await dbPut(`jobs/${id}/staged`, false); await refreshStagedJobs(); await refreshLiveJobs(); }
    catch (e) { console.error('Recall failed', e); }
    recallingJobId = null;
  }

  async function addJobStep(id) {
    const text = (stepTexts[id] ?? '').trim();
    if (!text) return;
    const date = (stepDates[id] ?? '').trim();
    const job = [...stagedJobs, ...liveJobs].find(j => j._id === id);
    const existing = Array.isArray(job?.steps) ? job.steps : [];
    const step = { text, ts: Date.now() };
    if (date) step.date = date;
    try {
      await dbPut(`jobs/${id}/steps`, [...existing, step]);
      stepTexts = { ...stepTexts, [id]: '' };
      stepDates = { ...stepDates, [id]: '' };
      if (stagedJobs.some(j => j._id === id)) await refreshStagedJobs();
      else await refreshLiveJobs();
    } catch (e) { console.error('Step add failed', e); }
  }

  async function setJobStatus(id, status) {
    try {
      await dbPut(`jobs/${id}/status`, status);
      await refreshLiveJobs();
    } catch (e) { console.error('Status update failed', e); }
  }

  async function deleteJob(id, isLive) {
    const msg = isLive
      ? 'Delete this job? It will disappear from player devices.'
      : 'Delete this staged job? This cannot be undone.';
    if (!confirm(msg)) return;
    try {
      await dbDelete(`jobs/${id}`);
      if (isLive) await refreshLiveJobs(); else await refreshStagedJobs();
    } catch (e) { console.error('Delete failed', e); }
  }

  // ── Section 6: Rides ─────────────────────────────────────────────────────
  let rideMake = '';
  let rideModel = '';
  let rideYear = 1999;
  let rideClass = 'sedan';
  let rideImage = '';
  let rideSdp = '';
  let rideSeats = '';
  let rideSpeedCombat = '';
  let rideSpeedNarrative = '';
  let rideCost = '';
  let rideUpgrades = new Set();
  let rideCreateStatus = { text: '', type: '' };
  let creatingRide = false;

  function toggleUpgrade(key) {
    const s = new Set(rideUpgrades);
    s.has(key) ? s.delete(key) : s.add(key);
    rideUpgrades = s;
  }

  let ridesPickerOpen = false;
  let ridesPickerLoading = false;
  let ridesPickerError = '';
  let ridesPickerImages = [];

  function applyClassDefaults(cls) {
    const d = CLASS_DEFAULTS[cls];
    if (!d) return;
    rideSdp          = String(d.sdp);
    rideSpeedCombat  = String(d.speedCombat);
  }

  async function toggleRidesPicker() {
    if (ridesPickerOpen) { ridesPickerOpen = false; return; }
    ridesPickerOpen = true;
    ridesPickerLoading = true;
    ridesPickerError = '';
    ridesPickerImages = [];
    try {
      const res = await fetch(GITHUB_RIDES_API);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      ridesPickerImages = data.filter(f => f.type === 'file' && /\.(png|jpe?g|gif|webp)$/i.test(f.name));
      ridesPickerError = ridesPickerImages.length ? '' : 'No images found in static/images/rides/.';
    } catch (e) {
      ridesPickerError = `Failed: ${e?.message ?? 'error'}`;
    }
    ridesPickerLoading = false;
  }

  function selectRidesImage(img) {
    rideImage = img.name;
    ridesPickerOpen = false;
  }

  let stagedRides = [];
  let liveRides = [];

  async function loadRidesData(staged) {
    try {
      const data = await dbGet('rides');
      if (!data) return [];
      return Object.keys(data)
        .map(k => { const r = data[k]; r._id = k; return r; })
        .filter(r => r.make && r.staged === staged)
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    } catch { return []; }
  }

  async function refreshStagedRides() { stagedRides = await loadRidesData(false); }
  async function refreshLiveRides()   { liveRides   = await loadRidesData(true);  }

  async function createRide() {
    if (!rideMake.trim() || !rideModel.trim()) {
      rideCreateStatus = { text: 'Make and Model are required.', type: 'err' }; return;
    }
    creatingRide = true;
    rideCreateStatus = { text: 'Staging…', type: '' };
    try {
      await dbPost('rides', {
        make: rideMake.trim(),
        model: rideModel.trim(),
        year: parseInt(rideYear) || null,
        class: rideClass,
        image: rideImage.trim() || null,
        stats: {
          sdp: parseInt(rideSdp) || 0,
          seats: parseInt(rideSeats) || 0,
          speedCombat: parseInt(rideSpeedCombat) || 0,
          speedNarrative: rideSpeedNarrative.trim() || null,
          cost: rideCost.trim() || null,
        },
        upgrades: [...rideUpgrades],
        staged: false,
        createdAt: Date.now(),
      });
      rideMake = ''; rideModel = ''; rideImage = '';
      rideSdp = ''; rideSeats = ''; rideSpeedCombat = ''; rideSpeedNarrative = ''; rideCost = '';
      rideYear = 1999; rideClass = 'sedan'; rideUpgrades = new Set();
      rideCreateStatus = { text: 'Vehicle staged. Deploy when ready.', type: 'ok' };
      await refreshStagedRides();
    } catch (e) {
      rideCreateStatus = { text: `Failed: ${e?.message ?? 'unknown error'}`, type: 'err' };
    }
    creatingRide = false;
  }

  let deployingRideId = null;
  async function deployRide(id) {
    deployingRideId = id;
    try { await dbPut(`rides/${id}/staged`, true); await refreshStagedRides(); await refreshLiveRides(); }
    catch (e) { console.error('Deploy failed', e); }
    deployingRideId = null;
  }

  let recallingRideId = null;
  async function recallRide(id) {
    if (!confirm('Remove this vehicle from player devices?')) return;
    recallingRideId = id;
    try { await dbPut(`rides/${id}/staged`, false); await refreshStagedRides(); await refreshLiveRides(); }
    catch (e) { console.error('Recall failed', e); }
    recallingRideId = null;
  }

  async function deleteRide(id, isLive) {
    const msg = isLive ? 'Remove from all devices and delete permanently?' : 'Delete this staged vehicle?';
    if (!confirm(msg)) return;
    try {
      await dbDelete(`rides/${id}`);
      if (isLive) await refreshLiveRides(); else await refreshStagedRides();
    } catch (e) { console.error('Delete failed', e); }
  }

  // ── Section 7: FateStaGram ────────────────────────────────────────────────
  let fsgUsername = '';
  let fsgHandle = '';
  let fsgCaption = '';
  let fsgTags = '';
  let fsgLocation = '';
  let fsgLikes = '';
  let fsgImageUrl = '';
  let fsgAvatarUrl = '';
  let fsgTopCommentUser = '';
  let fsgTopCommentText = '';
  let fsgTopCommentLikes = '';
  let fsgPosting = false;
  let fsgStatus = { text: '', type: '' };
  let stagedFsgPosts = [];
  let liveFsgPosts = [];
  let deployingFsgId = null;
  let recallingFsgId = null;
  let fsgKnownAuthors = []; // { username, handle } — persisted to localStorage

  const FSG_AUTHORS_KEY = 'fsg-known-authors';

  function loadFsgAuthors() {
    try { fsgKnownAuthors = JSON.parse(localStorage.getItem(FSG_AUTHORS_KEY) ?? '[]'); }
    catch { fsgKnownAuthors = []; }
  }

  function saveFsgAuthor(username, handle) {
    const existing = fsgKnownAuthors.filter(a => a.username !== username);
    fsgKnownAuthors = [{ username, handle: handle || '' }, ...existing];
    localStorage.setItem(FSG_AUTHORS_KEY, JSON.stringify(fsgKnownAuthors));
  }

  function quickFillAuthor(author) {
    fsgUsername = author.username;
    fsgHandle = author.handle;
  }

  let fsgPickerOpen = false;
  let fsgPickerLoading = false;
  let fsgPickerError = '';
  let fsgPickerImages = [];
  let fsgPickerSelected = null; // { url, name }

  let fsgAvatarPickerOpen = false;
  let fsgAvatarPickerLoading = false;
  let fsgAvatarPickerError = '';
  let fsgAvatarPickerImages = [];

  async function toggleFsgPicker() {
    if (fsgPickerOpen) { fsgPickerOpen = false; return; }
    fsgPickerOpen = true;
    fsgPickerLoading = true;
    fsgPickerError = '';
    fsgPickerImages = [];
    try {
      const res = await fetch(GITHUB_FATESTAGRAM_API);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      fsgPickerImages = data.filter(f => f.type === 'file' && /\.(png|jpe?g|gif|webp)$/i.test(f.name));
      if (!fsgPickerImages.length) fsgPickerError = 'No images found in static/images/ yet.';
    } catch (e) {
      fsgPickerError = `Failed: ${e?.message ?? 'error'}`;
    }
    fsgPickerLoading = false;
  }

  function selectFsgImage(img) {
    fsgPickerSelected = { url: img.download_url, name: img.name };
    fsgImageUrl = img.download_url;
    fsgPickerOpen = false;
  }

  async function toggleFsgAvatarPicker() {
    if (fsgAvatarPickerOpen) { fsgAvatarPickerOpen = false; return; }
    fsgAvatarPickerOpen = true;
    fsgAvatarPickerLoading = true;
    fsgAvatarPickerError = '';
    fsgAvatarPickerImages = [];
    try {
      const res = await fetch(GITHUB_WIRE_PROFILES_API);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      fsgAvatarPickerImages = data.filter(f => f.type === 'file' && /\.(png|jpe?g|gif|webp)$/i.test(f.name));
      if (!fsgAvatarPickerImages.length) fsgAvatarPickerError = 'No images in static/images/wire-profiles/ yet.';
    } catch (e) {
      fsgAvatarPickerError = `Failed: ${e?.message ?? 'error'}`;
    }
    fsgAvatarPickerLoading = false;
  }

  function selectFsgAvatar(img) {
    fsgAvatarUrl = img.download_url;
    fsgAvatarPickerOpen = false;
  }

  async function postToFatestagram() {
    const username = fsgUsername.trim();
    const handle = fsgHandle.trim();
    if (!username) { fsgStatus = { text: 'Username is required.', type: 'err' }; return; }
    if (!handle) { fsgStatus = { text: 'Handle is required.', type: 'err' }; return; }
    if (!fsgImageUrl.trim()) { fsgStatus = { text: 'An image is required.', type: 'err' }; return; }
    fsgPosting = true;
    fsgStatus = { text: 'Posting…', type: '' };
    try {
      const topCommentUser = fsgTopCommentUser.trim();
      const topCommentText = fsgTopCommentText.trim();
      await dbPost('fatestagram', {
        username,
        handle,
        caption: fsgCaption.trim() || null,
        tags: fsgTags.trim() || null,
        location: fsgLocation.trim() || null,
        likes: parseInt(fsgLikes) || 0,
        imageUrl: fsgImageUrl.trim(),
        avatarUrl: fsgAvatarUrl.trim() || null,
        topComment: (topCommentUser && topCommentText)
          ? { username: topCommentUser, text: topCommentText, likes: parseInt(fsgTopCommentLikes) || 0 }
          : null,
        ts: Date.now(),
        staged: false,
      });
      fsgUsername = '';
      fsgHandle = '';
      fsgCaption = '';
      fsgTags = '';
      fsgLocation = '';
      fsgLikes = '';
      fsgImageUrl = '';
      fsgAvatarUrl = '';
      fsgTopCommentUser = '';
      fsgTopCommentText = '';
      fsgTopCommentLikes = '';
      fsgPickerSelected = null;
      fsgPickerOpen = false;
      fsgAvatarPickerOpen = false;
      saveFsgAuthor(username, handle);
      fsgStatus = { text: 'Staged. Use Deploy when players are ready.', type: 'ok' };
      await loadFsgPosts();
    } catch (e) {
      fsgStatus = { text: `Failed: ${e?.message ?? 'unknown error'}`, type: 'err' };
    }
    fsgPosting = false;
  }

  async function loadFsgPosts() {
    try {
      const data = await dbGet('fatestagram', { orderBy: '$key', limitToLast: 50 });
      if (!data) { stagedFsgPosts = []; liveFsgPosts = []; return; }
      const all = Object.keys(data)
        .map(k => { const p = data[k]; p._id = k; return p; })
        .filter(p => p.imageUrl || p.caption)
        .sort((a, b) => b.ts - a.ts);
      stagedFsgPosts = all.filter(p => p.staged === false);
      liveFsgPosts   = all.filter(p => p.staged !== false);
    } catch { stagedFsgPosts = []; liveFsgPosts = []; }
  }

  async function deployFsgPost(id) {
    deployingFsgId = id;
    try { await dbPut(`fatestagram/${id}/staged`, true); await loadFsgPosts(); }
    catch (e) { console.error('Deploy failed', e); }
    deployingFsgId = null;
  }

  async function recallFsgPost(id) {
    if (!confirm('Pull this post back to staged? Players will no longer see it.')) return;
    recallingFsgId = id;
    try { await dbPut(`fatestagram/${id}/staged`, false); await loadFsgPosts(); }
    catch (e) { console.error('Recall failed', e); }
    recallingFsgId = null;
  }

  async function deleteFsgPost(id) {
    const p = [...stagedFsgPosts, ...liveFsgPosts].find(x => x._id === id);
    const isLive = p?.staged !== false;
    if (!confirm(isLive ? 'Delete this post from all player devices?' : 'Delete this staged post?')) return;
    try {
      await dbDelete(`fatestagram/${id}`);
      await loadFsgPosts();
    } catch (e) { console.error('Delete failed', e); }
  }

  // ── Timer ─────────────────────────────────────────────────────────────────
  let timerDuration = 0;          // seconds chosen via quick-add buttons
  let timerActiveEndsAt = null;   // ms timestamp from Firebase, null if none
  let timerSendStatus = null;     // { text, type }
  let timerSending = false;
  let timerConsolePoll;
  let timerDisplayTick;
  let timerDisplayStr = '';
  let splitStartedAt = null;
  let splitElapsedStr = '';
  let splitInterval = null;

  $: timerSelectedDisplay = (() => {
    if (!timerDuration) return '—';
    const m = Math.floor(timerDuration / 60);
    const s = timerDuration % 60;
    return s ? `${m}m ${s}s` : `${m}m`;
  })();

  function updateTimerDisplayStr() {
    if (!timerActiveEndsAt) { timerDisplayStr = ''; return; }
    const rem = timerActiveEndsAt - Date.now();
    if (rem <= 0) { timerDisplayStr = 'EXPIRED'; return; }
    const totalSec = Math.floor(rem / 1000);
    const m = String(Math.floor(totalSec / 60)).padStart(2, '0');
    const s = String(totalSec % 60).padStart(2, '0');
    timerDisplayStr = `${m}:${s}`;
  }

  async function loadTimerState() {
    try {
      const val = await dbGet('timer/endsAt');
      timerActiveEndsAt = (typeof val === 'number') ? val : null;
      updateTimerDisplayStr();
    } catch {}
  }

  async function sendCountdown() {
    if (!timerDuration) return;
    timerSending = true;
    timerSendStatus = null;
    try {
      const endsAt = Date.now() + timerDuration * 1000;
      await dbPut('timer/endsAt', endsAt);
      timerActiveEndsAt = endsAt;
      updateTimerDisplayStr();
      timerSendStatus = { text: 'Countdown started.', type: 'ok' };
    } catch (e) {
      timerSendStatus = { text: `Failed: ${e?.message ?? 'unknown'}`, type: 'err' };
    }
    timerSending = false;
  }

  function toggleSplit() {
    if (!splitStartedAt) {
      splitStartedAt = Date.now();
      splitInterval = setInterval(() => {
        const elapsed = Date.now() - splitStartedAt;
        const s = Math.floor(elapsed / 1000);
        splitElapsedStr = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
      }, 100);
    } else {
      const secs = Math.round((Date.now() - splitStartedAt) / 1000);
      clearInterval(splitInterval);
      splitStartedAt = null;
      splitElapsedStr = '';
      splitInterval = null;
      addTime(secs);
    }
  }

  async function addTime(seconds) {
    if (!timerActiveEndsAt) return;
    try {
      const newEndsAt = timerActiveEndsAt + seconds * 1000;
      await dbPut('timer/endsAt', newEndsAt);
      timerActiveEndsAt = newEndsAt;
      timerSendStatus = { text: `+${seconds}s added.`, type: 'ok' };
    } catch (e) {
      timerSendStatus = { text: `Failed: ${e?.message ?? 'unknown'}`, type: 'err' };
    }
  }

  async function stopTimer() {
    if (!confirm('Clear the active countdown? Players will see it stop.')) return;
    try {
      await dbDelete('timer/endsAt');
      timerActiveEndsAt = null;
      timerDisplayStr = '';
      timerSendStatus = { text: 'Countdown cleared.', type: 'ok' };
    } catch (e) {
      timerSendStatus = { text: `Failed: ${e?.message ?? 'unknown'}`, type: 'err' };
    }
  }

  // ── HouseKit ──────────────────────────────────────────────────────────────
  const GITHUB_HOUSEKIT_API =
    'https://api.github.com/repos/RSXII/fate-city-1999/contents/static/images/housekit';

  let hkProperties = [];
  let hkEditing = null;
  let hkFormName = '';
  let hkFormLocation = '';
  let hkFormCost = '';
  let hkFormRooms = '';
  let hkFormTiles = '';
  let hkFormOwner = '';
  let hkFormAccess = [];
  let hkFormImage = '';
  let hkStatus = { text: '', type: '' };
  let hkSaving = false;

  // Floor plan grid editor
  let hkGridCols = 8;
  let hkGridRows = 7;
  let hkGridCells = {}; // { "r,c": "filled" | "entrance" }
  let hkGridWalls = {}; // { "r,c": string[] }
  let hkSelectedCell = null;

  function hkClearGrid() {
    hkGridCells = {}; hkGridWalls = {}; hkSelectedCell = null;
  }

  function hkCellClick(r, c) {
    const key = `${r},${c}`;
    if (!hkGridCells[key]) {
      hkGridCells = { ...hkGridCells, [key]: 'filled' };
      hkSelectedCell = key;
    } else if (hkSelectedCell === key) {
      const cells = { ...hkGridCells }; delete cells[key];
      const walls = { ...hkGridWalls }; delete walls[key];
      hkGridCells = cells; hkGridWalls = walls; hkSelectedCell = null;
    } else {
      hkSelectedCell = key;
    }
  }

  function hkCellRightClick(r, c) {
    const key = `${r},${c}`;
    const cur = hkGridCells[key];
    hkGridCells = { ...hkGridCells, [key]: cur === 'entrance' ? 'filled' : 'entrance' };
    hkSelectedCell = key;
  }

  function hkToggleWall(key, side) {
    const cur = hkGridWalls[key] || [];
    hkGridWalls = {
      ...hkGridWalls,
      [key]: cur.includes(side) ? cur.filter(s => s !== side) : [...cur, side],
    };
  }

  function hkResizeGrid() {
    const cells = {}, walls = {};
    for (const [key, val] of Object.entries(hkGridCells)) {
      const [r, c] = key.split(',').map(Number);
      if (r < hkGridRows && c < hkGridCols) {
        cells[key] = val;
        if (hkGridWalls[key]) walls[key] = hkGridWalls[key];
      }
    }
    hkGridCells = cells; hkGridWalls = walls;
  }

  function hkGridToFloorPlan() {
    return { rows: hkGridRows, cols: hkGridCols, cells: { ...hkGridCells }, walls: { ...hkGridWalls } };
  }

  function hkFloorPlanToGrid(fp) {
    if (!fp) { hkClearGrid(); hkGridCols = 8; hkGridRows = 7; return; }
    hkGridRows = fp.rows || 7;
    hkGridCols = fp.cols || 8;
    hkGridCells = fp.cells || {};
    hkGridWalls = fp.walls || {};
    hkSelectedCell = null;
  }

  // Access picker
  let hkPickerOpen = false;
  let hkPeopleList = []; // combined codenames + contact names

  // Image picker
  let hkImgPickerOpen = false;
  let hkImgPickerLoading = false;
  let hkImgPickerError = '';
  let hkImgPickerImages = [];

  async function refreshHkProperties() {
    try {
      const data = await dbGet('housekit/properties');
      if (!data) { hkProperties = []; return; }
      hkProperties = Object.keys(data)
        .map(k => ({ _id: k, ...data[k] }))
        .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    } catch { hkProperties = []; }
  }

  function decodeHtmlEntities(str) {
    const el = document.createElement('textarea');
    el.innerHTML = str;
    return el.value;
  }

  function hkLoadPeople() {
    const contactNames = contactList.map(c => c.name).filter(Boolean);
    const codenameNames = devices.slice();
    const npcNames = NPCS
      .filter(n => n.category === 'person')
      .map(n => decodeHtmlEntities(n.name))
      .filter(Boolean);
    const all = [...new Set([...codenameNames, ...contactNames, ...npcNames])].sort();
    hkPeopleList = all.filter(n => !hkFormAccess.includes(n));
  }

  function hkStartCreate() {
    hkEditing = null;
    hkFormName = ''; hkFormLocation = ''; hkFormCost = '';
    hkFormRooms = ''; hkFormTiles = ''; hkFormOwner = ''; hkFormAccess = [];
    hkFormImage = '';
    hkClearGrid(); hkGridCols = 8; hkGridRows = 7;
    hkStatus = { text: '', type: '' };
    hkPickerOpen = false; hkImgPickerOpen = false;
  }

  function hkStartEdit(p) {
    hkEditing = p._id;
    hkFormName = p.name || '';
    hkFormLocation = p.location || '';
    hkFormCost = p.cost || '';
    hkFormRooms = p.rooms != null ? String(p.rooms) : '';
    hkFormTiles = p.tiles != null ? String(p.tiles) : '';
    hkFormOwner = p.owner || '';
    hkFloorPlanToGrid(p.floorPlan ?? null);
    hkFormAccess = hkParseAccess(p.access);
    hkFormImage = p.image || '';
    hkStatus = { text: '', type: '' };
    hkPickerOpen = false; hkImgPickerOpen = false;
  }

  function hkCancelEdit() {
    hkEditing = null;
    hkStatus = { text: '', type: '' };
    hkPickerOpen = false; hkImgPickerOpen = false;
  }

  function hkParseAccess(raw) {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw.filter(Boolean);
    return Object.values(raw).filter(v => typeof v === 'string');
  }

  function hkAddAccess(name) {
    if (!name || hkFormAccess.includes(name)) return;
    hkFormAccess = [...hkFormAccess, name];
    hkPickerOpen = false;
  }

  function hkRemoveAccess(name) {
    hkFormAccess = hkFormAccess.filter(n => n !== name);
  }

  async function hkSaveProperty() {
    const name = hkFormName.trim();
    if (!name) { hkStatus = { text: 'Name is required.', type: 'err' }; return; }
    hkSaving = true;
    hkStatus = { text: 'Saving…', type: '' };
    const payload = {
      name,
      location: hkFormLocation.trim() || null,
      cost: hkFormCost.trim() || null,
      rooms: hkFormRooms ? Number(hkFormRooms) : null,
      tiles: hkFormTiles ? Number(hkFormTiles) : null,
      floorPlan: hkGridToFloorPlan(),
      owner: hkFormOwner.trim() || null,
      access: hkFormAccess,
      image: hkFormImage.trim() || null,
    };
    try {
      if (hkEditing) {
        payload.createdAt = hkProperties.find(p => p._id === hkEditing)?.createdAt ?? Date.now();
        await dbPut(`housekit/properties/${hkEditing}`, payload);
        hkStatus = { text: 'Property updated.', type: 'ok' };
      } else {
        payload.createdAt = Date.now();
        await dbPost('housekit/properties', payload);
        hkStatus = { text: 'Property created.', type: 'ok' };
        hkStartCreate();
      }
      await refreshHkProperties();
    } catch (e) {
      hkStatus = { text: `Failed: ${e?.message ?? 'unknown'}`, type: 'err' };
    }
    hkSaving = false;
  }

  async function hkDeleteProperty(id) {
    if (!confirm('Delete this property? It will be removed from the player app.')) return;
    try {
      await dbDelete(`housekit/properties/${id}`);
      if (hkEditing === id) hkCancelEdit();
      await refreshHkProperties();
    } catch (e) {
      hkStatus = { text: `Delete failed: ${e?.message ?? 'unknown'}`, type: 'err' };
    }
  }

  async function hkToggleImgPicker() {
    if (hkImgPickerOpen) { hkImgPickerOpen = false; return; }
    hkImgPickerOpen = true;
    hkImgPickerLoading = true;
    hkImgPickerError = '';
    hkImgPickerImages = [];
    try {
      const res = await fetch(GITHUB_HOUSEKIT_API);
      if (res.status === 404) { hkImgPickerLoading = false; hkImgPickerError = 'No images yet in static/images/housekit/.'; return; }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      hkImgPickerImages = data.filter(f => f.type === 'file' && /\.(png|jpe?g|gif|webp)$/i.test(f.name));
      if (!hkImgPickerImages.length) hkImgPickerError = 'No images found in static/images/housekit/.';
    } catch (e) {
      hkImgPickerError = `Failed: ${e?.message ?? 'error'}`;
    }
    hkImgPickerLoading = false;
  }

  let hkPoll;

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  let msgPoll;
  let emailPoll;
  let casePoll;
  let contactPoll;
  let datePoll;
  let oncePoll;
  let jobPoll;
  let ridesPoll;
  let devicesPoll;

  // ── Section: Downtime ────────────────────────────────────────────────────
  let dtActive = null;   // { enabled, index, period }
  let dtSession = null;  // current session node
  let dtAllSessions = []; // all sessions for history view
  let dtHistoryExpanded = {}; // { index: bool }
  let dtPoll;
  let dtPeriodFrom = '';
  let dtPeriodTo = '';
  let dtOpenStatus = { text: '', type: '' };
  let dtNarrativeSaveStates = {}; // { "CODENAME_idx": 'saving'|'saved'|'error'|'' }
  let dtPastNarrativeStates = {}; // { "sessionIdx_CODENAME_actionIdx": 'saving'|'saved'|'error'|'' }

  // Computed list of characters with completion status
  $: dtCharStatus = Object.values(CHARACTERS).map(char => ({
    char,
    completed: !!(dtSession?.completedBy?.[char.codename]),
    result: (() => {
      const r = dtSession?.results?.[char.codename];
      if (!r) return null;
      return { ...r, actions: normActions(r.actions) };
    })(),
  }));

  async function loadDowntimeState() {
    try {
      const activeData = await dbGet('downtime/active');
      dtActive = activeData;
      if (activeData?.enabled && activeData.index != null) {
        const session = await dbGet(`downtime/sessions/${activeData.index}`);
        dtSession = session;
      } else {
        dtSession = null;
      }
      await loadDtHistory();
    } catch { /* network hiccup */ }
  }

  async function loadDtHistory() {
    try {
      const all = await dbGet('downtime/sessions');
      if (!all) { dtAllSessions = []; return; }
      const activeIdx = dtActive?.index ?? null;
      const list = Object.entries(all)
        .map(([idx, session]) => {
          const results = {};
          for (const [codename, r] of Object.entries(session?.results ?? {})) {
            results[codename] = { ...r, actions: normActions(r.actions) };
          }
          return { index: +idx, period: session?.period, completedBy: session?.completedBy ?? {}, results };
        })
        .filter(s => s.index !== activeIdx || !dtActive?.enabled)
        .sort((a, b) => b.index - a.index);
      dtAllSessions = list;
    } catch { /* network hiccup */ }
  }

  async function deleteSession(index) {
    if (!confirm(`Delete session #${index}? This removes all player submissions for that period. Stats are not reverted.`)) return;
    try {
      await dbDelete(`downtime/sessions/${index}`);
      dtAllSessions = dtAllSessions.filter(s => s.index !== index);
      dtOpenStatus = { text: `Session #${index} deleted.`, type: 'ok' };
    } catch (e) {
      dtOpenStatus = { text: `Delete failed: ${e?.message ?? 'unknown'}`, type: 'err' };
    }
  }

  async function savePastNarrative(sessionIndex, codename, actionIndex, text) {
    const key = `${sessionIndex}_${codename}_${actionIndex}`;
    dtPastNarrativeStates = { ...dtPastNarrativeStates, [key]: 'saving' };
    try {
      await dbPut(
        `downtime/sessions/${sessionIndex}/results/${codename}/actions/${actionIndex}/text`,
        text,
      );
      dtPastNarrativeStates = { ...dtPastNarrativeStates, [key]: 'saved' };
      setTimeout(() => {
        dtPastNarrativeStates = { ...dtPastNarrativeStates, [key]: '' };
      }, 2000);
    } catch {
      dtPastNarrativeStates = { ...dtPastNarrativeStates, [key]: 'error' };
    }
  }

  async function openDowntime() {
    const from = dtPeriodFrom.trim();
    const to = dtPeriodTo.trim();
    if (!from || !to) {
      dtOpenStatus = { text: 'Period from and to are required.', type: 'err' };
      return;
    }
    dtOpenStatus = { text: 'Opening…', type: '' };
    try {
      const currentActive = await dbGet('downtime/active');
      const newIndex = (currentActive?.index ?? 0) + 1;
      await dbPut(`downtime/sessions/${newIndex}`, { period: { from, to } });
      await dbPut('downtime/active', { enabled: true, index: newIndex, period: { from, to } });
      dtPeriodFrom = '';
      dtPeriodTo = '';
      dtOpenStatus = { text: `Downtime period opened (session #${newIndex}).`, type: 'ok' };
      await loadDowntimeState();
    } catch (e) {
      dtOpenStatus = { text: `Failed: ${e?.message ?? 'unknown error'}`, type: 'err' };
    }
  }

  async function closeDowntime() {
    if (!confirm('Close the downtime period? Players will exit the downtime screen.')) return;
    try {
      await dbPut('downtime/active/enabled', false);
      dtActive = { ...dtActive, enabled: false };
      dtOpenStatus = { text: 'Downtime period closed.', type: 'ok' };
    } catch (e) {
      dtOpenStatus = { text: `Failed: ${e?.message ?? 'unknown error'}`, type: 'err' };
    }
  }

  async function saveDtNarrative(codename, actionIndex, text) {
    const key = `${codename}_${actionIndex}`;
    dtNarrativeSaveStates = { ...dtNarrativeSaveStates, [key]: 'saving' };
    try {
      await dbPut(
        `downtime/sessions/${dtActive.index}/results/${codename}/actions/${actionIndex}/text`,
        text,
      );
      dtNarrativeSaveStates = { ...dtNarrativeSaveStates, [key]: 'saved' };
      setTimeout(() => {
        dtNarrativeSaveStates = { ...dtNarrativeSaveStates, [key]: '' };
      }, 2000);
    } catch {
      dtNarrativeSaveStates = { ...dtNarrativeSaveStates, [key]: 'error' };
    }
  }

  onMount(() => {
    addReply(); addReply();
    loadMsgs();
    refreshDevices();
    refreshStaged();
    refreshLive();
    refreshCaseStaged();
    refreshCaseLive();
    refreshContacts();
    loadCurrentCalDate();
    refreshOnceLog();
    msgPoll     = visibilityAwareInterval(loadMsgs, 5000);
    emailPoll   = visibilityAwareInterval(() => { refreshStaged(); refreshLive(); }, 8000);
    casePoll    = visibilityAwareInterval(() => { refreshCaseStaged(); refreshCaseLive(); }, 8000);
    contactPoll = visibilityAwareInterval(refreshContacts, 10000);
    datePoll    = visibilityAwareInterval(loadCurrentCalDate, 10000);
    oncePoll    = visibilityAwareInterval(refreshOnceLog, 6000);
    loadJobs();
    jobPoll     = visibilityAwareInterval(loadJobs, 8000);
    refreshStagedRides();
    refreshLiveRides();
    ridesPoll    = visibilityAwareInterval(() => { refreshStagedRides(); refreshLiveRides(); }, 10000);
    loadFsgPosts();
    loadFsgAuthors();
    devicesPoll = visibilityAwareInterval(refreshDevices, 15000);
    loadTimerState();
    timerConsolePoll  = visibilityAwareInterval(loadTimerState, 4000);
    timerDisplayTick  = setInterval(updateTimerDisplayStr, 500);
    refreshHkProperties();
    hkStartCreate();
    hkPoll = visibilityAwareInterval(refreshHkProperties, 15000);
    loadDowntimeState();
    dtPoll = visibilityAwareInterval(loadDowntimeState, 8000);
  });

  onDestroy(() => {
    if (msgPoll) msgPoll();
    if (emailPoll) emailPoll();
    if (casePoll) casePoll();
    if (contactPoll) contactPoll();
    if (datePoll) datePoll();
    if (oncePoll) oncePoll();
    if (jobPoll) jobPoll();
    if (ridesPoll) ridesPoll();
    if (devicesPoll) devicesPoll();
    if (timerConsolePoll) timerConsolePoll();
    if (hkPoll) hkPoll();
    if (dtPoll) dtPoll();
    clearInterval(timerDisplayTick);
    clearInterval(splitInterval);
  });
</script>

<svelte:head>
  <title>Fate City: 1999 — GM Console</title>
</svelte:head>

<div class="console">

  <!-- ── Header ──────────────────────────────────────────────────────────── -->
  <div class="console-header">
    <span class="console-title">GM Console</span>
    <span class="console-sub">Fate City: 1999</span>
  </div>

  <!-- ── Tab bar ─────────────────────────────────────────────────────────── -->
  <div class="tab-bar" role="tablist">
    <button class="tab" class:active={activeTab === 'wire'}     role="tab" on:click={() => activeTab = 'wire'}>Wire</button>
    <button class="tab" class:active={activeTab === 'email'}    role="tab" on:click={() => activeTab = 'email'}>Email</button>
    <button class="tab" class:active={activeTab === 'cases'}    role="tab" on:click={() => activeTab = 'cases'}>Case Files</button>
    <button class="tab" class:active={activeTab === 'contacts'} role="tab" on:click={() => activeTab = 'contacts'}>Contacts</button>
    <button class="tab" class:active={activeTab === 'date'}     role="tab" on:click={() => activeTab = 'date'}>Date</button>
    <button class="tab tab--once" class:active={activeTab === 'once'} role="tab" on:click={() => activeTab = 'once'}>O.N.C.E.</button>
    <button class="tab" class:active={activeTab === 'jobs'}  role="tab" on:click={() => activeTab = 'jobs'}>Jobs</button>
    <button class="tab" class:active={activeTab === 'rides'} role="tab" on:click={() => activeTab = 'rides'}>Rides</button>
    <button class="tab tab--fsg"      class:active={activeTab === 'fatestagram'} role="tab" on:click={() => activeTab = 'fatestagram'}>FateSta</button>
    <button class="tab tab--timer"    class:active={activeTab === 'timer'}       role="tab" on:click={() => activeTab = 'timer'}>Timer</button>
    <button class="tab tab--housekit" class:active={activeTab === 'housekit'}    role="tab" on:click={() => { activeTab = 'housekit'; hkStartCreate(); }}>HouseKit</button>
    <button class="tab tab--downtime" class:active={activeTab === 'downtime'}   role="tab" on:click={() => { activeTab = 'downtime'; loadDowntimeState(); }}>Downtime</button>
  </div>

  <!-- ── Tab panels ──────────────────────────────────────────────────────── -->
  <div class="tab-panel">

    <!-- ══ WIRE MESSAGES ══════════════════════════════════════════════════ -->
    {#if activeTab === 'wire'}

      <div class="two-col">
      <div class="col-form">
      <div class="section">
        <div class="section-label">Sender</div>
        <div class="chip-grid">
          {#each contactList as c (c._id)}
            {@const chipColor = c.color || '#c9a227'}
            <button
              type="button"
              class="chip"
              class:selected={selectedSender?._id === c._id}
              style="color:{chipColor};border-color:{chipColor}"
              on:click={() => { selectedSender = c; }}
            >
              {#if c.avatar}
                <img
                  class="chip-avatar"
                  src="{base}/{c.avatar}"
                  alt=""
                  loading="lazy"
                  on:error={e => e.target.style.display = 'none'}
                />
              {/if}
              <span class="chip-label">
                <span>{c.name}</span>
                {#if c.number}<span class="chip-number">{c.number}</span>{/if}
              </span>
            </button>
          {/each}
        </div>
      </div>

      <div class="section">
        <div class="section-label">Recipients</div>
        <div class="chip-grid">
          <button
            type="button"
            class="chip"
            class:selected={selectedRecipients.length === 0}
            style="color:#c9a227;border-color:#c9a227"
            on:click={() => selectedRecipients = []}
          >
            <span class="chip-label"><span>All Players</span></span>
          </button>
          {#each devices as codename (codename)}
            <button
              type="button"
              class="chip"
              class:selected={selectedRecipients.includes(codename)}
              style="color:#6ab0d4;border-color:#6ab0d4"
              on:click={() => toggleRecipient(codename)}
            >
              <span class="chip-label"><span>{codename}</span></span>
            </button>
          {/each}
        </div>
        {#if !devices.length}
          <div class="selected-line" style="opacity:0.45">No players registered yet.</div>
        {/if}
      </div>

      <div class="section">
        <div class="section-label">Message</div>
        <div class="selected-line">
          {#if selectedSender}
            Sending as <strong style="color:{selectedSender.color}">{selectedSender.name}</strong>
            {#if selectedRecipients.length > 0}
              → <strong style="color:#6ab0d4">{selectedRecipients.join(', ')}</strong>
            {:else}
              → all players
            {/if}
          {:else}
            No sender selected yet.
          {/if}
        </div>

        <textarea bind:value={msgText} placeholder="Type what they'd actually text…"></textarea>

        <div class="attach-row">
          <button class="ghost-btn" type="button" on:click={togglePicker}>
            {pickerOpen ? 'Close picker' : '+ Attach image'}
          </button>
          {#if selectedImage}
            <div class="attached-preview">
              <img src={selectedImage.url} alt="" />
              <span>{selectedImage.name}</span>
              <button type="button" on:click={() => { selectedImage = null; }}>&times;</button>
            </div>
          {/if}
        </div>

        {#if pickerOpen}
          <div class="image-picker">
            {#if pickerLoading}
              <div class="img-picker-status">Loading…</div>
            {:else if pickerError}
              <div class="img-picker-status err">{pickerError}</div>
            {:else}
              {#each pickerImages as img (img.name)}
                <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
                <div class="img-thumb" on:click={() => selectImage(img)}>
                  <img src={img.download_url} alt={img.name} loading="lazy" />
                </div>
              {/each}
            {/if}
          </div>
        {/if}

        <div style="height:10px"></div>
        <button class="primary" disabled={!sendEnabled} on:click={sendMessage}>
          {selectedRecipients.length > 0 ? `Stage for ${selectedRecipients.length} player${selectedRecipients.length !== 1 ? 's' : ''}` : 'Stage for all players'}
        </button>
        <div class="status-line" class:ok={sendStatus.type === 'ok'} class:err={sendStatus.type === 'err'}>
          {sendStatus.text}
        </div>
      </div>
      </div><!-- /col-form -->
      <div class="col-list">

      <div class="section">
        <div class="section-label-row">
          <div class="section-label" style="margin-bottom:0">Staged — awaiting deploy</div>
          <button class="ghost-btn" on:click={loadMsgs}>Refresh</button>
        </div>
        <div class="log">
          {#if !stagedMsgs.length}
            <div class="log-empty">No staged messages.</div>
          {:else}
            {#each stagedMsgs as m (m._id)}
              <div class="chain-log-row">
                <div class="chain-log-top">
                  <span class="log-name" style="color:{m.color}">{m.sender}:</span>
                  <span class="log-text" style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{#if m.imageUrl}📷 {/if}{m.text ?? ''}</span>
                  <span class="chain-log-meta">{relTime(m.ts)}</span>
                </div>
                {#if m.recipients?.length}
                  <div class="chain-log-tags">
                    {#each m.recipients as r (r)}<span class="tag-badge">{r}</span>{/each}
                  </div>
                {/if}
                <div class="chain-log-actions">
                  <button class="deploy-btn" disabled={deployingMsgId === m._id} on:click={() => deployMessage(m._id)}>
                    {deployingMsgId === m._id ? 'Deploying…' : 'Deploy → Players'}
                  </button>
                  <button class="danger-btn" on:click={() => deleteMessage(m._id)}>Delete</button>
                </div>
              </div>
            {/each}
          {/if}
        </div>
      </div>

      <div class="section">
        <div class="section-label-row">
          <div class="section-label" style="margin-bottom:0">Live — on player devices</div>
          <button class="ghost-btn" on:click={loadMsgs}>Refresh</button>
        </div>
        {#if liveFilterOptions.hasBroadcast || liveFilterOptions.codenames.length}
          <div class="tag-filter-bar">
            <span class="tag-filter-label">Filter:</span>
            <button type="button" class="tag-badge" class:filter-active={liveThreadFilter === null}
              on:click={() => liveThreadFilter = null}>All</button>
            {#if liveFilterOptions.hasBroadcast}
              <button type="button" class="tag-badge" class:filter-active={liveThreadFilter === 'broadcast'}
                on:click={() => { liveThreadFilter = liveThreadFilter === 'broadcast' ? null : 'broadcast'; }}>Broadcast</button>
            {/if}
            {#each liveFilterOptions.codenames as codename (codename)}
              <button type="button" class="tag-badge" class:filter-active={liveThreadFilter === codename}
                on:click={() => { liveThreadFilter = liveThreadFilter === codename ? null : codename; }}>{codename}</button>
            {/each}
          </div>
        {/if}
        <div class="log" bind:this={liveMsgLogEl}>
          {#if !filteredLiveMsgs.length}
            <div class="log-empty">{liveThreadFilter ? `No live messages for "${liveThreadFilter}".` : 'No live messages.'}</div>
          {:else}
            {#each filteredLiveMsgs as m (m._id ?? m.ts)}
              <div class="chain-log-row">
                <div class="chain-log-top">
                  <span class="live-label">▶ &nbsp;</span>
                  <span class="log-name" style="color:{m.color}">{m.sender}:</span>
                  <span class="log-text" style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{#if m.imageUrl}📷 {/if}{m.text ?? ''}</span>
                  <span class="chain-log-meta">{relTime(m.ts)}</span>
                </div>
                {#if m.recipients?.length}
                  <div class="chain-log-tags">
                    {#each m.recipients as r (r)}<span class="tag-badge">{r}</span>{/each}
                  </div>
                {/if}
                <div class="chain-log-actions" style="justify-content:flex-end">
                  <button class="recall-btn" on:click={() => recallMessage(m._id)}>Recall</button>
                  <button class="danger-btn" on:click={() => deleteMessage(m._id)}>Delete</button>
                </div>
              </div>
            {/each}
          {/if}
        </div>
      </div>

      </div><!-- /col-list -->
      </div><!-- /two-col -->

    <!-- ══ EMAIL / DATA PACKETS ═══════════════════════════════════════════ -->
    {:else if activeTab === 'email'}

      <p class="tab-sub">Author a data packet — email chain, access log, document, or transmission. Stage silently, deploy when ready.</p>

      <div class="two-col">
      <div class="col-form">
      <div class="section">
        <div class="section-label">New Data Packet</div>

        <!-- Type picker -->
        <div class="type-picker">
          {#each [['email','Email'],['log','Log'],['document','Document'],['transmission','Transmission']] as [t, label]}
            <button type="button" class="type-btn" class:active={emailType === t} on:click={() => emailType = t}>{label}</button>
          {/each}
        </div>

        <input
          type="text"
          class="email-subject-input"
          placeholder="Subject / title…"
          bind:value={emailSubject}
          style="margin-top:8px"
        />
        <input
          type="text"
          class="email-subject-input"
          placeholder="Source / acquisition context (optional)…"
          bind:value={emailSource}
          style="font-size:12.5px;opacity:0.8"
        />
        <div class="email-meta-row">
          <select class="case-select" bind:value={emailClassification} style="flex:1;margin:0">
            <option value="decrypted">Decrypted</option>
            <option value="classified">Classified</option>
            <option value="corrupted">Corrupted</option>
            <option value="partial">Partial Decrypt</option>
            <option value="archived">Archived</option>
            <option value="verified">Verified</option>
          </select>
          <input
            type="text"
            class="email-subject-input"
            placeholder="Tags (comma-separated)…"
            bind:value={emailTags}
            style="flex:1;margin:0;font-size:12px;opacity:0.75"
          />
        </div>

        {#each (emailType === 'transmission' ? replies.slice(0, 1) : replies) as reply (reply.id)}
          <div class="reply-block">
            <div class="reply-block-header">
              {#if emailType === 'email'}
                <input
                  type="text"
                  class="reply-from-input"
                  placeholder="From: display name…"
                  value={reply.from}
                  on:input={e => { reply.from = e.target.value; replies = replies; }}
                />
              {:else if emailType === 'log' || emailType === 'document'}
                <input
                  type="text"
                  class="reply-from-input"
                  placeholder="Section label (optional)…"
                  value={reply.from}
                  on:input={e => { reply.from = e.target.value; replies = replies; }}
                  style="opacity:0.65"
                />
              {/if}
              {#if replies.length > 1 && emailType !== 'transmission'}
                <button type="button" class="remove-reply-btn" on:click={() => removeReply(reply.id)}>&times;</button>
              {/if}
            </div>

            <textarea
              class="reply-body-input"
              rows="3"
              placeholder={emailType === 'transmission' ? 'Transcript / transmission text…' : emailType === 'log' ? 'Log content…' : 'Content…'}
              value={reply.body}
              on:input={e => { reply.body = e.target.value; replies = replies; }}
            ></textarea>

            {#if emailType === 'log' || emailType === 'document'}
              <div class="block-format-row">
                <div class="format-group">
                  {#each [['sm','S'],['md','M'],['lg','L']] as [sz, lbl]}
                    <button type="button" class="fmt-btn" class:active={reply.size === sz}
                      on:click={() => { reply.size = sz; replies = replies; }}>{lbl}</button>
                  {/each}
                </div>
                <button type="button" class="fmt-btn fmt-bold" class:active={reply.bold}
                  on:click={() => { reply.bold = !reply.bold; replies = replies; }}>B</button>
                <div class="format-group">
                  <input type="color" class="color-swatch" style="width:26px;height:22px;padding:1px 2px"
                    value={reply.color || '#c8c0aa'}
                    on:input={e => { reply.color = e.target.value; replies = replies; }} />
                  {#if reply.color}
                    <button type="button" class="fmt-btn" title="Reset color"
                      on:click={() => { reply.color = ''; replies = replies; }}>✕</button>
                  {/if}
                </div>
              </div>
            {/if}

            {#if emailType !== 'transmission'}
              <div class="reply-attach-row">
                {#if !reply.imageUrl}
                  <button type="button" class="ghost-btn reply-attach-btn" on:click={() => toggleReplyPicker(reply.id)}>
                    {replyPickers[reply.id]?.open ? 'Close picker' : '+ Attach image'}
                  </button>
                {:else}
                  <div class="reply-attach-preview">
                    <span class="reply-attach-name">{reply.imageUrl.split('/').pop()}</span>
                    <button type="button" class="reply-attach-remove" on:click={() => clearReplyImage(reply.id)}>&times;</button>
                  </div>
                {/if}
              </div>

              {#if replyPickers[reply.id]?.open}
                <div class="reply-image-picker">
                  {#if replyPickers[reply.id].loading}
                    <div class="img-picker-status">Loading…</div>
                  {:else if replyPickers[reply.id].error}
                    <div class="img-picker-status err">{replyPickers[reply.id].error}</div>
                  {:else}
                    {#each replyPickers[reply.id].images as img (img.name)}
                      <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
                      <div class="img-thumb" on:click={() => selectReplyImage(reply.id, img)}>
                        <img src={img.download_url} alt={img.name} loading="lazy" />
                      </div>
                    {/each}
                  {/if}
                </div>
              {/if}
            {/if}
          </div>
        {/each}

        {#if emailType !== 'transmission'}
          <button class="ghost-btn" type="button" style="margin-top:4px" on:click={() => addReply()}>
            + Add Block
          </button>
        {/if}
        <div style="height:12px"></div>
        <button class="primary" disabled={staging} on:click={stageChain}>
          {staging ? 'Staging…' : 'Stage Packet (hidden from players)'}
        </button>
        <div class="status-line" class:ok={emailStatus.type === 'ok'} class:err={emailStatus.type === 'err'}>
          {emailStatus.text}
        </div>
      </div>
      </div><!-- /col-form -->
      <div class="col-list">

      <div class="section">
        <div class="section-label-row">
          <div class="section-label" style="margin-bottom:0">Staged — awaiting deploy</div>
          <button class="ghost-btn" on:click={refreshStaged}>Refresh</button>
        </div>
        {#if allStagedTags.length}
          <div class="tag-filter-bar">
            <span class="tag-filter-label">Filter:</span>
            {#each allStagedTags as tag (tag)}
              <button
                type="button"
                class="tag-badge"
                class:filter-active={stagedTagFilter === tag}
                on:click={() => { stagedTagFilter = stagedTagFilter === tag ? null : tag; }}
              >{tag}</button>
            {/each}
          </div>
        {/if}
        <div class="log">
          {#if !filteredStagedChains.length}
            <div class="log-empty">
              {stagedTagFilter ? `No staged chains tagged "${stagedTagFilter}".` : 'No staged chains.'}
            </div>
          {:else}
            {#each filteredStagedChains as chain (chain._id)}
              {@const msgs = normMessages(chain.messages)}
              <div class="chain-log-row">
                <div class="chain-log-top">
                  {#if chain.type && chain.type !== 'email'}
                    <span class="packet-type-badge">{chain.type}</span>
                  {/if}
                  <span class="chain-log-subject" style="color:#c9a227">{chain.subject}</span>
                  <span class="chain-log-meta">{msgs.length} · {relTime(chain.createdAt || 0)}</span>
                </div>
                {#if chain.tags?.length}
                  <div class="chain-log-tags">
                    {#each chain.tags as tag (tag)}
                      <span class="tag-badge">{tag}</span>
                    {/each}
                  </div>
                {/if}
                <div class="chain-log-actions">
                  <button class="deploy-btn" disabled={deployingId === chain._id} on:click={() => deployChain(chain._id)}>
                    {deployingId === chain._id ? 'Deploying…' : 'Deploy → Players'}
                  </button>
                  <button class="danger-btn" on:click={() => deleteChain(chain._id, false)}>Delete</button>
                </div>
              </div>
            {/each}
          {/if}
        </div>
      </div>

      <div class="section">
        <div class="section-label-row">
          <div class="section-label" style="margin-bottom:0">Live — on player devices</div>
          <button class="ghost-btn" on:click={refreshLive}>Refresh</button>
        </div>
        {#if allLiveTags.length}
          <div class="tag-filter-bar">
            <span class="tag-filter-label">Filter:</span>
            {#each allLiveTags as tag (tag)}
              <button
                type="button"
                class="tag-badge"
                class:filter-active={liveTagFilter === tag}
                on:click={() => { liveTagFilter = liveTagFilter === tag ? null : tag; }}
              >{tag}</button>
            {/each}
          </div>
        {/if}
        <div class="log">
          {#if !filteredLiveChains.length}
            <div class="log-empty">
              {liveTagFilter ? `No live chains tagged "${liveTagFilter}".` : 'No live chains.'}
            </div>
          {:else}
            {#each filteredLiveChains as chain (chain._id)}
              {@const msgs = normMessages(chain.messages)}
              <div class="chain-log-row">
                <div class="chain-log-top">
                  <span class="chain-log-subject">
                    <span class="live-label">▶ LIVE &nbsp;</span>
                    {#if chain.type && chain.type !== 'email'}
                      <span class="packet-type-badge">{chain.type}</span>
                    {/if}
                    {chain.subject}
                  </span>
                  <span class="chain-log-meta">{msgs.length} · {relTime(chain.createdAt || 0)}</span>
                </div>
                {#if chain.tags?.length}
                  <div class="chain-log-tags">
                    {#each chain.tags as tag (tag)}
                      <span class="tag-badge">{tag}</span>
                    {/each}
                  </div>
                {/if}
                <div class="chain-log-actions" style="justify-content:flex-end">
                  <button class="recall-btn" disabled={recallingId === chain._id} on:click={() => recallChain(chain._id)}>
                    {recallingId === chain._id ? 'Recalling…' : 'Recall'}
                  </button>
                  <button class="danger-btn" on:click={() => deleteChain(chain._id, true)}>Delete</button>
                </div>
              </div>
            {/each}
          {/if}
        </div>
      </div>

      </div><!-- /col-list -->
      </div><!-- /two-col -->

    <!-- ══ CASE FILES (persons / locations / intel) ══════════════════════════ -->
    {:else if activeTab === 'cases'}

      <p class="tab-sub">Author a new persons, locations, or intel case file. Stage it, then deploy when players are ready.</p>

      <div class="two-col">
      <div class="col-form">
      <div class="section">
        <div class="section-label">New Case File</div>

        <select class="case-select" bind:value={caseSection}>
          {#each CASE_SECTIONS as s (s.key)}
            <option value={s.key}>{s.label}</option>
          {/each}
        </select>

        <input type="text" class="email-subject-input" placeholder="File No. (e.g. CE-014)…" bind:value={caseFileNo} />
        <input type="text" class="email-subject-input" placeholder="Name…" bind:value={caseName} />
        <input type="text" class="email-subject-input" placeholder="Species…" bind:value={caseSpecies} />
        <input type="text" class="email-subject-input" placeholder="Reputation…" bind:value={caseRep} />

        <textarea placeholder="Overview…" bind:value={caseOverview}></textarea>
        <div style="height:10px"></div>
        <textarea placeholder="A Note From Your Benefactor — one line per bullet…" bind:value={caseNotes}></textarea>

        <div class="case-color-row">
          <span class="section-label" style="margin-bottom:0">Accent Color</span>
          <input type="color" class="color-swatch" bind:value={caseAccentColor} />
        </div>

        <div class="section-label-row" style="margin-top:14px">
          <div class="section-label" style="margin-bottom:0">Images ({caseImages.length})</div>
          <button class="ghost-btn" type="button" on:click={toggleCaseImagePicker}>
            {caseImagePicker.open ? 'Close picker' : '+ Add image'}
          </button>
        </div>

        {#if caseImages.length}
          <div class="case-image-chips">
            {#each caseImages as img (img.name)}
              <div class="attached-preview">
                <img src={img.url} alt="" />
                <span>{img.name}</span>
                <button type="button" on:click={() => removeCaseImage(img.name)}>&times;</button>
              </div>
            {/each}
          </div>
        {/if}

        {#if caseImagePicker.open}
          <div class="image-picker">
            {#if caseImagePicker.loading}
              <div class="img-picker-status">Loading…</div>
            {:else if caseImagePicker.error}
              <div class="img-picker-status err">{caseImagePicker.error}</div>
            {:else}
              {#each caseImagePicker.images as img (img.name)}
                <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
                <div class="img-thumb" on:click={() => addCaseImage(img)}>
                  <img src={img.download_url} alt={img.name} loading="lazy" />
                </div>
              {/each}
            {/if}
          </div>
        {/if}

        <div style="height:12px"></div>
        <button class="primary" disabled={stagingCase} on:click={stageCase}>
          {stagingCase ? 'Staging…' : 'Stage Case File (hidden from players)'}
        </button>
        <div class="status-line" class:ok={caseStatus.type === 'ok'} class:err={caseStatus.type === 'err'}>
          {caseStatus.text}
        </div>
      </div>
      </div><!-- /col-form -->
      <div class="col-list">

      <div class="section">
        <div class="section-label-row">
          <div class="section-label" style="margin-bottom:0">Staged — awaiting deploy</div>
          <button class="ghost-btn" on:click={refreshCaseStaged}>Refresh</button>
        </div>
        <div class="log">
          {#if !stagedCases.length}
            <div class="log-empty">No staged case files.</div>
          {:else}
            {#each stagedCases as c (c._id)}
              <div class="chain-log-row">
                <div class="chain-log-top">
                  <span class="chain-log-subject" style="color:#c9a227">
                    <span class="case-section-badge">{caseSectionLabel(c.section)}</span> {c.name}
                  </span>
                  <span class="chain-log-meta">{relTime(c.createdAt || 0)}</span>
                </div>
                <div class="chain-log-actions">
                  <button class="deploy-btn" disabled={deployingCaseId === c._id} on:click={() => deployCase(c._id)}>
                    {deployingCaseId === c._id ? 'Deploying…' : 'Deploy → Players'}
                  </button>
                  <button class="danger-btn" on:click={() => deleteCase(c._id, false)}>Delete</button>
                </div>
              </div>
            {/each}
          {/if}
        </div>
      </div>

      <div class="section">
        <div class="section-label-row">
          <div class="section-label" style="margin-bottom:0">Live — on player devices</div>
          <button class="ghost-btn" on:click={refreshCaseLive}>Refresh</button>
        </div>
        <div class="log">
          {#if !liveCases.length}
            <div class="log-empty">No live case files.</div>
          {:else}
            {#each liveCases as c (c._id)}
              <div class="chain-log-row">
                <div class="chain-log-top">
                  <span class="chain-log-subject">
                    <span class="live-label">▶ LIVE &nbsp;</span>
                    <span class="case-section-badge">{caseSectionLabel(c.section)}</span> {c.name}
                  </span>
                  <span class="chain-log-meta">{relTime(c.createdAt || 0)}</span>
                </div>
                <div class="chain-log-actions" style="justify-content:flex-end">
                  <button class="recall-btn" disabled={recallingCaseId === c._id} on:click={() => recallCase(c._id)}>
                    {recallingCaseId === c._id ? 'Recalling…' : 'Recall'}
                  </button>
                  <button class="danger-btn" on:click={() => deleteCase(c._id, true)}>Delete</button>
                </div>
              </div>
            {/each}
          {/if}
        </div>
      </div>

      </div><!-- /col-list -->
      </div><!-- /two-col -->

    <!-- ══ PHONE CONTACTS ══════════════════════════════════════════════════ -->
    {:else if activeTab === 'contacts'}

      <p class="tab-sub">Manage contacts. All contacts appear in the Wire sender list. Toggle phone visibility without deleting.</p>

      <div class="section">
        <div class="section-label">Add Contact</div>
        <div class="contact-form">
          <input type="text" class="contact-input" placeholder="Name…" bind:value={newCName} />
          <input type="text" class="contact-input" placeholder="Phone number (optional)…" bind:value={newCNumber} />
          <input type="text" class="contact-input" placeholder="Role / subtitle (optional)…" bind:value={newCSubtitle} />
          <div class="sender-color-row">
            <span class="form-label" style="width:auto;flex-shrink:0">Color</span>
            <input type="color" class="color-swatch" bind:value={newCColor} />
            <span class="sender-color-preview" style="color:{newCColor}">{newCColor}</span>
          </div>
          <div class="img-picker-row" style="margin-top:2px">
            <span class="img-selected">{newCAvatar || 'No avatar selected'}</span>
            <button class="picker-btn" type="button" on:click={toggleContactAvatarPicker}>
              {contactAvatarPickerOpen ? 'Close' : 'Pick avatar'}
            </button>
          </div>
        </div>

        {#if contactAvatarPickerOpen}
          <div class="img-picker-grid" style="margin-top:8px">
            {#if contactAvatarPickerLoading}
              <span class="picker-status">Loading…</span>
            {:else if contactAvatarPickerError}
              <span class="picker-status picker-err">{contactAvatarPickerError}</span>
            {:else}
              {#each contactAvatarPickerImages as img (img.name)}
                <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
                <div class="picker-thumb" class:selected={newCAvatar === `images/wire-profiles/${img.name}`} on:click={() => selectContactAvatar(img)}>
                  <img src={img.download_url} alt={img.name} loading="lazy" style="aspect-ratio:1;object-position:50% 20%" />
                  <span class="picker-name">{img.name}</span>
                </div>
              {/each}
            {/if}
          </div>
        {/if}

        <div style="height:10px"></div>
        <button class="primary" disabled={addingContact || !newCName.trim()} on:click={addContact}>
          {addingContact ? 'Adding…' : 'Add Contact'}
        </button>
        <div class="status-line" class:ok={contactStatus.type === 'ok'} class:err={contactStatus.type === 'err'}>
          {contactStatus.text}
        </div>
      </div>

      <div class="section">
        <div class="section-label-row">
          <div class="section-label" style="margin-bottom:0">Contacts ({contactList.length})</div>
          <button class="ghost-btn" on:click={refreshContacts}>Refresh</button>
        </div>
        <div class="log">
          {#if !contactList.length}
            <div class="log-empty">No contacts yet. Add one above.</div>
          {:else}
            {#each contactList as c (c._id)}
              {#if editingId === c._id}
                <div class="contact-edit-block">
                  <div class="contact-form" style="margin-bottom:8px">
                    <input type="text" class="contact-input" placeholder="Name…" bind:value={editCName} />
                    <input type="text" class="contact-input" placeholder="Phone number (optional)…" bind:value={editCNumber} />
                    <input type="text" class="contact-input" placeholder="Role / subtitle (optional)…" bind:value={editCSubtitle} />
                    <div class="sender-color-row">
                      <span class="form-label" style="width:auto;flex-shrink:0">Color</span>
                      <input type="color" class="color-swatch" bind:value={editCColor} />
                      <span class="sender-color-preview" style="color:{editCColor}">{editCColor}</span>
                    </div>
                    <div class="img-picker-row" style="margin-top:2px">
                      <span class="img-selected">{editCAvatar || 'No avatar selected'}</span>
                      <button class="picker-btn" type="button" on:click={toggleEditAvatarPicker}>
                        {editAvatarPickerOpen ? 'Close' : 'Pick avatar'}
                      </button>
                    </div>
                  </div>
                  {#if editAvatarPickerOpen}
                    <div class="img-picker-grid" style="margin-bottom:8px">
                      {#if editAvatarPickerLoading}
                        <span class="picker-status">Loading…</span>
                      {:else if editAvatarPickerError}
                        <span class="picker-status picker-err">{editAvatarPickerError}</span>
                      {:else}
                        {#each editAvatarPickerImages as img (img.name)}
                          <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
                          <div class="picker-thumb" class:selected={editCAvatar === `images/wire-profiles/${img.name}`} on:click={() => selectEditAvatar(img)}>
                            <img src={img.download_url} alt={img.name} loading="lazy" style="aspect-ratio:1;object-position:50% 20%" />
                            <span class="picker-name">{img.name}</span>
                          </div>
                        {/each}
                      {/if}
                    </div>
                  {/if}
                  <div class="contact-edit-actions">
                    <button class="primary" style="flex:1" disabled={savingContact || !editCName.trim()} on:click={saveContact}>
                      {savingContact ? 'Saving…' : 'Save'}
                    </button>
                    <button class="ghost-btn" on:click={cancelEdit}>Cancel</button>
                  </div>
                </div>
              {:else}
                <div class="contact-log-row">
                  <div class="contact-log-info">
                    {#if c.avatar}
                      <img class="contact-log-avatar" src="{base}/{c.avatar}" alt="" loading="lazy"
                        on:error={e => e.target.style.display = 'none'} />
                    {:else}
                      <span class="contact-log-dot" style="background:{c.color || '#c9a227'}"></span>
                    {/if}
                    <div class="contact-log-text">
                      <span class="contact-log-name" class:dimmed={!c.enabled} style="color:{c.color || '#e8dfc8'}">{c.name}</span>
                      {#if c.number || c.subtitle}
                        <span class="contact-log-meta">{c.number || ''}{c.number && c.subtitle ? ' · ' : ''}{c.subtitle || ''}</span>
                      {/if}
                    </div>
                  </div>
                  <div class="contact-log-actions">
                    <button class="ghost-btn" style="padding:4px 9px;font-size:10px" on:click={() => startEdit(c)}>Edit</button>
                    <button class="toggle-btn" class:on={c.enabled} on:click={() => toggleContact(c._id, c.enabled)}>
                      {c.enabled ? 'In Phone' : 'Hidden'}
                    </button>
                    <button class="danger-btn" on:click={() => deleteContact(c._id)}>Delete</button>
                  </div>
                </div>
              {/if}
            {/each}
          {/if}
        </div>
      </div>

    <!-- ══ CURRENT DATE ════════════════════════════════════════════════════ -->
    {:else if activeTab === 'date'}

      <p class="tab-sub">Set the in-game date shown on player devices. Changes propagate within 10 seconds.</p>

      <div class="section">
        <div class="section-label">Set Date</div>

        <div class="cal-current-row">
          <span class="cal-current-label">Currently:</span>
          {#if currentCalDate}
            <span class="cal-current-val">
              {CAL_MONTH_NAMES[currentCalDate.month - 1]} {currentCalDate.day}, {currentCalDate.year}
            </span>
          {:else}
            <span class="cal-current-none">Not set — using default (Feb 2, 1999)</span>
          {/if}
        </div>

        <div class="cal-picker-row">
          <select class="cal-select" bind:value={calMonth}>
            {#each CAL_MONTH_NAMES as name, i}
              <option value={i + 1}>{name}</option>
            {/each}
          </select>
          <select class="cal-select cal-select--day" bind:value={calDay}>
            {#each { length: 31 } as _, i}
              <option value={i + 1}>{i + 1}</option>
            {/each}
          </select>
          <input class="cal-select cal-select--year" type="number" min="1990" max="2099" bind:value={calYear} />
        </div>

        <button class="primary" disabled={settingDate} on:click={setCalDate}>
          {settingDate ? 'Setting…' : 'Set Date'}
        </button>
        <div class="status-line" class:ok={dateStatus.type === 'ok'} class:err={dateStatus.type === 'err'}>
          {dateStatus.text}
        </div>
      </div>

    <!-- ══ O.N.C.E. TRANSMISSIONS ══════════════════════════════════════════ -->
    {:else if activeTab === 'once'}

      <p class="tab-sub">Author a transmission from M. Stage it silently, then deploy when players are ready.</p>

      <div class="section">
        <div class="section-label once-section-label">New Transmission</div>
        <textarea
          class="once-textarea"
          bind:value={onceText}
          placeholder="Message from M… instructions, objectives, warnings."
        ></textarea>
        <div style="height:10px"></div>
        <button class="once-send-btn" disabled={onceSending || !onceText.trim()} on:click={stageOnceMessage}>
          {onceSending ? 'Staging…' : 'Stage Transmission (hidden from players)'}
        </button>
        <div class="status-line" class:ok={onceStatus.type === 'ok'} class:err={onceStatus.type === 'err'}>
          {onceStatus.text}
        </div>
      </div>

      <div class="section">
        <div class="section-label-row">
          <div class="section-label once-section-label" style="margin-bottom:0">Staged — awaiting deploy</div>
          <button class="ghost-btn" on:click={refreshStagedOnce}>Refresh</button>
        </div>
        <div class="log">
          {#if !stagedOnce.length}
            <div class="log-empty">No staged transmissions.</div>
          {:else}
            {#each stagedOnce as m (m._id ?? m.ts)}
              <div class="chain-log-row">
                <div class="chain-log-top">
                  <span class="once-log-m">M:</span>
                  <span class="log-text">{m.text}<span class="log-time">{relTime(m.ts)}</span></span>
                </div>
                <div class="chain-log-actions">
                  <button class="deploy-btn" disabled={deployingOnceId === m._id} on:click={() => deployOnce(m._id)}>
                    {deployingOnceId === m._id ? 'Deploying…' : 'Deploy → Players'}
                  </button>
                  <button class="danger-btn" on:click={() => deleteOnceMessage(m._id, false)}>Delete</button>
                </div>
              </div>
            {/each}
          {/if}
        </div>
      </div>

      <div class="section">
        <div class="section-label-row">
          <div class="section-label once-section-label" style="margin-bottom:0">Live — on player devices</div>
          <button class="ghost-btn" on:click={refreshLiveOnce}>Refresh</button>
        </div>
        <div class="log">
          {#if !liveOnce.length}
            <div class="log-empty">No live transmissions.</div>
          {:else}
            {#each liveOnce as m (m._id ?? m.ts)}
              <div class="chain-log-row">
                <div class="chain-log-top">
                  <span class="once-log-m"><span class="live-label">▶ LIVE &nbsp;</span>M:</span>
                  <span class="log-text">{m.text}<span class="log-time">{relTime(m.ts)}</span></span>
                </div>
                <div class="chain-log-actions" style="justify-content:flex-end">
                  <button class="recall-btn" disabled={recallingOnceId === m._id} on:click={() => recallOnce(m._id)}>
                    {recallingOnceId === m._id ? 'Recalling…' : 'Recall'}
                  </button>
                  <button class="danger-btn" on:click={() => deleteOnceMessage(m._id, true)}>Delete</button>
                </div>
              </div>
            {/each}
          {/if}
        </div>
      </div>

    <!-- ══ JOBS ══════════════════════════════════════════════════════════════ -->
    {:else if activeTab === 'jobs'}

      <p class="tab-sub">Author a job and stage it silently, then deploy when players are ready.</p>

      <div class="two-col">
      <div class="col-form">
      <div class="section">
        <div class="section-label">New Job</div>

        <input
          type="text"
          class="email-subject-input"
          placeholder="Title (e.g. BLOOMWORK FAIRY)…"
          bind:value={jobTitle}
        />

        <textarea
          placeholder="Brief description (optional)…"
          bind:value={jobBrief}
          rows="2"
          style="margin-bottom:12px"
        ></textarea>

        <div class="section-label" style="margin-bottom:8px">Initial Status</div>
        <div class="job-status-group">
          <button
            class="job-status-btn"
            class:active={jobNewStatus === 'active'}
            style="--sc:#22c55e"
            on:click={() => jobNewStatus = 'active'}
          >● Active</button>
          <button
            class="job-status-btn"
            class:active={jobNewStatus === 'danger'}
            style="--sc:#f59e0b"
            on:click={() => jobNewStatus = 'danger'}
          >⚠ In Danger</button>
          <button
            class="job-status-btn"
            class:active={jobNewStatus === 'compromised'}
            style="--sc:#e05a3a"
            on:click={() => jobNewStatus = 'compromised'}
          >✕ Compromised</button>
        </div>

        <button class="primary" style="margin-top:14px" disabled={creatingJob || !jobTitle.trim()} on:click={createJob}>
          {creatingJob ? 'Staging…' : 'Stage Job (hidden from players)'}
        </button>
        <div class="status-line" class:ok={jobCreateStatus.type === 'ok'} class:err={jobCreateStatus.type === 'err'}>
          {jobCreateStatus.text}
        </div>
      </div>
      </div><!-- /col-form -->
      <div class="col-list">

      <div class="section">
        <div class="section-label-row">
          <div class="section-label" style="margin-bottom:0">Staged — awaiting deploy</div>
          <button class="ghost-btn" on:click={refreshStagedJobs}>Refresh</button>
        </div>
        {#if !stagedJobs.length}
          <div class="log" style="margin-top:8px"><div class="log-empty">No staged jobs.</div></div>
        {:else}
          {#each stagedJobs as job (job._id)}
            {@const sc = JOB_STATUS[job.status] ?? JOB_STATUS.active}
            <div class="job-item">
              <div class="job-item-head">
                <span class="job-item-no">{job.fileNo ?? '—'}</span>
                <span class="job-item-title">{job.title}</span>
                <span class="job-item-badge" style="color:{sc.color}">● {sc.label}</span>
              </div>
              {#if job.brief}
                <div class="job-item-brief">{job.brief}</div>
              {/if}
              {#if job.steps?.length}
                <ul class="job-item-steps">
                  {#each [...job.steps].reverse() as step}
                    <li>{step.text}{#if step.date} <span style="color:#c9a227;font-size:11px">— {step.date}</span>{/if}</li>
                  {/each}
                </ul>
              {/if}
              <div class="job-item-controls">
                <input
                  type="text"
                  class="job-step-input"
                  placeholder="Log a step…"
                  bind:value={stepTexts[job._id]}
                  on:keydown={e => e.key === 'Enter' && addJobStep(job._id)}
                />
                <input
                  type="text"
                  class="job-date-input"
                  placeholder="YYYY-MM-DD"
                  bind:value={stepDates[job._id]}
                />
                <button class="ghost-btn" on:click={() => addJobStep(job._id)}>Log</button>
              </div>
              <div class="chain-log-actions" style="margin-top:10px">
                <button class="deploy-btn" disabled={deployingJobId === job._id} on:click={() => deployJob(job._id)}>
                  {deployingJobId === job._id ? 'Deploying…' : 'Deploy → Players'}
                </button>
                <button class="danger-btn" on:click={() => deleteJob(job._id, false)}>Delete</button>
              </div>
            </div>
          {/each}
        {/if}
      </div>

      <div class="section">
        <div class="section-label-row">
          <div class="section-label" style="margin-bottom:0">Live — on player devices</div>
          <button class="ghost-btn" on:click={refreshLiveJobs}>Refresh</button>
        </div>
        {#if !liveJobs.length}
          <div class="log" style="margin-top:8px"><div class="log-empty">No live jobs.</div></div>
        {:else}
          {#each liveJobs as job (job._id)}
            {@const sc = JOB_STATUS[job.status] ?? JOB_STATUS.active}
            <div class="job-item">
              <div class="job-item-head">
                <span class="job-item-no"><span class="live-label">▶ LIVE &nbsp;</span>{job.fileNo ?? '—'}</span>
                <span class="job-item-title">{job.title}</span>
                <span class="job-item-badge" style="color:{sc.color}">● {sc.label}</span>
              </div>
              {#if job.brief}
                <div class="job-item-brief">{job.brief}</div>
              {/if}
              {#if job.steps?.length}
                <ul class="job-item-steps">
                  {#each [...job.steps].reverse() as step}
                    <li>{step.text}</li>
                  {/each}
                </ul>
              {/if}
              <div class="job-item-controls">
                <input
                  type="text"
                  class="job-step-input"
                  placeholder="Log a step…"
                  bind:value={stepTexts[job._id]}
                  on:keydown={e => e.key === 'Enter' && addJobStep(job._id)}
                />
                <input
                  type="text"
                  class="job-date-input"
                  placeholder="YYYY-MM-DD"
                  bind:value={stepDates[job._id]}
                />
                <button class="ghost-btn" on:click={() => addJobStep(job._id)}>Log</button>
              </div>
              <div class="job-item-actions">
                <div class="job-status-group small">
                  <button class="job-status-btn" class:active={job.status === 'active'} style="--sc:#22c55e" on:click={() => setJobStatus(job._id, 'active')}>Active</button>
                  <button class="job-status-btn" class:active={job.status === 'danger'} style="--sc:#f59e0b" on:click={() => setJobStatus(job._id, 'danger')}>Danger</button>
                  <button class="job-status-btn" class:active={job.status === 'compromised'} style="--sc:#e05a3a" on:click={() => setJobStatus(job._id, 'compromised')}>Compromised</button>
                </div>
                <button class="recall-btn" disabled={recallingJobId === job._id} on:click={() => recallJob(job._id)}>
                  {recallingJobId === job._id ? 'Recalling…' : 'Recall'}
                </button>
                <button class="danger-btn" on:click={() => deleteJob(job._id, true)}>Delete</button>
              </div>
            </div>
          {/each}
        {/if}
      </div>
      </div><!-- /col-list -->
      </div><!-- /two-col -->

    {/if}

    {#if activeTab === 'rides'}
      <div class="rides-builder">
        <h3 class="section-label">New Vehicle</h3>

        <div class="form-row">
          <label class="form-label">Make</label>
          <input class="form-input" type="text" placeholder="e.g. Thorsen" bind:value={rideMake} />
        </div>
        <div class="form-row">
          <label class="form-label">Model</label>
          <input class="form-input" type="text" placeholder="e.g. Hound" bind:value={rideModel} />
        </div>
        <div class="form-row">
          <label class="form-label">Year</label>
          <input class="form-input" type="number" min="1900" max="2099" bind:value={rideYear} />
        </div>
        <div class="form-row">
          <label class="form-label">Class</label>
          <select class="form-input form-select" bind:value={rideClass} on:change={() => applyClassDefaults(rideClass)}>
            <optgroup label="Cars & Trucks">
              <option value="compact">Compact</option>
              <option value="sedan">Sedan</option>
              <option value="sport">Sport</option>
              <option value="super_sport">Super Sport</option>
              <option value="light_armored">Light Armored</option>
              <option value="heavy_armored">Heavy Armored</option>
              <option value="off_road">Off Road</option>
            </optgroup>
            <optgroup label="Other">
              <option value="light_armor">Light Armor</option>
              <option value="heavy_armor">Heavy Armor</option>
              <option value="military">Military</option>
              <option value="aircraft">Aircraft</option>
            </optgroup>
          </select>
        </div>

        <div class="form-row">
          <label class="form-label">Image</label>
          <div class="img-picker-row">
            <span class="img-selected">{rideImage || 'None'}</span>
            <button class="picker-btn" on:click={toggleRidesPicker}>
              {ridesPickerOpen ? 'Close' : 'Pick'}
            </button>
          </div>
        </div>

        {#if ridesPickerOpen}
          <div class="img-picker-grid">
            {#if ridesPickerLoading}
              <span class="picker-status">Loading…</span>
            {:else if ridesPickerError}
              <span class="picker-status picker-err">{ridesPickerError}</span>
            {:else}
              {#each ridesPickerImages as img}
                <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
                <div class="picker-thumb" class:selected={rideImage === img.name} on:click={() => selectRidesImage(img)}>
                  <img src={img.download_url} alt={img.name} loading="lazy" />
                  <span class="picker-name">{img.name}</span>
                </div>
              {/each}
            {/if}
          </div>
        {/if}

        <h3 class="section-label" style="margin-top:18px">Stats</h3>
        <div class="stats-grid">
          <div class="form-row">
            <label class="form-label">SDP</label>
            <input class="form-input" type="number" placeholder="0" bind:value={rideSdp} />
          </div>
          <div class="form-row">
            <label class="form-label">Seats</label>
            <input class="form-input" type="number" placeholder="0" bind:value={rideSeats} />
          </div>
          <div class="form-row">
            <label class="form-label">MOVE · Combat</label>
            <input class="form-input" type="number" placeholder="0" bind:value={rideSpeedCombat} />
          </div>
          <div class="form-row">
            <label class="form-label">MOVE · Narrative</label>
            <input class="form-input" type="text" placeholder="e.g. 60 MPH" bind:value={rideSpeedNarrative} />
          </div>
          <div class="form-row">
            <label class="form-label">Cost</label>
            <input class="form-input" type="text" placeholder="e.g. 10,000" bind:value={rideCost} />
          </div>
        </div>

        <h3 class="section-label" style="margin-top:18px">Upgrades</h3>
        <div class="upgrade-toggle-grid">
          {#each VEHICLE_UPGRADES as u (u.key)}
            <button
              type="button"
              class="upgrade-toggle"
              class:active={rideUpgrades.has(u.key)}
              on:click={() => toggleUpgrade(u.key)}
            >{u.label}</button>
          {/each}
        </div>

        <button class="action-btn" disabled={creatingRide} on:click={createRide}>
          {creatingRide ? 'Staging…' : 'Stage Vehicle'}
        </button>
        {#if rideCreateStatus.text}
          <p class="status-msg" class:ok={rideCreateStatus.type === 'ok'} class:err={rideCreateStatus.type === 'err'}>
            {rideCreateStatus.text}
          </p>
        {/if}

        <!-- Staged vehicles -->
        {#if stagedRides.length > 0}
          <h3 class="section-label" style="margin-top:24px">Staged</h3>
          {#each stagedRides as r}
            <div class="ride-item">
              <div class="ride-item-info">
                <span class="ride-title">{r.year} {r.make} {r.model}</span>
                <span class="ride-class">
                  {CLASS_CONFIG[r.class]?.label ?? r.class}
                  {#if r.upgrades?.length}<span class="ride-upgrade-count">· {r.upgrades.length} upgrade{r.upgrades.length !== 1 ? 's' : ''}</span>{/if}
                </span>
              </div>
              <div class="ride-item-actions">
                <button class="deploy-btn" disabled={deployingRideId === r._id} on:click={() => deployRide(r._id)}>
                  {deployingRideId === r._id ? '…' : 'Deploy'}
                </button>
                <button class="danger-btn" on:click={() => deleteRide(r._id, false)}>Delete</button>
              </div>
            </div>
          {/each}
        {/if}

        <!-- Live vehicles -->
        {#if liveRides.length > 0}
          <h3 class="section-label" style="margin-top:24px">Live</h3>
          {#each liveRides as r}
            <div class="ride-item ride-item--live">
              <div class="ride-item-info">
                <span class="ride-title">{r.year} {r.make} {r.model}</span>
                <span class="ride-class">
                  {CLASS_CONFIG[r.class]?.label ?? r.class}
                  {#if r.upgrades?.length}<span class="ride-upgrade-count">· {r.upgrades.length} upgrade{r.upgrades.length !== 1 ? 's' : ''}</span>{/if}
                </span>
              </div>
              <div class="ride-item-actions">
                <button class="recall-btn" disabled={recallingRideId === r._id} on:click={() => recallRide(r._id)}>
                  {recallingRideId === r._id ? '…' : 'Recall'}
                </button>
                <button class="danger-btn" on:click={() => deleteRide(r._id, true)}>Delete</button>
              </div>
            </div>
          {/each}
        {/if}
      </div>
    {/if}

    <!-- ══ FATESTAGRAM ══════════════════════════════════════════════════════ -->
    {#if activeTab === 'fatestagram'}

      <p class="tab-sub">Author FateStaGram posts. Use Deploy to make them visible on player devices.</p>

      <div class="section">
        <div class="section-label">New Post</div>

        <!-- Known author quick-fill -->
        {#if fsgKnownAuthors.length}
          <div class="fsg-author-chips">
            {#each fsgKnownAuthors as a (a.username)}
              <button type="button" class="fsg-author-chip" class:selected={fsgUsername === a.username} on:click={() => quickFillAuthor(a)}>
                {a.username}{a.handle ? ` · ${a.handle}` : ''}
              </button>
            {/each}
          </div>
        {/if}

        <!-- Username + handle -->
        <input type="text" class="email-subject-input" placeholder="Username (display name)…" bind:value={fsgUsername} />
        <input type="text" class="email-subject-input" placeholder="@handle (optional)…" bind:value={fsgHandle} />

        <!-- Post image picker -->
        <div class="section-label-row" style="margin-top:10px">
          <div class="section-label" style="margin-bottom:0">Post Image</div>
          <button class="ghost-btn" type="button" on:click={toggleFsgPicker}>
            {fsgPickerOpen ? 'Close picker' : '+ Pick image'}
          </button>
        </div>

        {#if fsgPickerSelected}
          <div class="attached-preview" style="margin-bottom:10px">
            <img src={fsgPickerSelected.url} alt="" />
            <span>{fsgPickerSelected.name}</span>
            <button type="button" on:click={() => { fsgPickerSelected = null; fsgImageUrl = ''; }}>&times;</button>
          </div>
        {:else if !fsgPickerOpen}
          <input type="text" class="email-subject-input" placeholder="Or paste image URL directly…" bind:value={fsgImageUrl} />
        {/if}

        {#if fsgPickerOpen}
          <div class="image-picker">
            {#if fsgPickerLoading}
              <div class="img-picker-status">Loading…</div>
            {:else if fsgPickerError}
              <div class="img-picker-status err">{fsgPickerError}</div>
            {:else}
              {#each fsgPickerImages as img (img.name)}
                <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
                <div class="img-thumb" class:selected={fsgImageUrl === img.download_url} on:click={() => selectFsgImage(img)}>
                  <img src={img.download_url} alt={img.name} loading="lazy" />
                </div>
              {/each}
            {/if}
          </div>
        {/if}

        <!-- Avatar picker -->
        <div class="section-label-row" style="margin-top:12px">
          <div class="section-label" style="margin-bottom:0">Profile Avatar (optional)</div>
          <button class="ghost-btn" type="button" on:click={toggleFsgAvatarPicker}>
            {fsgAvatarPickerOpen ? 'Close' : 'Pick avatar'}
          </button>
        </div>

        {#if fsgAvatarUrl}
          <div class="attached-preview" style="margin-bottom:8px">
            <img src={fsgAvatarUrl} alt="" style="border-radius:50%" />
            <span>Avatar set</span>
            <button type="button" on:click={() => { fsgAvatarUrl = ''; fsgAvatarPickerOpen = false; }}>&times;</button>
          </div>
        {/if}

        {#if fsgAvatarPickerOpen}
          <div class="img-picker-grid" style="margin-bottom:10px">
            {#if fsgAvatarPickerLoading}
              <span class="picker-status">Loading…</span>
            {:else if fsgAvatarPickerError}
              <span class="picker-status picker-err">{fsgAvatarPickerError}</span>
            {:else}
              {#each fsgAvatarPickerImages as img (img.name)}
                <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
                <div class="picker-thumb" class:selected={fsgAvatarUrl === img.download_url} on:click={() => selectFsgAvatar(img)}>
                  <img src={img.download_url} alt={img.name} loading="lazy" style="aspect-ratio:1;object-position:50% 20%" />
                  <span class="picker-name">{img.name}</span>
                </div>
              {/each}
            {/if}
          </div>
        {/if}

        <!-- Caption / tags / location / likes -->
        <textarea placeholder="Caption…" bind:value={fsgCaption} rows="3" style="margin-top:10px"></textarea>
        <input type="text" class="email-subject-input" style="margin-top:8px" placeholder="#hashtags (optional)…" bind:value={fsgTags} />
        <input type="text" class="email-subject-input" placeholder="Location tag (optional)…" bind:value={fsgLocation} />
        <input type="number" class="email-subject-input" placeholder="Starting like count (optional, e.g. 42)…" bind:value={fsgLikes} />

        <!-- Top comment -->
        <div class="section-label" style="margin-top:16px;margin-bottom:8px">Top Comment (optional)</div>
        <input type="text" class="email-subject-input" placeholder="Commenter username…" bind:value={fsgTopCommentUser} />
        <input type="text" class="email-subject-input" placeholder="Comment text…" bind:value={fsgTopCommentText} />
        <input type="number" class="email-subject-input" placeholder="Comment likes (optional, e.g. 312)…" bind:value={fsgTopCommentLikes} />

        <div style="height:12px"></div>
        <button class="primary fsg-post-btn" disabled={fsgPosting || !fsgUsername.trim() || !fsgHandle.trim() || !fsgImageUrl.trim()} on:click={postToFatestagram}>
          {fsgPosting ? 'Staging…' : 'Stage Post (hidden from players)'}
        </button>
        <div class="status-line" class:ok={fsgStatus.type === 'ok'} class:err={fsgStatus.type === 'err'}>
          {fsgStatus.text}
        </div>
      </div>

      <!-- Staged posts -->
      <div class="section">
        <div class="section-label-row">
          <div class="section-label" style="margin-bottom:0">Staged — awaiting deploy ({stagedFsgPosts.length})</div>
          <button class="ghost-btn" on:click={loadFsgPosts}>Refresh</button>
        </div>
        <div class="log">
          {#if !stagedFsgPosts.length}
            <div class="log-empty">No staged posts.</div>
          {:else}
            {#each stagedFsgPosts as p (p._id)}
              <div class="fsg-log-row">
                {#if p.imageUrl}
                  <img class="fsg-log-thumb" src={p.imageUrl} alt="" loading="lazy" />
                {/if}
                <div class="fsg-log-info">
                  <span class="fsg-log-user">{p.username ?? '—'}</span>
                  {#if p.caption}
                    <span class="fsg-log-caption">{p.caption.slice(0, 60)}{p.caption.length > 60 ? '…' : ''}</span>
                  {/if}
                  <span class="log-time">{relTime(p.ts)}</span>
                </div>
                <div class="fsg-log-actions">
                  <button class="deploy-btn" disabled={deployingFsgId === p._id} on:click={() => deployFsgPost(p._id)}>
                    {deployingFsgId === p._id ? '…' : 'Deploy'}
                  </button>
                  <button class="danger-btn" on:click={() => deleteFsgPost(p._id)}>Delete</button>
                </div>
              </div>
            {/each}
          {/if}
        </div>
      </div>

      <!-- Live posts -->
      <div class="section">
        <div class="section-label-row">
          <div class="section-label" style="margin-bottom:0">Live — on player devices ({liveFsgPosts.length})</div>
        </div>
        <div class="log">
          {#if !liveFsgPosts.length}
            <div class="log-empty">No live posts.</div>
          {:else}
            {#each liveFsgPosts as p (p._id)}
              <div class="fsg-log-row">
                {#if p.imageUrl}
                  <img class="fsg-log-thumb" src={p.imageUrl} alt="" loading="lazy" />
                {/if}
                <div class="fsg-log-info">
                  <span class="fsg-log-user">{p.username ?? '—'}</span>
                  {#if p.caption}
                    <span class="fsg-log-caption">{p.caption.slice(0, 60)}{p.caption.length > 60 ? '…' : ''}</span>
                  {/if}
                  <span class="log-time">{relTime(p.ts)}</span>
                </div>
                <div class="fsg-log-actions">
                  <button class="ghost-btn" disabled={recallingFsgId === p._id} on:click={() => recallFsgPost(p._id)}>
                    {recallingFsgId === p._id ? '…' : 'Recall'}
                  </button>
                  <button class="danger-btn" on:click={() => deleteFsgPost(p._id)}>Delete</button>
                </div>
              </div>
            {/each}
          {/if}
        </div>
      </div>

    {/if}

    <!-- ══ TIMER ══════════════════════════════════════════════════════════════ -->
    {#if activeTab === 'timer'}

      <p class="tab-sub">Set and broadcast a countdown timer to all player devices.</p>

      <div class="section">
        <div class="section-label">Quick Add</div>
        <div class="timer-quick-row">
          <button class="timer-add-btn" on:click={() => timerDuration += 60}>+1m</button>
          <button class="timer-add-btn" on:click={() => timerDuration += 180}>+3m</button>
          <button class="timer-add-btn" on:click={() => timerDuration += 300}>+5m</button>
          <button class="timer-add-btn" on:click={() => timerDuration += 600}>+10m</button>
          <button class="timer-clear-btn" on:click={() => { timerDuration = 0; timerSendStatus = null; }}>Clear</button>
        </div>
        <div class="timer-duration-preview">{timerSelectedDisplay}</div>
        <button class="primary" style="margin-top:12px;width:100%" disabled={!timerDuration || timerSending} on:click={sendCountdown}>
          {timerSending ? 'Starting…' : 'Send Countdown'}
        </button>
        {#if timerSendStatus}
          <div class="status-line" class:ok={timerSendStatus.type === 'ok'} class:err={timerSendStatus.type === 'err'}>
            {timerSendStatus.text}
          </div>
        {/if}
      </div>

      {#if timerActiveEndsAt}
        <div class="section">
          <div class="section-label">Active Countdown</div>
          <div class="timer-active-block">
            <span class="timer-active-str" class:timer-expired={timerDisplayStr === 'EXPIRED'}>{timerDisplayStr || '—'}</span>
            <div class="timer-active-actions">
              <button class="timer-add-btn" on:click={() => addTime(10)}>+10s</button>
              <button class="timer-add-btn" on:click={() => addTime(30)}>+30s</button>
              <button class="timer-add-btn" class:timer-split-active={splitStartedAt} on:click={toggleSplit}>
                {splitStartedAt ? splitElapsedStr || '0:00' : 'Split'}
              </button>
              <button class="danger-btn" on:click={stopTimer}>Stop</button>
            </div>
          </div>
        </div>
      {/if}

    {/if}

    <!-- ══ HOUSEKIT ══════════════════════════════════════════════════════════ -->
    {#if activeTab === 'housekit'}

      <p class="tab-sub">Manage safe houses and properties. Properties appear in the HouseKit app on player devices.</p>

      <!-- ── Property list ─────────────────────────────────────────────────── -->
      <div class="section">
        <div class="section-label-row">
          <div class="section-label" style="margin-bottom:0">Properties ({hkProperties.length})</div>
          <button class="ghost-btn" on:click={refreshHkProperties}>Refresh</button>
        </div>

        {#if !hkProperties.length}
          <div class="log-empty" style="margin-top:8px">No properties yet. Create one below.</div>
        {:else}
          <div class="hk-prop-list">
            {#each hkProperties as p (p._id)}
              <div class="hk-prop-item" class:hk-prop-item--editing={hkEditing === p._id}>
                <div class="hk-prop-item-info">
                  <span class="hk-prop-item-name">{p.name}</span>
                  {#if p.location}<span class="hk-prop-item-loc">{p.location}</span>{/if}
                </div>
                <div class="hk-prop-item-actions">
                  <button class="ghost-btn" on:click={() => hkStartEdit(p)}>Edit</button>
                  <button class="danger-btn" on:click={() => hkDeleteProperty(p._id)}>Delete</button>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>

      <!-- ── Create / Edit form ─────────────────────────────────────────────── -->
      <div class="section">
        <div class="section-label-row">
          <div class="section-label" style="margin-bottom:0">
            {hkEditing ? 'Edit Property' : 'New Property'}
          </div>
          {#if hkEditing}
            <button class="ghost-btn" on:click={hkCancelEdit}>Cancel</button>
          {/if}
        </div>

        <div class="form-row">
          <label class="form-label">Name</label>
          <input class="form-input" type="text" placeholder="e.g. The Neon Loft" bind:value={hkFormName} />
        </div>
        <div class="form-row">
          <label class="form-label">Location</label>
          <input class="form-input" type="text" placeholder="e.g. 4th District — Midtown" bind:value={hkFormLocation} />
        </div>
        <div class="form-row">
          <label class="form-label">Cost</label>
          <input class="form-input" type="text" placeholder="e.g. 45,000 plat" bind:value={hkFormCost} />
        </div>
        <div class="form-row">
          <label class="form-label">Owner</label>
          <input class="form-input" type="text" placeholder="Codename or NPC name" bind:value={hkFormOwner} />
        </div>

        <div class="hk-form-pair">
          <div class="form-row" style="flex:1">
            <label class="form-label">Rooms</label>
            <input class="form-input" type="number" min="1" placeholder="0" bind:value={hkFormRooms} />
          </div>
          <div class="form-row" style="flex:1">
            <label class="form-label">Tiles</label>
            <input class="form-input" type="number" min="1" placeholder="0" bind:value={hkFormTiles} />
          </div>
        </div>

        <!-- Image picker -->
        <div class="form-row">
          <label class="form-label">Image</label>
          <div class="img-picker-row">
            <span class="img-selected">{hkFormImage || 'None'}</span>
            <button class="picker-btn" type="button" on:click={hkToggleImgPicker}>
              {hkImgPickerOpen ? 'Close' : 'Pick'}
            </button>
          </div>
        </div>
        {#if hkImgPickerOpen}
          <div class="img-picker-grid">
            {#if hkImgPickerLoading}
              <span class="picker-status">Loading…</span>
            {:else if hkImgPickerError}
              <span class="picker-status picker-err">{hkImgPickerError}</span>
            {:else}
              {#each hkImgPickerImages as img (img.name)}
                <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
                <div class="picker-thumb" class:selected={hkFormImage === img.name}
                  on:click={() => { hkFormImage = img.name; hkImgPickerOpen = false; }}>
                  <img src={img.download_url} alt={img.name} loading="lazy" />
                  <span class="picker-name">{img.name}</span>
                </div>
              {/each}
            {/if}
          </div>
        {/if}

        <!-- Floor plan grid editor -->
        <div class="section-label" style="margin-top:14px;margin-bottom:6px">Floor Plan</div>
        <div class="hk-grid-size-row">
          <label class="hk-size-label">Cols
            <input class="form-input hk-size-input" type="number" min="4" max="16" bind:value={hkGridCols} on:change={hkResizeGrid} />
          </label>
          <label class="hk-size-label">Rows
            <input class="form-input hk-size-input" type="number" min="3" max="12" bind:value={hkGridRows} on:change={hkResizeGrid} />
          </label>
          <button class="ghost-btn" type="button" on:click={hkClearGrid}>Clear</button>
        </div>

        <div class="hk-editor-wrap">
          <div class="hk-editor-grid" style="grid-template-columns: repeat({hkGridCols}, 34px)">
            {#each Array(hkGridRows * hkGridCols) as _, idx}
              {@const r = Math.floor(idx / hkGridCols)}
              {@const c = idx % hkGridCols}
              {@const key = `${r},${c}`}
              {@const cellType = hkGridCells[key]}
              {@const walls = hkGridWalls[key] || []}
              {@const selected = hkSelectedCell === key}
              <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
              <div
                class="hk-editor-cell"
                class:hk-ec-filled={cellType === 'filled'}
                class:hk-ec-entrance={cellType === 'entrance'}
                class:hk-ec-selected={selected}
                style="
                  {walls.includes('top')    ? 'border-top:2px solid #b22;'    : ''}
                  {walls.includes('right')  ? 'border-right:2px solid #b22;'  : ''}
                  {walls.includes('bottom') ? 'border-bottom:2px solid #b22;' : ''}
                  {walls.includes('left')   ? 'border-left:2px solid #b22;'   : ''}
                "
                on:click={() => hkCellClick(r, c)}
                on:contextmenu|preventDefault={() => hkCellRightClick(r, c)}
              ></div>
            {/each}
          </div>

          {#if hkSelectedCell && hkGridCells[hkSelectedCell]}
            <div class="hk-wall-panel">
              <div class="hk-wall-label">Walls</div>
              {#each ['top','right','bottom','left'] as side}
                <button
                  class="hk-wall-btn"
                  class:hk-wall-btn--on={(hkGridWalls[hkSelectedCell] || []).includes(side)}
                  type="button"
                  on:click={() => hkToggleWall(hkSelectedCell, side)}
                >{side[0].toUpperCase()}</button>
              {/each}
              <div class="hk-wall-hint">selected {hkSelectedCell}</div>
            </div>
          {/if}
        </div>

        <div class="hk-editor-legend">
          <span class="hk-el-room"></span>Room (click)
          <span class="hk-el-entrance"></span>Entrance (right-click)
          <span class="hk-el-wall"></span>Wall (select → T/R/B/L)
        </div>

        <!-- Access list -->
        <div class="section-label" style="margin-top:14px;margin-bottom:6px">Access List</div>

        {#if hkFormAccess.length}
          <div class="hk-access-chips">
            {#each hkFormAccess as name}
              <div class="hk-access-chip">
                <span>{name}</span>
                <button class="hk-chip-remove" type="button" on:click={() => hkRemoveAccess(name)}>✕</button>
              </div>
            {/each}
          </div>
        {:else}
          <div style="font-size:11px;color:rgba(232,223,200,0.3);margin-bottom:8px">No one added yet.</div>
        {/if}

        <!-- Person picker toggle -->
        <button class="ghost-btn" style="margin-bottom:8px" type="button"
          on:click={() => { hkPickerOpen = !hkPickerOpen; if (hkPickerOpen) hkLoadPeople(); }}>
          {hkPickerOpen ? 'Close picker' : '+ Add person'}
        </button>

        {#if hkPickerOpen}
          <div class="hk-person-picker">
            {#if !hkPeopleList.length}
              <div style="font-size:11px;color:rgba(232,223,200,0.3);padding:8px">
                No more names available. Add contacts or have players register.
              </div>
            {:else}
              {#each hkPeopleList as name}
                <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
                <div class="hk-person-option" on:click={() => hkAddAccess(name)}>{name}</div>
              {/each}
            {/if}
          </div>
        {/if}

        <button class="primary" style="margin-top:10px;width:100%"
          disabled={hkSaving || !hkFormName.trim()}
          on:click={hkSaveProperty}>
          {hkSaving ? 'Saving…' : hkEditing ? 'Save Changes' : 'Create Property'}
        </button>
        <div class="status-line" class:ok={hkStatus.type === 'ok'} class:err={hkStatus.type === 'err'}>
          {hkStatus.text}
        </div>
      </div>

    {/if}

    <!-- ══ DOWNTIME ═════════════════════════════════════════════════════════ -->
    {#if activeTab === 'downtime'}

      <p class="tab-sub">Manage downtime periods. Open a period to let players submit their actions, then add narrative after they resolve.</p>

      {#if dtOpenStatus.text}
        <div class="status-line" class:ok={dtOpenStatus.type === 'ok'} class:err={dtOpenStatus.type === 'err'} style="margin-bottom:16px">
          {dtOpenStatus.text}
        </div>
      {/if}

      {#if !dtActive?.enabled}
        <!-- ── Open downtime form ────────────────────────────────────────── -->
        <div class="section">
          <div class="section-label">Open Downtime Period</div>
          <div class="dt-period-row">
            <div class="form-row" style="flex:1;margin-bottom:0">
              <label class="form-label">From</label>
              <input class="form-input" type="text" placeholder="e.g. Feb 3" bind:value={dtPeriodFrom} />
            </div>
            <div class="dt-period-arrow">→</div>
            <div class="form-row" style="flex:1;margin-bottom:0">
              <label class="form-label">To</label>
              <input class="form-input" type="text" placeholder="e.g. Feb 8" bind:value={dtPeriodTo} />
            </div>
          </div>
          <button class="primary" style="margin-top:14px;width:100%" on:click={openDowntime}>
            Open Downtime Period
          </button>
        </div>

      {:else}
        <!-- ── Active downtime ───────────────────────────────────────────── -->
        <div class="dt-active-header">
          <div>
            <div class="dt-active-label">ACTIVE PERIOD</div>
            <div class="dt-active-dates">{dtActive.period?.from ?? '?'} → {dtActive.period?.to ?? '?'}</div>
            <div class="dt-active-index">Session #{dtActive.index}</div>
          </div>
          <button class="danger-btn" on:click={closeDowntime}>Close Downtime</button>
        </div>

        <div class="section-label" style="margin-top:22px">Character Status</div>

        {#each dtCharStatus as { char, completed, result }}
          <div class="dt-char-block">
            <div class="dt-char-header">
              <div>
                <span class="dt-char-name">{char.name}</span>
                <span class="dt-char-role">{char.role}</span>
              </div>
              <span class="dt-status-chip" class:dt-status-chip--done={completed}>
                {completed ? 'COMPLETED' : 'PENDING'}
              </span>
            </div>

            {#if completed && result?.actions?.length}
              <div class="dt-actions-review">
                {#each result.actions as action, i}
                  {@const saveKey = `${char.codename}_${i}`}
                  <div class="dt-action-row">
                    <div class="dt-action-meta">
                      <span class="dt-action-label">{action.label}</span>
                      <span class="dt-type-chip dt-type-{action.type?.toLowerCase()}">{action.type}</span>
                      {#if action.roll != null}
                        <span class="dt-roll-chip">{action.roll}</span>
                      {/if}
                      <span class="dt-level-chip dt-level-{action.level}">{action.level?.toUpperCase()}</span>
                    </div>
                    {#if Object.keys(action.deltas ?? {}).length > 0}
                      <div class="dt-delta-row">
                        {#each Object.entries(action.deltas) as [k, v]}
                          <span class="dt-delta" class:negative={v < 0}>{formatDelta(char.codename, k, v)}</span>
                        {/each}
                      </div>
                    {/if}
                    <div class="dt-narrative-row">
                      <textarea
                        class="dt-narrative"
                        rows="2"
                        placeholder="Add narrative text…"
                        value={action.text || ''}
                        on:blur={e => saveDtNarrative(char.codename, i, e.currentTarget.value)}
                      ></textarea>
                      {#if dtNarrativeSaveStates[saveKey] === 'saving'}
                        <span class="dt-save-state">saving…</span>
                      {:else if dtNarrativeSaveStates[saveKey] === 'saved'}
                        <span class="dt-save-state dt-save-state--ok">saved</span>
                      {:else if dtNarrativeSaveStates[saveKey] === 'error'}
                        <span class="dt-save-state dt-save-state--err">error</span>
                      {/if}
                    </div>
                  </div>
                {/each}
              </div>
            {/if}
          </div>
        {/each}

      {/if}

      <!-- ── Session History ───────────────────────────────────────────────── -->
      {#if dtAllSessions.length > 0}
        <div class="section-label" style="margin-top:28px">Session History</div>
        {#each dtAllSessions as session}
          {@const isExpanded = dtHistoryExpanded[session.index]}
          <div class="dt-hist-entry">
            <div class="dt-hist-header" on:click={() => dtHistoryExpanded = { ...dtHistoryExpanded, [session.index]: !isExpanded }} role="button" tabindex="0" on:keydown={e => e.key === 'Enter' && (dtHistoryExpanded = { ...dtHistoryExpanded, [session.index]: !isExpanded })}>
              <div>
                <span class="dt-hist-period">{session.period?.from ?? '?'} → {session.period?.to ?? '?'}</span>
                <span class="dt-hist-index">Session #{session.index}</span>
              </div>
              <div style="display:flex;align-items:center;gap:8px">
                <span class="dt-hist-count">{Object.keys(session.completedBy).length}/{Object.keys(CHARACTERS).length} submitted</span>
                <button class="danger-btn dt-hist-delete" on:click|stopPropagation={() => deleteSession(session.index)}>Delete</button>
                <span class="dt-hist-chevron" class:expanded={isExpanded}>›</span>
              </div>
            </div>
            {#if isExpanded}
              <div class="dt-hist-body">
                {#each Object.values(CHARACTERS) as char}
                  {@const result = session.results?.[char.codename]}
                  {#if result}
                    <div class="dt-hist-char">
                      <div class="dt-hist-char-name">{char.name} <span class="dt-char-role">{char.role}</span></div>
                      {#each result.actions as action, ai}
                        {@const pKey = `${session.index}_${char.codename}_${ai}`}
                        <div class="dt-action-row">
                          <div class="dt-action-meta">
                            <span class="dt-action-label">{action.label}</span>
                            <span class="dt-type-chip dt-type-{action.type?.toLowerCase()}">{action.type}</span>
                            {#if action.roll != null}
                              <span class="dt-roll-chip">{action.roll}</span>
                            {/if}
                            <span class="dt-level-chip dt-level-{action.level}">{action.level?.toUpperCase()}</span>
                          </div>
                          {#if Object.keys(action.deltas ?? {}).length > 0}
                            <div class="dt-delta-row">
                              {#each Object.entries(action.deltas) as [k, v]}
                                <span class="dt-delta" class:negative={v < 0}>{formatDelta(char.codename, k, v)}</span>
                              {/each}
                            </div>
                          {/if}
                          <div class="dt-narrative-row">
                            <textarea
                              class="dt-narrative"
                              rows="2"
                              placeholder="Add narrative text…"
                              value={action.text || ''}
                              on:blur={e => savePastNarrative(session.index, char.codename, ai, e.currentTarget.value)}
                            ></textarea>
                            {#if dtPastNarrativeStates[pKey] === 'saving'}
                              <span class="dt-save-state">saving…</span>
                            {:else if dtPastNarrativeStates[pKey] === 'saved'}
                              <span class="dt-save-state dt-save-state--ok">saved</span>
                            {:else if dtPastNarrativeStates[pKey] === 'error'}
                              <span class="dt-save-state dt-save-state--err">error</span>
                            {/if}
                          </div>
                        </div>
                      {/each}
                    </div>
                  {/if}
                {/each}
                {#if Object.keys(session.completedBy).length === 0}
                  <p class="dt-hist-empty">No submissions for this session.</p>
                {/if}
              </div>
            {/if}
          </div>
        {/each}
      {/if}

    {/if}

  </div><!-- /tab-panel -->
</div><!-- /console -->

<style>
  .console {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
    max-width: 1400px;
    margin: 0 auto;
    color: #e8dfc8;
    font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif;
    width: 100%;
  }

  /* ── Console header ── */
  .console-header {
    flex-shrink: 0;
    display: flex;
    align-items: baseline;
    gap: 10px;
    padding: 14px 16px 0;
  }
  .console-title {
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: #c9a227;
  }
  .console-sub {
    font-size: 10px;
    color: #3a4a5a;
    letter-spacing: 0.5px;
  }

  /* ── Tab bar ── */
  .tab-bar {
    flex-shrink: 0;
    display: flex;
    gap: 2px;
    padding: 10px 16px 0;
    border-bottom: 1px solid #1a2030;
  }
  .tab {
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    color: #3a4a5a;
    font-size: 11.5px;
    font-weight: 600;
    letter-spacing: 0.8px;
    text-transform: uppercase;
    padding: 6px 10px 8px;
    cursor: pointer;
    transition: color 0.15s ease, border-color 0.15s ease;
    white-space: nowrap;
    font-family: inherit;
  }
  .tab:hover { color: #c9a227; }
  .tab.active { color: #c9a227; border-bottom-color: #c9a227; }
  .tab--once { color: #4a3070; }
  .tab--once:hover { color: #9b6dff; }
  .tab--once.active { color: #9b6dff; border-bottom-color: #7c3aed; }
  .tab--fsg { color: #7a4520; }
  .tab--fsg:hover { color: #e05a3a; }
  .tab--fsg.active { color: #e05a3a; border-bottom-color: #c9a227; }

  /* ── Tab panel (the scrollable area) ── */
  .tab-panel {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 24px 28px 60px;
    scrollbar-width: thin;
    scrollbar-color: rgba(201, 162, 39, 0.2) transparent;
  }

  /* ── Two-column layout for compose + queue tabs ── */
  .two-col {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 32px;
    align-items: start;
  }
  .col-form, .col-list { min-width: 0; }
  @media (max-width: 860px) {
    .two-col { grid-template-columns: 1fr; gap: 0; }
  }

  .tab-sub { font-size: 11px; color: #3a4a5a; letter-spacing: 0.5px; margin: 0 0 20px; }

  .section { margin-bottom: 26px; }
  .section-label { font-size: 10.5px; font-weight: 600; letter-spacing: 1.5px; text-transform: uppercase; color: #6a7d90; margin-bottom: 10px; }
  .section-label-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }

  .chip-grid { display: flex; flex-wrap: wrap; gap: 8px; }
  .chip {
    border: 1px solid; border-radius: 20px; padding: 5px 14px 5px 6px;
    font-size: 12.5px; font-weight: 600; cursor: pointer; background: transparent;
    transition: background 0.15s ease, transform 0.1s ease;
    user-select: none; display: inline-flex; align-items: center; gap: 7px;
  }
  .chip:active { transform: scale(0.96); }
  .chip-avatar { width: 22px; height: 22px; border-radius: 50%; object-fit: cover; object-position: 50% 20%; border: 1px solid rgba(255,255,255,0.15); flex-shrink: 0; }
  .chip.selected { box-shadow: inset 0 0 0 1px currentColor; }
  .chip-label { display: flex; flex-direction: column; align-items: flex-start; gap: 1px; }
  .chip-number { font-family: 'Courier New', monospace; font-size: 8px; letter-spacing: 0.3px; opacity: 0.55; }

  textarea {
    width: 100%; min-height: 70px; background: #0c0f16;
    border: 1px solid #1a2030; border-radius: 8px; color: #e8dfc8;
    font-family: inherit; font-size: 13.5px; padding: 10px 12px; resize: vertical; outline: none;
  }
  textarea:focus { border-color: #c9a227; }
  textarea::placeholder { color: #3a4a5a; }

  .selected-line { font-size: 11.5px; color: #6a7d90; margin: 8px 0 10px; min-height: 16px; }
  .selected-line :global(strong) { font-weight: 600; }

  button.primary {
    background: #c9a227; color: #15130f; border: none; border-radius: 8px;
    padding: 11px 18px; font-size: 13px; font-weight: 700; letter-spacing: 0.3px; cursor: pointer; width: 100%;
  }
  button.primary:active { transform: scale(0.98); }
  button.primary:disabled { background: #2a2a26; color: #5a5650; cursor: not-allowed; }

  .ghost-btn {
    background: none; border: 1px solid #3a4a5a; color: #6a7d90; border-radius: 6px;
    padding: 4px 10px; font-size: 10.5px; letter-spacing: 0.5px; text-transform: uppercase; cursor: pointer;
  }
  .ghost-btn:hover { border-color: #6a7d90; color: #c9a227; }

  .attach-row { display: flex; align-items: center; gap: 10px; margin-top: 8px; flex-wrap: wrap; }
  .attached-preview { display: flex; align-items: center; gap: 8px; background: #0c0f16; border: 1px solid #1a2030; border-radius: 8px; padding: 4px 8px 4px 4px; font-size: 11.5px; color: #6a7d90; }
  .attached-preview img { width: 28px; height: 28px; border-radius: 5px; object-fit: cover; }
  .attached-preview button { background: none; border: none; color: #6a7d90; font-size: 15px; cursor: pointer; line-height: 1; padding: 0 2px; }
  .attached-preview button:hover { color: #e24b4a; }

  .image-picker { margin-top: 10px; background: #0c0f16; border: 1px solid #1a2030; border-radius: 8px; padding: 10px; display: grid; grid-template-columns: repeat(auto-fill, minmax(72px, 1fr)); gap: 8px; max-height: 220px; overflow-y: auto; }
  .img-thumb { cursor: pointer; border-radius: 6px; overflow: hidden; aspect-ratio: 1; border: 1px solid #1a2030; transition: border-color 0.15s ease; }
  .img-thumb:hover { border-color: #c9a227; }
  .img-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .img-picker-status { grid-column: 1/-1; font-size: 12px; font-style: italic; color: #3a4a5a; text-align: center; padding: 10px 0; }
  .img-picker-status.err { color: #e24b4a; font-style: normal; }

  .log { background: #0c0f16; border: 1px solid #1a2030; border-radius: 8px; padding: 12px 14px; max-height: 520px; overflow-y: auto; }
  .log-empty { font-size: 12px; font-style: italic; color: #3a4a5a; text-align: center; padding: 10px 0; }
  .log-row { display: flex; gap: 8px; margin-bottom: 10px; font-size: 12.5px; line-height: 1.5; }
  .log-row:last-child { margin-bottom: 0; }
  .log-name { font-weight: 700; flex-shrink: 0; }
  .log-text { color: rgba(232,223,200,0.85); white-space: pre-line; }
  .log-time { color: #3a4a5a; font-size: 10px; margin-left: 6px; }

  .status-line { font-size: 11px; color: #6a7d90; margin-top: 8px; min-height: 14px; }
  .status-line.ok { color: #639922; }
  .status-line.err { color: #e24b4a; }

  /* ── Email / data packet section ── */
  .type-picker { display: flex; gap: 4px; margin-bottom: 4px; }
  .type-btn {
    flex: 1; background: #0d1118; border: 1px solid #1a2030; border-radius: 6px;
    color: #6a7d90; font-size: 11px; font-weight: 600; letter-spacing: 0.5px;
    padding: 6px 4px; cursor: pointer; transition: all 0.15s ease;
  }
  .type-btn:hover { border-color: #c9a227; color: #c9a227; }
  .type-btn.active { background: rgba(201,162,39,0.1); border-color: rgba(201,162,39,0.5); color: #c9a227; }

  .email-meta-row { display: flex; gap: 8px; margin-bottom: 12px; }

  .block-format-row { display: flex; align-items: center; gap: 6px; margin-top: 6px; padding-top: 6px; border-top: 1px solid rgba(255,255,255,0.05); }
  .format-group { display: flex; align-items: center; gap: 3px; }
  .fmt-btn {
    background: #0d1118; border: 1px solid #1a2030; border-radius: 4px;
    color: #6a7d90; font-size: 11px; font-weight: 600; padding: 3px 7px;
    cursor: pointer; line-height: 1.4; transition: all 0.12s ease;
  }
  .fmt-btn:hover { border-color: #c9a227; color: #c9a227; }
  .fmt-btn.active { background: rgba(201,162,39,0.1); border-color: rgba(201,162,39,0.5); color: #c9a227; }
  .fmt-bold { font-weight: 800; font-style: normal; }

  .packet-type-badge {
    font-size: 8px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase;
    padding: 1px 5px; border-radius: 2px; margin-right: 4px;
    color: #fbbf24; background: rgba(251,191,36,0.08); border: 1px solid rgba(251,191,36,0.25);
    vertical-align: middle;
  }

  .reply-block { background: #0c0f16; border: 1px solid #1a2030; border-radius: 8px; padding: 12px; margin-bottom: 8px; }
  .reply-block-header { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
  .reply-from-input {
    flex: 1; background: #0d1118; border: 1px solid #1a2030; border-radius: 6px;
    color: #e8dfc8; font-family: inherit; font-size: 13px; padding: 7px 10px; outline: none;
  }
  .reply-from-input:focus { border-color: #c9a227; }
  .reply-from-input::placeholder { color: #3a4a5a; }
  .reply-body-input {
    width: 100%; min-height: 64px; background: #0d1118; border: 1px solid #1a2030;
    border-radius: 6px; color: #e8dfc8; font-family: 'Courier New', Courier, monospace;
    font-size: 12.5px; padding: 8px 10px; resize: vertical; outline: none;
  }
  .reply-body-input:focus { border-color: #c9a227; }
  .reply-body-input::placeholder { color: #3a4a5a; }
  .remove-reply-btn { background: none; border: 1px solid rgba(226,75,74,0.35); color: #e24b4a; border-radius: 5px; padding: 4px 9px; font-size: 13px; line-height: 1; cursor: pointer; flex-shrink: 0; }
  .remove-reply-btn:hover { background: rgba(226,75,74,0.1); }

  .reply-attach-row { display: flex; align-items: center; gap: 8px; margin-top: 6px; }
  .reply-attach-preview { display: flex; align-items: center; gap: 6px; }
  .reply-attach-name { font-size: 11.5px; color: #c9a227; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .reply-attach-remove { background: none; border: none; color: #6a7d90; font-size: 15px; cursor: pointer; padding: 0 2px; line-height: 1; }
  .reply-attach-remove:hover { color: #e24b4a; }
  .reply-image-picker { margin-top: 8px; background: #0c0f16; border: 1px solid #1a2030; border-radius: 8px; padding: 8px; display: grid; grid-template-columns: repeat(auto-fill, minmax(64px, 1fr)); gap: 6px; max-height: 180px; overflow-y: auto; }

  .email-subject-input { width: 100%; background: #0c0f16; border: 1px solid #1a2030; border-radius: 8px; color: #e8dfc8; font-family: inherit; font-size: 13.5px; padding: 10px 12px; outline: none; margin-bottom: 12px; }
  .email-subject-input:focus { border-color: #c9a227; }
  .email-subject-input::placeholder { color: #3a4a5a; }

  .chain-log-row { padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.05); }
  .chain-log-row:last-child { border-bottom: none; }
  .chain-log-top { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; margin-bottom: 7px; }
  .chain-log-subject { font-size: 13px; font-weight: 600; }
  .chain-log-meta { font-size: 10px; color: #3a4a5a; flex-shrink: 0; }
  .chain-log-actions { display: flex; gap: 6px; }
  .deploy-btn { flex: 1; background: #c9a227; color: #15130f; border: none; border-radius: 6px; padding: 7px 12px; font-size: 12px; font-weight: 700; cursor: pointer; }
  .deploy-btn:active { transform: scale(0.98); }
  .deploy-btn:disabled { background: #2a2a26; color: #5a5650; cursor: not-allowed; }
  .recall-btn { background: none; border: 1px solid #3a4a5a; color: #6a7d90; border-radius: 6px; padding: 7px 12px; font-size: 11px; cursor: pointer; }
  .recall-btn:hover { border-color: #c9a227; color: #c9a227; }
  .recall-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .danger-btn { background: none; border: 1px solid rgba(226,75,74,0.35); color: #e24b4a; border-radius: 6px; padding: 7px 12px; font-size: 11px; cursor: pointer; }
  .danger-btn:hover { background: rgba(226,75,74,0.08); }

  .live-label { color: #4ade80; font-size: 10px; letter-spacing: 1px; font-weight: 700; text-transform: uppercase; }

  .tag-filter-bar { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px; align-items: center; }
  .tag-filter-label { font-size: 10px; color: #3a4a5a; letter-spacing: 0.5px; text-transform: uppercase; }
  .tag-badge {
    display: inline-flex; align-items: center;
    background: rgba(201,162,39,0.1); border: 1px solid rgba(201,162,39,0.3);
    color: #c9a227; border-radius: 12px; padding: 2px 9px;
    font-size: 10px; font-weight: 600; letter-spacing: 0.5px; text-transform: uppercase;
    cursor: pointer; transition: background 0.12s, border-color 0.12s; user-select: none;
  }
  .tag-badge:hover { background: rgba(201,162,39,0.2); border-color: rgba(201,162,39,0.6); }
  .tag-badge.filter-active { background: rgba(201,162,39,0.28); border-color: #c9a227; box-shadow: 0 0 0 1px rgba(201,162,39,0.4); }
  .chain-log-tags { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 6px; }
  .chain-log-tags .tag-badge { cursor: default; }

  /* ── Case Files section ── */
  .case-select {
    width: 100%; background: #0c0f16; border: 1px solid #1a2030; border-radius: 8px;
    color: #e8dfc8; font-family: inherit; font-size: 13.5px; padding: 10px 12px; outline: none; margin-bottom: 12px;
  }
  .case-select:focus { border-color: #c9a227; }
  .case-color-row { display: flex; align-items: center; gap: 10px; margin-top: 14px; }
  .color-swatch {
    width: 40px; height: 28px; padding: 0; border: 1px solid #1a2030; border-radius: 6px;
    background: none; cursor: pointer;
  }
  .case-image-chips { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
  .case-section-badge {
    display: inline-block; font-size: 9.5px; font-weight: 700; letter-spacing: 0.8px; text-transform: uppercase;
    color: #6a7d90; border: 1px solid #3a4a5a; border-radius: 4px; padding: 1px 6px; margin-right: 4px;
  }

  /* ── Current Date section ── */
  .cal-current-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 14px;
    font-size: 12px;
  }
  .cal-current-label {
    color: rgba(232, 223, 200, 0.45);
    letter-spacing: 0.5px;
    flex-shrink: 0;
  }
  .cal-current-val {
    color: #c9a227;
    font-weight: 600;
    letter-spacing: 0.4px;
  }
  .cal-current-none {
    color: rgba(232, 223, 200, 0.3);
    font-style: italic;
  }
  .cal-picker-row {
    display: flex;
    gap: 8px;
    margin-bottom: 14px;
  }
  .cal-select {
    flex: 2;
    background: #0f1520;
    border: 1px solid rgba(201, 162, 39, 0.3);
    border-radius: 4px;
    color: #e8dfc8;
    font-size: 13px;
    padding: 8px 10px;
    font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif;
    appearance: auto;
  }
  .cal-select--day  { flex: 1; }
  .cal-select--year { flex: 1.2; }
  .cal-select:focus {
    outline: none;
    border-color: rgba(201, 162, 39, 0.7);
  }

  /* ── Phone Contacts section ── */
  .contact-form { display: flex; flex-direction: column; gap: 8px; }
  .contact-input {
    width: 100%; background: #0c0f16; border: 1px solid #1a2030; border-radius: 8px;
    color: #e8dfc8; font-family: inherit; font-size: 13.5px; padding: 10px 12px; outline: none;
  }
  .contact-input:focus { border-color: #c9a227; }
  .contact-input::placeholder { color: #3a4a5a; }

  .contact-log-row {
    display: flex; align-items: center; justify-content: space-between; gap: 10px;
    padding: 9px 0; border-bottom: 1px solid rgba(255,255,255,0.05);
  }
  .contact-log-row:last-child { border-bottom: none; }
  .contact-log-info { display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0; }
  .contact-log-avatar { width: 28px; height: 28px; border-radius: 50%; object-fit: cover; flex-shrink: 0; }
  .contact-log-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
  .contact-log-text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .contact-log-name { font-size: 13px; font-weight: 600; color: #e8dfc8; }
  .contact-log-name.dimmed { color: #3a4a5a; }
  .contact-log-meta { font-size: 11px; color: #6a7d90; }
  .contact-log-actions { display: flex; gap: 6px; flex-shrink: 0; }
  .contact-edit-block {
    padding: 12px 0;
    border-bottom: 1px solid rgba(255,255,255,0.05);
  }
  .contact-edit-block:last-child { border-bottom: none; }
  .contact-edit-actions { display: flex; gap: 8px; align-items: center; }
  .toggle-btn {
    background: none; border: 1px solid #3a4a5a; color: #6a7d90;
    border-radius: 6px; padding: 5px 10px; font-size: 11px; cursor: pointer;
    transition: border-color 0.15s ease, color 0.15s ease;
  }
  .toggle-btn.on { border-color: #34c759; color: #34c759; }
  .toggle-btn:hover { border-color: #c9a227; color: #c9a227; }

  /* ── O.N.C.E. section ── */
  .once-section-label { color: #6b4fa0 !important; }
  .once-textarea {
    width: 100%; min-height: 80px; background: #0c0f16;
    border: 1px solid rgba(124, 58, 237, 0.35); border-radius: 8px; color: #e8dfc8;
    font-family: inherit; font-size: 13.5px; padding: 10px 12px; resize: vertical; outline: none;
  }
  .once-textarea:focus { border-color: #7c3aed; }
  .once-textarea::placeholder { color: #3a4a5a; }
  .once-send-btn {
    background: linear-gradient(135deg, rgba(124, 58, 237, 0.22), rgba(124, 58, 237, 0.1));
    color: #c4a8ff;
    border: 1px solid rgba(124, 58, 237, 0.55);
    border-radius: 8px;
    padding: 11px 18px;
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.8px;
    text-transform: uppercase;
    cursor: pointer;
    width: 100%;
    transition: background 0.15s ease;
  }
  .once-send-btn:hover:not(:disabled) { background: rgba(124, 58, 237, 0.28); }
  .once-send-btn:active:not(:disabled) { transform: scale(0.98); }
  .once-send-btn:disabled { opacity: 0.35; cursor: not-allowed; }
  .once-log-row {
    display: flex; align-items: flex-start; gap: 8px;
    margin-bottom: 10px; font-size: 12.5px; line-height: 1.5;
  }
  .once-log-row:last-child { margin-bottom: 0; }
  .once-log-m { font-weight: 700; color: #9b6dff; flex-shrink: 0; }
  .once-delete-btn { margin-left: auto; flex-shrink: 0; padding: 3px 8px; font-size: 14px; line-height: 1; }

  /* ── Jobs section ── */
  .job-status-group { display: flex; gap: 6px; flex-wrap: wrap; }
  .job-status-btn {
    background: none;
    border: 1px solid rgba(255,255,255,0.1);
    color: rgba(232,223,200,0.35);
    border-radius: 6px;
    padding: 5px 11px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.3px;
    cursor: pointer;
    transition: border-color 0.15s ease, color 0.15s ease, background 0.15s ease;
    font-family: inherit;
  }
  .job-status-btn:hover { border-color: var(--sc); color: var(--sc); }
  .job-status-btn.active { border-color: var(--sc); color: var(--sc); background: color-mix(in srgb, var(--sc) 12%, transparent); }
  .job-status-group.small .job-status-btn { padding: 4px 9px; font-size: 10.5px; }

  .job-item {
    background: #0c0f16;
    border: 1px solid #1a2030;
    border-radius: 8px;
    padding: 12px 14px;
    margin-bottom: 10px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .job-item-head { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
  .job-item-no { font-family: 'Courier New', monospace; font-size: 9.5px; letter-spacing: 1px; color: #3a4a5a; flex-shrink: 0; }
  .job-item-title { font-size: 13px; font-weight: 700; letter-spacing: 0.5px; color: #c9a227; flex: 1; min-width: 0; }
  .job-item-badge { font-size: 10px; font-weight: 600; letter-spacing: 0.5px; flex-shrink: 0; }
  .job-item-brief { font-size: 11.5px; color: #6a7d90; line-height: 1.5; }
  .job-item-steps { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 4px; }
  .job-item-steps li { font-size: 11.5px; color: rgba(232,223,200,0.6); padding-left: 14px; position: relative; line-height: 1.45; }
  .job-item-steps li::before { content: '—'; position: absolute; left: 0; color: #3a4a5a; }
  .job-item-controls { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
  .job-step-input {
    flex: 1;
    background: #0d1118;
    border: 1px solid #1a2030;
    border-radius: 6px;
    color: #e8dfc8;
    font-family: inherit;
    font-size: 12.5px;
    padding: 7px 10px;
    outline: none;
  }
  .job-step-input:focus { border-color: #c9a227; }
  .job-step-input::placeholder { color: #3a4a5a; }
  .job-date-input {
    width: 108px;
    flex-shrink: 0;
    background: #0d1118;
    border: 1px solid #1a2030;
    border-radius: 6px;
    color: #e8dfc8;
    font-family: 'Courier New', monospace;
    font-size: 11px;
    padding: 7px 8px;
    outline: none;
    letter-spacing: 0.5px;
  }
  .job-date-input:focus { border-color: #c9a227; }
  .job-date-input::placeholder { color: #3a4a5a; }
  .job-item-actions { display: flex; justify-content: space-between; align-items: center; gap: 8px; padding-top: 4px; border-top: 1px solid rgba(255,255,255,0.04); }

  /* ── Rides builder ──────────────────────────────────────────────────────── */
  .rides-builder {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .stats-grid { display: flex; flex-direction: column; gap: 10px; }

  .form-row { display: flex; align-items: center; gap: 10px; }
  .form-label {
    width: 104px;
    flex-shrink: 0;
    font-family: 'Courier New', monospace;
    font-size: 10px;
    letter-spacing: 1.2px;
    text-transform: uppercase;
    color: #6a7d90;
  }
  .form-input {
    flex: 1;
    background: #0d1118;
    border: 1px solid #1a2030;
    border-radius: 6px;
    color: #e8dfc8;
    font-family: inherit;
    font-size: 13px;
    padding: 8px 10px;
    outline: none;
    min-width: 0;
  }
  .form-input:focus { border-color: #c9a227; }
  .form-input::placeholder { color: #3a4a5a; }
  .form-select { cursor: pointer; appearance: auto; }
  .form-select option, .form-select optgroup { background: #0d1118; color: #e8dfc8; }

  .action-btn {
    background: #c9a227;
    color: #15130f;
    border: none;
    border-radius: 8px;
    padding: 11px 18px;
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.3px;
    cursor: pointer;
    width: 100%;
    margin-top: 6px;
    font-family: inherit;
  }
  .action-btn:active { transform: scale(0.98); }
  .action-btn:disabled { background: #2a2a26; color: #5a5650; cursor: not-allowed; }

  .status-msg {
    font-size: 11.5px;
    color: #6a7d90;
    text-align: center;
    padding: 4px 0;
    margin: 0;
  }
  .status-msg.ok { color: #6a9a40; }
  .status-msg.err { color: #c93a27; }

  .img-picker-row {
    display: flex;
    align-items: center;
    gap: 10px;
    flex: 1;
  }
  .img-selected {
    flex: 1;
    font-size: 12px;
    color: rgba(232,223,200,0.5);
    font-family: 'Courier New', monospace;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .picker-btn {
    background: none;
    border: 1px solid rgba(201,162,39,0.3);
    border-radius: 6px;
    color: rgba(201,162,39,0.8);
    font-family: inherit;
    font-size: 11px;
    padding: 5px 12px;
    cursor: pointer;
    white-space: nowrap;
    flex-shrink: 0;
  }
  .picker-btn:hover { border-color: #c9a227; color: #c9a227; }

  .img-picker-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 6px;
    background: #080b10;
    border: 1px solid #1a2030;
    border-radius: 8px;
    padding: 10px;
    max-height: 260px;
    overflow-y: auto;
    scrollbar-width: thin;
  }
  .picker-status {
    grid-column: 1 / -1;
    font-size: 11px;
    color: rgba(232,223,200,0.35);
    text-align: center;
    padding: 16px 0;
  }
  .picker-err { color: rgba(201,62,39,0.7); }

  .picker-thumb {
    display: flex;
    flex-direction: column;
    gap: 4px;
    cursor: pointer;
    border: 2px solid transparent;
    border-radius: 6px;
    overflow: hidden;
    transition: border-color 0.12s;
  }
  .picker-thumb:hover { border-color: rgba(201,162,39,0.5); }
  .picker-thumb.selected { border-color: #c9a227; }
  .picker-thumb img { width: 100%; aspect-ratio: 16/9; object-fit: cover; display: block; background: #111; }
  .picker-name {
    font-size: 8px;
    font-family: 'Courier New', monospace;
    color: rgba(232,223,200,0.3);
    padding: 0 3px 3px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .ride-item {
    background: #0c0f16;
    border: 1px solid #1a2030;
    border-radius: 8px;
    padding: 10px 12px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }
  .ride-item--live { border-color: rgba(201,162,39,0.25); }
  .ride-item-info { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .ride-title {
    font-size: 13px;
    color: #e8dfc8;
    font-weight: 600;
    letter-spacing: 0.3px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .ride-class {
    font-size: 10px;
    font-family: 'Courier New', monospace;
    letter-spacing: 1px;
    text-transform: uppercase;
    color: rgba(201,162,39,0.5);
  }
  .ride-item-actions { display: flex; gap: 8px; flex-shrink: 0; }
  .ride-upgrade-count { color: rgba(201,162,39,0.35); font-size: 9px; }

  /* ── Sender management ── */
  .sender-list { display: flex; flex-direction: column; gap: 4px; margin-bottom: 4px; }
  .sender-list-row {
    display: flex; align-items: center; gap: 8px;
    padding: 6px 10px; background: #0c0f16;
    border: 1px solid #1a2030; border-radius: 6px;
  }
  .sender-list-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
  .sender-list-name { flex: 1; font-size: 12.5px; color: #e8dfc8; }
  .sender-list-empty { font-size: 11px; color: #3a4a5a; font-style: italic; margin: 6px 0 0; }
  .sender-color-row { display: flex; align-items: center; gap: 10px; }
  .sender-color-preview { font-family: 'Courier New', monospace; font-size: 11px; color: #6a7d90; }

  .upgrade-toggle-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(136px, 1fr));
    gap: 5px;
  }
  .upgrade-toggle {
    background: none;
    border: 1px solid #1a2030;
    border-radius: 5px;
    color: rgba(232,223,200,0.3);
    font-family: 'Courier New', monospace;
    font-size: 9.5px;
    letter-spacing: 0.4px;
    padding: 7px 8px;
    cursor: pointer;
    text-align: left;
    line-height: 1.35;
    transition: border-color 0.12s, color 0.12s, background 0.12s;
    font-style: normal;
  }
  .upgrade-toggle:hover { border-color: rgba(201,162,39,0.3); color: rgba(232,223,200,0.6); }
  .upgrade-toggle.active {
    border-color: rgba(201,162,39,0.55);
    color: #c9a227;
    background: rgba(201,162,39,0.08);
  }

  .deploy-btn {
    background: rgba(201,162,39,0.12);
    border: 1px solid rgba(201,162,39,0.4);
    border-radius: 6px;
    color: #c9a227;
    font-family: inherit;
    font-size: 11px;
    font-weight: 600;
    padding: 5px 12px;
    cursor: pointer;
  }
  .deploy-btn:hover:not(:disabled) { background: rgba(201,162,39,0.22); }
  .deploy-btn:disabled { opacity: 0.4; cursor: default; }

  .recall-btn {
    background: rgba(80,140,200,0.12);
    border: 1px solid rgba(80,140,200,0.35);
    border-radius: 6px;
    color: rgba(130,180,230,0.9);
    font-family: inherit;
    font-size: 11px;
    font-weight: 600;
    padding: 5px 12px;
    cursor: pointer;
  }
  .recall-btn:hover:not(:disabled) { background: rgba(80,140,200,0.22); }
  .recall-btn:disabled { opacity: 0.4; cursor: default; }

  /* ── FateStaGram tab ── */
  .fsg-author-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 10px;
  }
  .fsg-author-chip {
    background: rgba(201,162,39,0.07);
    border: 1px solid rgba(201,162,39,0.3);
    border-radius: 20px;
    color: rgba(201,162,39,0.8);
    font-family: inherit;
    font-size: 11px;
    padding: 4px 12px;
    cursor: pointer;
    transition: background 0.12s, border-color 0.12s, color 0.12s;
    white-space: nowrap;
  }
  .fsg-author-chip:hover { background: rgba(201,162,39,0.15); border-color: #c9a227; color: #c9a227; }
  .fsg-author-chip.selected { background: rgba(201,162,39,0.18); border-color: #c9a227; color: #c9a227; }

  .fsg-post-btn {
    background: linear-gradient(90deg, #c9a227, #e05a3a);
    color: #fff;
  }
  .fsg-post-btn:disabled { background: #2a2a26; color: #5a5650; cursor: not-allowed; }

  .fsg-log-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 0;
    border-bottom: 1px solid #1a2030;
  }
  .fsg-log-row:last-child { border-bottom: none; }
  .fsg-log-thumb {
    width: 48px;
    height: 48px;
    object-fit: cover;
    border-radius: 6px;
    background: #111;
    flex-shrink: 0;
  }
  .fsg-log-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }
  .fsg-log-user {
    font-size: 12px;
    font-weight: 700;
    color: #c9a227;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .fsg-log-caption {
    font-size: 11px;
    color: rgba(232,223,200,0.45);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .fsg-log-actions {
    display: flex;
    flex-direction: column;
    gap: 5px;
    flex-shrink: 0;
  }

  /* ── Timer tab ── */
  .tab--timer { color: #1a4a2a; }
  .tab--timer:hover { color: #4caf72; }
  .tab--timer.active { color: #4caf72; border-bottom-color: #2d7a4a; }

  .timer-quick-row {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    margin-top: 4px;
  }
  .timer-add-btn {
    background: rgba(44, 122, 74, 0.18);
    border: 1px solid rgba(44, 122, 74, 0.45);
    color: #4caf72;
    border-radius: 6px;
    padding: 8px 14px;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    transition: background 0.15s;
  }
  .timer-add-btn:hover { background: rgba(44, 122, 74, 0.3); }
  .timer-clear-btn {
    background: rgba(224, 90, 58, 0.1);
    border: 1px solid rgba(224, 90, 58, 0.35);
    color: #e05a3a;
    border-radius: 6px;
    padding: 8px 14px;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    transition: background 0.15s;
    margin-left: auto;
  }
  .timer-clear-btn:hover { background: rgba(224, 90, 58, 0.22); }
  .timer-duration-preview {
    margin-top: 10px;
    font-family: 'Courier New', Courier, monospace;
    font-size: 28px;
    font-weight: 700;
    color: #4caf72;
    letter-spacing: 1px;
  }
  .timer-active-block {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 14px 0 4px;
  }
  .timer-active-str {
    font-family: 'Courier New', Courier, monospace;
    font-size: 36px;
    font-weight: 700;
    color: #c9a227;
    letter-spacing: -1px;
    font-variant-numeric: tabular-nums;
    flex: 1;
  }
  .timer-active-str.timer-expired { color: #e05a3a; }
  .timer-active-actions {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
  }
  .timer-add-btn.timer-split-active {
    background: rgba(230, 175, 46, 0.12);
    border-color: rgba(230, 175, 46, 0.5);
    color: #e6af2e;
    min-width: 52px;
    animation: split-pulse 1s ease-in-out infinite;
  }
  @keyframes split-pulse {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0.6; }
  }

  /* ── HouseKit tab ── */
  .tab--housekit { border-color: rgba(45,212,191,0.4); }
  .tab--housekit.active { background: rgba(45,212,191,0.12); color: #2dd4bf; border-color: #2dd4bf; }

  .hk-prop-list { display: flex; flex-direction: column; gap: 6px; margin-top: 8px; }
  .hk-prop-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    background: #0c0f16;
    border: 1px solid #1a2030;
    border-radius: 8px;
    padding: 10px 12px;
  }
  .hk-prop-item--editing { border-color: rgba(45,212,191,0.45); }
  .hk-prop-item-info { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .hk-prop-item-name {
    font-size: 13px; font-weight: 600; color: #e8dfc8;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .hk-prop-item-loc {
    font-size: 10px; color: rgba(45,212,191,0.5);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    letter-spacing: 0.3px;
  }
  .hk-prop-item-actions { display: flex; gap: 8px; flex-shrink: 0; }

  .hk-form-pair { display: flex; gap: 10px; }

  .hk-grid-size-row {
    display: flex; align-items: center; gap: 12px; margin-bottom: 8px;
  }
  .hk-size-label {
    display: flex; align-items: center; gap: 6px;
    font-size: 11px; color: rgba(232,223,200,0.5); letter-spacing: 0.5px;
  }
  .hk-size-input { width: 58px !important; padding: 5px 8px !important; }

  .hk-editor-wrap { display: flex; gap: 12px; align-items: flex-start; margin-bottom: 8px; }

  .hk-editor-grid {
    display: grid;
    gap: 1px;
    background: #0a0c12;
    border: 1px solid rgba(255,255,255,0.08);
    padding: 1px;
    flex-shrink: 0;
    user-select: none;
  }
  .hk-editor-cell {
    width: 34px; height: 34px;
    background: #0c0f16;
    border: 1px solid rgba(255,255,255,0.06);
    cursor: pointer;
    transition: background 0.1s;
  }
  .hk-editor-cell:hover { background: rgba(45,212,191,0.08); }
  .hk-ec-filled { background: rgba(45,212,191,0.45); border-color: rgba(45,212,191,0.3); }
  .hk-ec-filled:hover { background: rgba(45,212,191,0.6); }
  .hk-ec-entrance { background: rgba(160,30,30,0.75); border-color: rgba(200,50,50,0.5); }
  .hk-ec-entrance:hover { background: rgba(180,40,40,0.9); }
  .hk-ec-selected { outline: 2px solid #c9a227; outline-offset: -2px; }

  .hk-wall-panel {
    display: flex; flex-direction: column; gap: 5px; align-items: center;
    padding: 8px;
    background: #0c0f16;
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 6px;
    min-width: 48px;
  }
  .hk-wall-label {
    font-size: 9px; letter-spacing: 1px; text-transform: uppercase;
    color: rgba(232,223,200,0.35); margin-bottom: 2px;
  }
  .hk-wall-btn {
    width: 34px; height: 28px;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 4px;
    color: rgba(232,223,200,0.5);
    font-size: 11px; font-weight: 700; letter-spacing: 0.5px;
    cursor: pointer;
    transition: all 0.12s;
  }
  .hk-wall-btn:hover { background: rgba(180,30,30,0.2); border-color: rgba(180,30,30,0.4); color: #e05a3a; }
  .hk-wall-btn--on { background: rgba(180,30,30,0.35); border-color: rgba(200,50,50,0.7); color: #e05a3a; }
  .hk-wall-hint {
    font-size: 8px; color: rgba(232,223,200,0.2);
    letter-spacing: 0.3px; text-align: center; margin-top: 2px;
  }

  .hk-editor-legend {
    display: flex; align-items: center; gap: 14px;
    font-size: 10px; color: rgba(232,223,200,0.35);
    margin-bottom: 10px;
  }
  .hk-el-room, .hk-el-entrance, .hk-el-wall {
    display: inline-block; width: 12px; height: 12px;
    border-radius: 2px; margin-right: 4px; vertical-align: middle;
  }
  .hk-el-room { background: rgba(45,212,191,0.45); }
  .hk-el-entrance { background: rgba(160,30,30,0.75); }
  .hk-el-wall { background: transparent; border: 2px solid #b22; }

  .hk-access-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 8px;
  }
  .hk-access-chip {
    display: flex;
    align-items: center;
    gap: 5px;
    background: rgba(45,212,191,0.08);
    border: 1px solid rgba(45,212,191,0.3);
    border-radius: 20px;
    padding: 4px 8px 4px 10px;
    font-size: 11px;
    color: #2dd4bf;
  }
  .hk-chip-remove {
    background: none;
    border: none;
    color: rgba(45,212,191,0.5);
    cursor: pointer;
    font-size: 10px;
    padding: 0;
    line-height: 1;
  }
  .hk-chip-remove:hover { color: #2dd4bf; }

  .hk-person-picker {
    background: #0c0f16;
    border: 1px solid rgba(45,212,191,0.2);
    border-radius: 8px;
    max-height: 180px;
    overflow-y: auto;
    margin-bottom: 8px;
    scrollbar-width: thin;
    scrollbar-color: rgba(45,212,191,0.2) transparent;
  }
  .hk-person-option {
    padding: 9px 12px;
    font-size: 12px;
    color: #e8dfc8;
    cursor: pointer;
    border-bottom: 1px solid rgba(255,255,255,0.04);
    transition: background 0.15s;
  }
  .hk-person-option:last-child { border-bottom: none; }
  .hk-person-option:hover { background: rgba(45,212,191,0.08); }

  /* ── Downtime tab ── */
  .tab--downtime { color: #3a6070; }
  .tab--downtime:hover { color: #38b482; }
  .tab--downtime.active { color: #38b482; border-bottom-color: #38b482; }

  .dt-period-row {
    display: flex;
    align-items: flex-end;
    gap: 10px;
  }
  .dt-period-arrow {
    font-size: 16px;
    color: #4a5a6a;
    padding-bottom: 10px;
    flex-shrink: 0;
  }

  .dt-active-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 16px;
    border: 1px solid rgba(56, 180, 130, 0.35);
    border-radius: 6px;
    background: rgba(56, 180, 130, 0.06);
  }
  .dt-active-label {
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: #38b482;
    margin-bottom: 4px;
  }
  .dt-active-dates {
    font-size: 17px;
    font-weight: 800;
    color: #e8dfc8;
  }
  .dt-active-index {
    font-size: 10px;
    color: #3a4a5a;
    margin-top: 3px;
    font-family: 'Courier New', Courier, monospace;
  }

  .dt-char-block {
    border: 1px solid rgba(201, 162, 39, 0.15);
    border-radius: 6px;
    margin-bottom: 12px;
    overflow: hidden;
  }
  .dt-char-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 14px;
    background: rgba(255,255,255,0.02);
  }
  .dt-char-name {
    font-size: 13px;
    font-weight: 700;
    color: #e8dfc8;
    margin-right: 8px;
  }
  .dt-char-role {
    font-size: 9px;
    font-weight: 600;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: #4a5a6a;
  }
  .dt-status-chip {
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 1.2px;
    text-transform: uppercase;
    padding: 3px 9px;
    border-radius: 3px;
    background: rgba(201, 162, 39, 0.1);
    color: #4a5a6a;
    border: 1px solid rgba(201, 162, 39, 0.2);
  }
  .dt-status-chip--done {
    background: rgba(56, 180, 130, 0.12);
    color: #38b482;
    border-color: rgba(56, 180, 130, 0.35);
  }

  .dt-actions-review {
    border-top: 1px solid rgba(255,255,255,0.05);
  }
  .dt-action-row {
    padding: 12px 14px;
    border-bottom: 1px solid rgba(255,255,255,0.04);
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .dt-action-row:last-child { border-bottom: none; }

  .dt-action-meta {
    display: flex;
    align-items: center;
    gap: 7px;
    flex-wrap: wrap;
  }
  .dt-action-label {
    font-size: 12px;
    font-weight: 700;
    color: #e8dfc8;
  }
  .dt-type-chip {
    font-size: 8px;
    font-weight: 700;
    letter-spacing: 1px;
    text-transform: uppercase;
    padding: 2px 6px;
    border-radius: 3px;
  }
  .dt-type-routine { background: rgba(56,180,130,0.15); color: #38b482; }
  .dt-type-push    { background: rgba(124,58,237,0.15);  color: #9b6dff; }
  .dt-type-swing   { background: rgba(224,90,58,0.15);   color: #e05a3a; }
  .dt-roll-chip {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    border: 1.5px solid rgba(201,162,39,0.5);
    border-radius: 3px;
    font-size: 10px;
    font-weight: 700;
    font-family: 'Courier New', Courier, monospace;
    color: #c9a227;
  }
  .dt-level-chip {
    font-size: 8px;
    font-weight: 700;
    letter-spacing: 1px;
    text-transform: uppercase;
    padding: 2px 7px;
    border-radius: 3px;
  }
  .dt-level-success { background: rgba(56,180,130,0.18); color: #38b482; }
  .dt-level-partial { background: rgba(201,162,39,0.18); color: #c9a227; }
  .dt-level-fail    { background: rgba(224,90,58,0.18);  color: #e05a3a; }

  .dt-delta-row {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .dt-delta {
    font-size: 10px;
    font-weight: 700;
    padding: 2px 8px;
    border-radius: 3px;
    background: rgba(201,162,39,0.12);
    color: #c9a227;
  }
  .dt-delta.negative { background: rgba(224,90,58,0.12); color: #e05a3a; }

  .dt-narrative-row { position: relative; }
  .dt-narrative {
    width: 100%;
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(201,162,39,0.2);
    border-radius: 4px;
    color: #e8dfc8;
    font-size: 12px;
    font-family: inherit;
    line-height: 1.5;
    padding: 8px 10px;
    resize: vertical;
    box-sizing: border-box;
  }
  .dt-narrative:focus { outline: none; border-color: rgba(201,162,39,0.5); }
  .dt-narrative::placeholder { color: rgba(232,223,200,0.2); }
  .dt-save-state {
    font-size: 9px;
    letter-spacing: 1px;
    text-transform: uppercase;
    color: #4a5a6a;
    position: absolute;
    bottom: 6px;
    right: 8px;
    font-family: 'Courier New', Courier, monospace;
  }
  .dt-save-state--ok  { color: #38b482; }
  .dt-save-state--err { color: #e05a3a; }

  /* ── Session History ── */
  .dt-hist-entry {
    border: 1px solid rgba(201,162,39,0.15);
    border-radius: 6px;
    margin-bottom: 8px;
    overflow: hidden;
  }
  .dt-hist-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 14px;
    cursor: pointer;
    user-select: none;
    background: rgba(255,255,255,0.02);
    gap: 10px;
  }
  .dt-hist-header:hover { background: rgba(255,255,255,0.04); }
  .dt-hist-period {
    font-size: 13px;
    font-weight: 700;
    color: #e8dfc8;
    margin-right: 8px;
  }
  .dt-hist-index {
    font-size: 10px;
    color: #4a5a6a;
    letter-spacing: 0.5px;
  }
  .dt-hist-count {
    font-size: 10px;
    color: #4a5a6a;
  }
  .dt-hist-chevron {
    font-size: 16px;
    color: #4a5a6a;
    transition: transform 0.2s;
    display: inline-block;
    line-height: 1;
  }
  .dt-hist-chevron.expanded { transform: rotate(90deg); }
  .dt-hist-delete { font-size: 11px; padding: 3px 8px; }
  .dt-hist-body {
    border-top: 1px solid rgba(201,162,39,0.1);
    padding: 12px 14px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .dt-hist-char {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .dt-hist-char-name {
    font-size: 12px;
    font-weight: 700;
    color: #e8dfc8;
    margin-bottom: 4px;
  }
  .dt-hist-empty {
    font-size: 11px;
    color: #4a5a6a;
    margin: 0;
    font-style: italic;
  }
</style>
