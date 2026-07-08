<script>
  import { base } from '$app/paths';
  import { onMount, onDestroy } from 'svelte';
  import SENDERS from '$lib/data/senders.js';
  import { dbGet, dbPost, dbPut, dbDelete } from '$lib/firebase-db.js';
  import { visibilityAwareInterval } from '$lib/utils.js';
  import { CASE_SECTIONS } from '$lib/data/case-sections.js';
  import { CLASS_CONFIG, CLASS_DEFAULTS } from '$lib/data/rides.js';

  let activeTab = 'wire';

  const GITHUB_IMAGES_API =
    'https://api.github.com/repos/RSXII/fate-city-1999/contents/images/messages';
  const GITHUB_ROOT_IMAGES_API =
    'https://api.github.com/repos/RSXII/fate-city-1999/contents/images';
  const GITHUB_RIDES_API =
    'https://api.github.com/repos/RSXII/fate-city-1999/contents/static/images/rides';

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
  let msgLog = [];
  let sendStatus = { text: '', type: '' };
  let sending = false;
  let msgLogEl;

  $: sendEnabled = !sending && !!selectedSender && (msgText.trim().length > 0 || !!selectedImage);

  async function refreshLog() {
    try {
      const data = await dbGet('messages', { orderBy: '$key', limitToLast: 100 });
      if (!data) { msgLog = []; return; }
      msgLog = Object.keys(data).map(k => { const m = data[k]; m._id = k; return m; })
        .sort((a, b) => a.ts - b.ts);
    } catch { msgLog = []; }
    // scroll to bottom after render
    setTimeout(() => { if (msgLogEl) msgLogEl.scrollTop = msgLogEl.scrollHeight; }, 0);
  }

  async function sendMessage() {
    const text = msgText.trim();
    if (!selectedSender || (!text && !selectedImage)) return;
    sending = true;
    sendStatus = { text: 'Sending…', type: '' };
    try {
      const payload = { sender: selectedSender.name, color: selectedSender.color, text, ts: Date.now() };
      if (selectedImage) payload.imageUrl = selectedImage.url;
      await dbPost('messages', payload);
      msgText = '';
      selectedImage = null;
      pickerOpen = false;
      sendStatus = { text: 'Sent.', type: 'ok' };
      await refreshLog();
    } catch (e) {
      sendStatus = { text: `Send failed: ${e?.message ?? 'unknown error'}`, type: 'err' };
    }
    sending = false;
  }

  async function clearMessages() {
    if (!confirm('Clear the entire group thread for all players? This cannot be undone.')) return;
    try {
      await dbDelete('messages');
      msgLog = [];
      sendStatus = { text: 'Thread cleared.', type: 'ok' };
    } catch (e) {
      sendStatus = { text: `Clear failed: ${e?.message ?? 'unknown error'}`, type: 'err' };
    }
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
  let replies = []; // { id, from, body, imageUrl }
  let replyCounter = 0;
  let emailStatus = { text: '', type: '' };
  let staging = false;
  let stagedChains = [];
  let liveChains = [];

  // Per-reply picker state keyed by reply id
  let replyPickers = {}; // id → { open, loading, error, images }

  function addReply(from = '', body = '') {
    const id = ++replyCounter;
    replies = [...replies, { id, from, body, imageUrl: '' }];
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
    const msgs = replies
      .map((r, i) => {
        const m = { from: r.from.trim() || 'Unknown', body: r.body.trim(), ts: now + i * 60000 };
        if (r.imageUrl) m.imageUrl = r.imageUrl;
        return m;
      })
      .filter(m => m.body || m.imageUrl || m.from !== 'Unknown');

    if (!msgs.length) { emailStatus = { text: 'Add at least one message to the chain.', type: 'err' }; return; }
    staging = true;
    emailStatus = { text: 'Staging…', type: '' };
    try {
      await dbPost('emails', { subject, staged: false, createdAt: now, messages: msgs });
      emailSubject = '';
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

  // ── Section 3: Phone Contacts ─────────────────────────────────────────────
  let contactList = [];
  let newCName = '';
  let newCNumber = '';
  let newCSubtitle = '';
  let contactStatus = { text: '', type: '' };
  let addingContact = false;

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
    const number = newCNumber.trim();
    if (!name || !number) { contactStatus = { text: 'Name and number are required.', type: 'err' }; return; }
    addingContact = true;
    contactStatus = { text: 'Adding…', type: '' };
    try {
      await dbPost('contacts', { name, number, subtitle: newCSubtitle.trim(), enabled: true });
      newCName = ''; newCNumber = ''; newCSubtitle = '';
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
    if (!confirm('Remove this contact from player phones?')) return;
    try {
      await dbDelete(`contacts/${id}`);
      await refreshContacts();
    } catch (e) { console.error('Delete failed', e); }
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
  let onceLog = [];

  async function refreshOnceLog() {
    try {
      const data = await dbGet('once-messages');
      if (!data) { onceLog = []; return; }
      onceLog = Object.keys(data)
        .map(k => { const m = data[k]; m._id = k; return m; })
        .sort((a, b) => b.ts - a.ts);
    } catch { onceLog = []; }
  }

  async function sendOnceMessage() {
    const text = onceText.trim();
    if (!text) return;
    onceSending = true;
    onceStatus = { text: 'Transmitting…', type: '' };
    try {
      await dbPost('once-messages', { text, ts: Date.now() });
      onceText = '';
      onceStatus = { text: 'Transmitted.', type: 'ok' };
      await refreshOnceLog();
    } catch (e) {
      onceStatus = { text: `Failed: ${e?.message ?? 'unknown error'}`, type: 'err' };
    }
    onceSending = false;
  }

  async function deleteOnceMessage(id) {
    if (!confirm('Delete this transmission? It will vanish from player devices.')) return;
    try {
      await dbDelete(`once-messages/${id}`);
      await refreshOnceLog();
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
  let allJobs = [];
  let stepTexts = {};
  let stepDates = {};
  let jobCreateStatus = { text: '', type: '' };
  let creatingJob = false;

  function nextJobFileNo() {
    const nums = allJobs
      .map(j => parseInt((j.fileNo ?? '').replace('JB-', '')))
      .filter(n => !isNaN(n));
    const next = nums.length ? Math.max(...nums) + 1 : 1;
    return `JB-${String(next).padStart(3, '0')}`;
  }

  async function loadJobs() {
    try {
      const data = await dbGet('jobs');
      if (!data) { allJobs = []; stepTexts = {}; return; }
      const loaded = Object.keys(data)
        .map(k => { const j = data[k]; j._id = k; return j; })
        .filter(j => j.title)
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      allJobs = loaded;
      const inputs = {};
      const dates = {};
      for (const j of loaded) {
        inputs[j._id] = stepTexts[j._id] ?? '';
        dates[j._id] = stepDates[j._id] ?? '';
      }
      stepTexts = inputs;
      stepDates = dates;
    } catch { allJobs = []; }
  }

  async function createJob() {
    const title = jobTitle.trim();
    if (!title) { jobCreateStatus = { text: 'A title is required.', type: 'err' }; return; }
    creatingJob = true;
    jobCreateStatus = { text: 'Creating…', type: '' };
    try {
      const fileNo = nextJobFileNo();
      await dbPost('jobs', { title, brief: jobBrief.trim(), status: jobNewStatus, fileNo, steps: [], createdAt: Date.now() });
      jobTitle = '';
      jobBrief = '';
      jobNewStatus = 'active';
      jobCreateStatus = { text: `Job created (${fileNo}).`, type: 'ok' };
      await loadJobs();
    } catch (e) {
      jobCreateStatus = { text: `Failed: ${e?.message ?? 'unknown error'}`, type: 'err' };
    }
    creatingJob = false;
  }

  async function addJobStep(id) {
    const text = (stepTexts[id] ?? '').trim();
    if (!text) return;
    const date = (stepDates[id] ?? '').trim();
    const job = allJobs.find(j => j._id === id);
    const existing = Array.isArray(job?.steps) ? job.steps : [];
    const step = { text, ts: Date.now() };
    if (date) step.date = date;
    try {
      await dbPut(`jobs/${id}/steps`, [...existing, step]);
      stepTexts = { ...stepTexts, [id]: '' };
      stepDates = { ...stepDates, [id]: '' };
      await loadJobs();
    } catch (e) { console.error('Step add failed', e); }
  }

  async function setJobStatus(id, status) {
    try {
      await dbPut(`jobs/${id}/status`, status);
      await loadJobs();
    } catch (e) { console.error('Status update failed', e); }
  }

  async function deleteJob(id) {
    if (!confirm('Delete this job? It will disappear from player devices.')) return;
    try {
      await dbDelete(`jobs/${id}`);
      await loadJobs();
    } catch (e) { console.error('Delete failed', e); }
  }

  // ── Section 6: Rides ─────────────────────────────────────────────────────
  let rideMake = '';
  let rideModel = '';
  let rideYear = 1999;
  let rideClass = 'sedan';
  let rideImage = '';
  let rideSpd = '';
  let rideSeats = '';
  let rideSpeedCombat = '';
  let rideSpeedNarrative = '';
  let rideCost = '';
  let rideCreateStatus = { text: '', type: '' };
  let creatingRide = false;

  let ridesPickerOpen = false;
  let ridesPickerLoading = false;
  let ridesPickerError = '';
  let ridesPickerImages = [];

  function applyClassDefaults(cls) {
    const d = CLASS_DEFAULTS[cls];
    if (!d) return;
    rideSpd          = String(d.spd);
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
          spd: parseInt(rideSpd) || 0,
          seats: parseInt(rideSeats) || 0,
          speedCombat: parseInt(rideSpeedCombat) || 0,
          speedNarrative: rideSpeedNarrative.trim() || null,
          cost: rideCost.trim() || null,
        },
        staged: false,
        createdAt: Date.now(),
      });
      rideMake = ''; rideModel = ''; rideImage = '';
      rideSpd = ''; rideSeats = ''; rideSpeedCombat = ''; rideSpeedNarrative = ''; rideCost = '';
      rideYear = 1999; rideClass = 'sedan';
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

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  let msgPoll;
  let emailPoll;
  let casePoll;
  let contactPoll;
  let datePoll;
  let oncePoll;
  let jobPoll;
  let ridesPoll;

  onMount(() => {
    addReply(); addReply();
    refreshLog();
    refreshStaged();
    refreshLive();
    refreshCaseStaged();
    refreshCaseLive();
    refreshContacts();
    loadCurrentCalDate();
    refreshOnceLog();
    msgPoll     = visibilityAwareInterval(refreshLog,  5000);
    emailPoll   = visibilityAwareInterval(() => { refreshStaged(); refreshLive(); }, 8000);
    casePoll    = visibilityAwareInterval(() => { refreshCaseStaged(); refreshCaseLive(); }, 8000);
    contactPoll = visibilityAwareInterval(refreshContacts, 10000);
    datePoll    = visibilityAwareInterval(loadCurrentCalDate, 10000);
    oncePoll    = visibilityAwareInterval(refreshOnceLog, 6000);
    loadJobs();
    jobPoll     = visibilityAwareInterval(loadJobs, 8000);
    refreshStagedRides();
    refreshLiveRides();
    ridesPoll   = visibilityAwareInterval(() => { refreshStagedRides(); refreshLiveRides(); }, 10000);
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
  </div>

  <!-- ── Tab panels ──────────────────────────────────────────────────────── -->
  <div class="tab-panel">

    <!-- ══ WIRE MESSAGES ══════════════════════════════════════════════════ -->
    {#if activeTab === 'wire'}

      <div class="section">
        <div class="section-label">Sender</div>
        <div class="chip-grid">
          {#each SENDERS as s (s.id)}
            <button
              type="button"
              class="chip"
              class:selected={selectedSender?.id === s.id}
              style="color:{s.color};border-color:{s.color}"
              on:click={() => { selectedSender = s; }}
            >
              <img
                class="chip-avatar"
                src="{base}/{s.avatar}"
                alt=""
                loading="lazy"
                on:error={e => e.target.style.display = 'none'}
              />
              <span>{s.name}</span>
            </button>
          {/each}
        </div>
      </div>

      <div class="section">
        <div class="section-label">Message</div>
        <div class="selected-line">
          {#if selectedSender}
            Sending as <strong style="color:{selectedSender.color}">{selectedSender.name}</strong>
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
          Send to group thread
        </button>
        <div class="status-line" class:ok={sendStatus.type === 'ok'} class:err={sendStatus.type === 'err'}>
          {sendStatus.text}
        </div>
      </div>

      <div class="section">
        <div class="section-label-row">
          <div class="section-label" style="margin-bottom:0">Thread (live)</div>
          <button class="ghost-btn" on:click={clearMessages}>Clear thread</button>
        </div>
        <div class="log" bind:this={msgLogEl}>
          {#if !msgLog.length}
            <div class="log-empty">No messages sent yet.</div>
          {:else}
            {#each msgLog as m (m._id ?? m.ts)}
              <div class="log-row">
                <span class="log-name" style="color:{m.color}">{m.sender}:</span>
                <span class="log-text">
                  {#if m.imageUrl}📷 {/if}{m.text ?? ''}
                  <span class="log-time">{relTime(m.ts)}</span>
                </span>
              </div>
            {/each}
          {/if}
        </div>
      </div>

    <!-- ══ EMAIL / DATA PACKETS ═══════════════════════════════════════════ -->
    {:else if activeTab === 'email'}

      <p class="tab-sub">Author an intercepted email chain. Stage it silently, then deploy when players are ready.</p>

      <div class="section">
        <div class="section-label">New Chain</div>
        <input
          type="text"
          class="email-subject-input"
          placeholder="Subject line…"
          bind:value={emailSubject}
        />

        {#each replies as reply (reply.id)}
          <div class="reply-block">
            <div class="reply-block-header">
              <input
                type="text"
                class="reply-from-input"
                placeholder="From: display name…"
                value={reply.from}
                on:input={e => { reply.from = e.target.value; replies = replies; }}
              />
              {#if replies.length > 1}
                <button type="button" class="remove-reply-btn" on:click={() => removeReply(reply.id)}>&times;</button>
              {/if}
            </div>
            <textarea
              class="reply-body-input"
              rows="3"
              placeholder="Message body…"
              value={reply.body}
              on:input={e => { reply.body = e.target.value; replies = replies; }}
            ></textarea>

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
          </div>
        {/each}

        <button class="ghost-btn" type="button" style="margin-top:4px" on:click={() => addReply()}>
          + Add Reply
        </button>
        <div style="height:12px"></div>
        <button class="primary" disabled={staging} on:click={stageChain}>
          {staging ? 'Staging…' : 'Stage Chain (hidden from players)'}
        </button>
        <div class="status-line" class:ok={emailStatus.type === 'ok'} class:err={emailStatus.type === 'err'}>
          {emailStatus.text}
        </div>
      </div>

      <div class="section">
        <div class="section-label-row">
          <div class="section-label" style="margin-bottom:0">Staged — awaiting deploy</div>
          <button class="ghost-btn" on:click={refreshStaged}>Refresh</button>
        </div>
        <div class="log">
          {#if !stagedChains.length}
            <div class="log-empty">No staged chains.</div>
          {:else}
            {#each stagedChains as chain (chain._id)}
              {@const msgs = normMessages(chain.messages)}
              <div class="chain-log-row">
                <div class="chain-log-top">
                  <span class="chain-log-subject" style="color:#c9a227">{chain.subject}</span>
                  <span class="chain-log-meta">{msgs.length} msg{msgs.length !== 1 ? 's' : ''} · {relTime(chain.createdAt || 0)}</span>
                </div>
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
        <div class="log">
          {#if !liveChains.length}
            <div class="log-empty">No live chains.</div>
          {:else}
            {#each liveChains as chain (chain._id)}
              {@const msgs = normMessages(chain.messages)}
              <div class="chain-log-row">
                <div class="chain-log-top">
                  <span class="chain-log-subject">
                    <span class="live-label">▶ LIVE &nbsp;</span>{chain.subject}
                  </span>
                  <span class="chain-log-meta">{msgs.length} msg{msgs.length !== 1 ? 's' : ''} · {relTime(chain.createdAt || 0)}</span>
                </div>
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

    <!-- ══ CASE FILES (persons / locations / intel) ══════════════════════════ -->
    {:else if activeTab === 'cases'}

      <p class="tab-sub">Author a new persons, locations, or intel case file. Stage it, then deploy when players are ready.</p>

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

    <!-- ══ PHONE CONTACTS ══════════════════════════════════════════════════ -->
    {:else if activeTab === 'contacts'}

      <p class="tab-sub">Manage contacts that appear on player devices. Toggle visibility without deleting.</p>

      <div class="section">
        <div class="section-label">Add Contact</div>
        <div class="contact-form">
          <input type="text" class="contact-input" placeholder="Name…" bind:value={newCName} />
          <input type="text" class="contact-input" placeholder="Phone number…" bind:value={newCNumber} />
          <input type="text" class="contact-input" placeholder="Role / subtitle (optional)…" bind:value={newCSubtitle} />
        </div>
        <div style="height:10px"></div>
        <button class="primary" disabled={addingContact} on:click={addContact}>
          {addingContact ? 'Adding…' : 'Add to Phone Contacts'}
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
              <div class="contact-log-row">
                <div class="contact-log-info">
                  <span class="contact-log-name" class:dimmed={!c.enabled}>{c.name}</span>
                  <span class="contact-log-meta">{c.number}{c.subtitle ? ' · ' + c.subtitle : ''}</span>
                </div>
                <div class="contact-log-actions">
                  <button class="toggle-btn" class:on={c.enabled} on:click={() => toggleContact(c._id, c.enabled)}>
                    {c.enabled ? 'Visible' : 'Hidden'}
                  </button>
                  <button class="danger-btn" on:click={() => deleteContact(c._id)}>Delete</button>
                </div>
              </div>
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

      <p class="tab-sub">Send an encrypted message from Unknown / M to the O.N.C.E. channel on all player devices.</p>

      <div class="section">
        <div class="section-label once-section-label">New Transmission</div>
        <textarea
          class="once-textarea"
          bind:value={onceText}
          placeholder="Message from M… instructions, objectives, warnings."
        ></textarea>
        <div style="height:10px"></div>
        <button class="once-send-btn" disabled={onceSending || !onceText.trim()} on:click={sendOnceMessage}>
          {onceSending ? 'Transmitting…' : 'Transmit to O.N.C.E.'}
        </button>
        <div class="status-line" class:ok={onceStatus.type === 'ok'} class:err={onceStatus.type === 'err'}>
          {onceStatus.text}
        </div>
      </div>

      <div class="section">
        <div class="section-label-row">
          <div class="section-label once-section-label" style="margin-bottom:0">Transmissions (live)</div>
          <button class="ghost-btn" on:click={refreshOnceLog}>Refresh</button>
        </div>
        <div class="log">
          {#if !onceLog.length}
            <div class="log-empty">No transmissions sent yet.</div>
          {:else}
            {#each onceLog as m (m._id ?? m.ts)}
              <div class="once-log-row">
                <span class="once-log-m">M:</span>
                <span class="log-text">{m.text}<span class="log-time">{relTime(m.ts)}</span></span>
                <button class="danger-btn once-delete-btn" on:click={() => deleteOnceMessage(m._id)}>&times;</button>
              </div>
            {/each}
          {/if}
        </div>
      </div>

    <!-- ══ JOBS ══════════════════════════════════════════════════════════════ -->
    {:else if activeTab === 'jobs'}

      <p class="tab-sub">Create active jobs and log steps live during play. Updates appear on player devices immediately.</p>

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
          {creatingJob ? 'Creating…' : 'Create Job'}
        </button>
        <div class="status-line" class:ok={jobCreateStatus.type === 'ok'} class:err={jobCreateStatus.type === 'err'}>
          {jobCreateStatus.text}
        </div>
      </div>

      <div class="section">
        <div class="section-label-row">
          <div class="section-label" style="margin-bottom:0">Jobs ({allJobs.length})</div>
          <button class="ghost-btn" on:click={loadJobs}>Refresh</button>
        </div>

        {#if !allJobs.length}
          <div class="log" style="margin-top:8px"><div class="log-empty">No jobs yet. Create one above.</div></div>
        {:else}
          {#each allJobs as job (job._id)}
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
                <button class="danger-btn" on:click={() => deleteJob(job._id)}>Delete</button>
              </div>
            </div>
          {/each}
        {/if}
      </div>

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
            <label class="form-label">SPD</label>
            <input class="form-input" type="number" placeholder="0" bind:value={rideSpd} />
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
                <span class="ride-class">{CLASS_CONFIG[r.class]?.label ?? r.class}</span>
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
                <span class="ride-class">{CLASS_CONFIG[r.class]?.label ?? r.class}</span>
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

  </div><!-- /tab-panel -->
</div><!-- /console -->

<style>
  .console {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
    max-width: 640px;
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

  /* ── Tab panel (the scrollable area) ── */
  .tab-panel {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 20px 16px 60px;
    scrollbar-width: thin;
    scrollbar-color: rgba(201, 162, 39, 0.2) transparent;
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

  .log { background: #0c0f16; border: 1px solid #1a2030; border-radius: 8px; padding: 12px 14px; max-height: 320px; overflow-y: auto; }
  .log-empty { font-size: 12px; font-style: italic; color: #3a4a5a; text-align: center; padding: 10px 0; }
  .log-row { display: flex; gap: 8px; margin-bottom: 10px; font-size: 12.5px; line-height: 1.5; }
  .log-row:last-child { margin-bottom: 0; }
  .log-name { font-weight: 700; flex-shrink: 0; }
  .log-text { color: rgba(232,223,200,0.85); white-space: pre-line; }
  .log-time { color: #3a4a5a; font-size: 10px; margin-left: 6px; }

  .status-line { font-size: 11px; color: #6a7d90; margin-top: 8px; min-height: 14px; }
  .status-line.ok { color: #639922; }
  .status-line.err { color: #e24b4a; }

  /* ── Email section ── */
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
  .contact-log-info { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }
  .contact-log-name { font-size: 13px; font-weight: 600; color: #e8dfc8; }
  .contact-log-name.dimmed { color: #3a4a5a; }
  .contact-log-meta { font-size: 11px; color: #6a7d90; }
  .contact-log-actions { display: flex; gap: 6px; flex-shrink: 0; }
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
</style>
