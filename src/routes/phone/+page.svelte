<script>
  import { base } from '$app/paths';
  import { onMount } from 'svelte';
  import { dbGet } from '$lib/firebase-db.js';

  // ── Tab state ─────────────────────────────────────────────────────────────
  let activeTab = 'keypad';

  // ── Keypad ───────────────────────────────────────────────────────────────
  let dialDisplay = '';

  const KEYS = [
    { digit: '1', sub: '' },
    { digit: '2', sub: 'ABC' },
    { digit: '3', sub: 'DEF' },
    { digit: '4', sub: 'GHI' },
    { digit: '5', sub: 'JKL' },
    { digit: '6', sub: 'MNO' },
    { digit: '7', sub: 'PQRS' },
    { digit: '8', sub: 'TUV' },
    { digit: '9', sub: 'WXYZ' },
    { digit: '*', sub: '' },
    { digit: '0', sub: '+' },
    { digit: '#', sub: '' },
  ];

  function pressKey(digit) {
    if (dialDisplay.length >= 15) return;
    dialDisplay += digit;
  }

  function backspace() {
    dialDisplay = dialDisplay.slice(0, -1);
  }

  // ── Contacts ─────────────────────────────────────────────────────────────
  let contacts = [];
  let contactsLoading = true;

  async function loadContacts() {
    contactsLoading = true;
    try {
      const data = await dbGet('contacts');
      if (!data) { contacts = []; }
      else {
        contacts = Object.keys(data)
          .map(k => ({ ...data[k], _id: k }))
          .filter(c => c.enabled === true)
          .sort((a, b) => a.name.localeCompare(b.name));
      }
    } catch {
      contacts = [];
    }
    contactsLoading = false;
  }

  // Group alphabetically
  $: contactGroups = (() => {
    const groups = {};
    for (const c of contacts) {
      const letter = c.name?.[0]?.toUpperCase() ?? '#';
      if (!groups[letter]) groups[letter] = [];
      groups[letter].push(c);
    }
    return Object.keys(groups).sort().map(k => ({ letter: k, items: groups[k] }));
  })();

  // Deterministic avatar color from name
  const AVATAR_COLORS = ['#3b82f6','#8b5cf6','#ec4899','#f59e0b','#10b981','#6366f1','#ef4444','#06b6d4'];
  function avatarColor(name) {
    let h = 0;
    for (let i = 0; i < (name?.length ?? 0); i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff;
    return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
  }

  onMount(() => { loadContacts(); });
</script>

<svelte:head>
  <title>Fate City: 1999 — Phone</title>
</svelte:head>

<wire-status-bar jail layout="flex"></wire-status-bar>
<wire-header back="{base}/home" title="Phone" layout="flex"></wire-header>

<div class="phone-wrap">

  <!-- ── KEYPAD TAB ─────────────────────────────────────────────────────── -->
  {#if activeTab === 'keypad'}
    <div class="keypad-view">

      <div class="dial-display">
        <span class="dial-number" class:small={dialDisplay.length > 10}>
          {dialDisplay || ''}
        </span>
      </div>

      <div class="key-grid">
        {#each KEYS as k}
          <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
          <div class="key-btn" on:click={() => pressKey(k.digit)}>
            <span class="key-digit">{k.digit}</span>
            {#if k.sub}<span class="key-sub">{k.sub}</span>{/if}
          </div>
        {/each}
      </div>

      <div class="action-row">
        <!-- empty left -->
        <div class="action-slot"></div>

        <!-- call button (cosmetic, disabled) -->
        <div class="action-slot center">
          <div class="call-btn" aria-label="Call" aria-disabled="true">
            <svg viewBox="0 0 24 24" width="28" height="28" fill="white" aria-hidden="true">
              <path d="M6.7 4h2.7l1.4 3.8-2 1.6a12.3 12.3 0 0 0 5.8 5.8l1.6-2 3.8 1.4v2.7a2 2 0 0 1-2 2C10.8 19.3 4.7 13.2 4.7 6a2 2 0 0 1 2-2z" />
            </svg>
          </div>
        </div>

        <!-- backspace -->
        <div class="action-slot right">
          {#if dialDisplay}
            <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
            <div class="backspace-btn" on:click={backspace} aria-label="Backspace">
              <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M21 6H8l-7 6 7 6h13a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2z" />
                <line x1="18" y1="9" x2="12" y2="15" />
                <line x1="12" y1="9" x2="18" y2="15" />
              </svg>
            </div>
          {/if}
        </div>
      </div>

    </div>
  {/if}

  <!-- ── CONTACTS TAB ────────────────────────────────────────────────────── -->
  {#if activeTab === 'contacts'}
    <div class="contacts-view">
      {#if contactsLoading}
        <div class="contacts-empty">Loading…</div>
      {:else if contacts.length === 0}
        <div class="contacts-empty">No contacts available.</div>
      {:else}
        {#each contactGroups as group}
          <div class="alpha-header">{group.letter}</div>
          {#each group.items as contact}
            <div class="contact-row">
              <div class="contact-avatar" style="background:{avatarColor(contact.name)}">
                {contact.name?.[0]?.toUpperCase() ?? '?'}
              </div>
              <div class="contact-info">
                <span class="contact-name">{contact.name}</span>
                {#if contact.subtitle}<span class="contact-sub">{contact.subtitle}</span>{/if}
                <span class="contact-number">{contact.number}</span>
              </div>
            </div>
          {/each}
        {/each}
      {/if}
    </div>
  {/if}

  <!-- ── TAB BAR ────────────────────────────────────────────────────────── -->
  <nav class="phone-tabs">
    <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
    <div class="tab" class:active={activeTab === 'keypad'} on:click={() => (activeTab = 'keypad')}>
      <svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <rect x="5.5" y="3" width="13" height="18" rx="1.5" />
        <rect x="7.5" y="5.3" width="9" height="3.4" rx="0.5" />
        <circle cx="8.4" cy="13" r="0.85" fill="currentColor" stroke="none" />
        <circle cx="12" cy="13" r="0.85" fill="currentColor" stroke="none" />
        <circle cx="15.6" cy="13" r="0.85" fill="currentColor" stroke="none" />
        <circle cx="8.4" cy="16.2" r="0.85" fill="currentColor" stroke="none" />
        <circle cx="12" cy="16.2" r="0.85" fill="currentColor" stroke="none" />
        <circle cx="15.6" cy="16.2" r="0.85" fill="currentColor" stroke="none" />
      </svg>
      <span>Keypad</span>
    </div>
    <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
    <div class="tab" class:active={activeTab === 'contacts'} on:click={() => (activeTab = 'contacts')}>
      <svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <circle cx="12" cy="8" r="4" />
        <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
      </svg>
      <span>Contacts</span>
    </div>
  </nav>

</div>

<style>
  /* ── Shell ───────────────────────────────────────────────────────────── */
  .phone-wrap {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: #111;
  }

  /* ── Keypad view ─────────────────────────────────────────────────────── */
  .keypad-view {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: 8px 10px 8px;
    overflow: hidden;
  }

  /* Number display */
  .dial-display {
    min-height: 72px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 8px 24px;
  }
  .dial-number {
    font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif;
    font-size: 40px;
    font-weight: 300;
    letter-spacing: 4px;
    color: #fff;
    transition: font-size 0.15s ease;
  }
  .dial-number.small { font-size: 28px; letter-spacing: 2px; }

  /* 3×4 key grid — constrained so buttons stay phone-sized on wide viewports */
  .key-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
    width: min(252px, calc(100% - 32px));
    margin: 0 auto;
  }
  .key-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: #2a2a2e;
    border-radius: 50%;
    aspect-ratio: 1;
    cursor: pointer;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
    transition: background 0.1s ease, transform 0.08s ease;
  }
  .key-btn:active { background: #48484c; transform: scale(0.94); }
  .key-digit {
    font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif;
    font-size: clamp(20px, 6.5vw, 26px);
    font-weight: 300;
    color: #fff;
    line-height: 1;
  }
  .key-sub {
    font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif;
    font-size: clamp(7px, 2vw, 9px);
    font-weight: 600;
    letter-spacing: 2px;
    color: rgba(255,255,255,0.7);
    margin-top: 1px;
    line-height: 1;
  }

  /* Action row — matches key-grid width so call btn centers under middle column */
  .action-row {
    display: flex;
    align-items: center;
    padding: 10px 0 4px;
    gap: 10px;
    width: min(252px, calc(100% - 32px));
    margin: 0 auto;
  }
  .action-slot {
    flex: 1;
    display: flex;
    align-items: center;
  }
  .action-slot.center { justify-content: center; }
  .action-slot.right  { justify-content: center; }

  .call-btn {
    width: 60px;
    height: 60px;
    border-radius: 50%;
    background: #c9a227;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: default;
    opacity: 0.9;
    box-shadow: 0 4px 16px rgba(201,162,39,0.4);
  }

  .backspace-btn {
    width: 44px;
    height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: rgba(255,255,255,0.65);
    cursor: pointer;
    border-radius: 50%;
    -webkit-tap-highlight-color: transparent;
    transition: color 0.1s ease;
  }
  .backspace-btn:active { color: #fff; }

  /* ── Contacts view ───────────────────────────────────────────────────── */
  .contacts-view {
    flex: 1;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: thin;
    scrollbar-color: rgba(255,255,255,0.1) transparent;
    padding-bottom: 8px;
  }

  .contacts-empty {
    padding: 80px 24px 48px;
    text-align: center;
    font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif;
    font-size: 15px;
    color: rgba(255,255,255,0.3);
    letter-spacing: 0.3px;
  }

  .alpha-header {
    padding: 6px 20px 4px;
    font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif;
    font-size: 13px;
    font-weight: 600;
    color: rgba(255,255,255,0.35);
    background: #111;
    position: sticky;
    top: 0;
    z-index: 1;
    letter-spacing: 0.5px;
  }

  .contact-row {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 10px 20px;
    border-bottom: 1px solid rgba(255,255,255,0.07);
  }

  .contact-avatar {
    width: 42px;
    height: 42px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif;
    font-size: 17px;
    font-weight: 600;
    color: #fff;
    flex-shrink: 0;
  }

  .contact-info {
    display: flex;
    flex-direction: column;
    gap: 1px;
    min-width: 0;
  }
  .contact-name {
    font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif;
    font-size: 16px;
    color: #fff;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .contact-sub {
    font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif;
    font-size: 12px;
    color: rgba(255,255,255,0.4);
    letter-spacing: 0.3px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .contact-number {
    font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif;
    font-size: 13px;
    color: rgba(255,255,255,0.5);
    letter-spacing: 0.5px;
  }

  /* ── Tab bar ─────────────────────────────────────────────────────────── */
  .phone-tabs {
    flex: none;
    display: flex;
    background: rgba(28,28,30,0.95);
    border-top: 1px solid rgba(255,255,255,0.08);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    /* push tab items above the fixed wire-home-bar (32px) */
    padding-bottom: 32px;
  }

  .tab {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
    padding: 10px 0 12px;
    color: rgba(255,255,255,0.4);
    cursor: pointer;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
    font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif;
    font-size: 10px;
    font-weight: 500;
    letter-spacing: 0.3px;
    transition: color 0.15s ease;
  }
  .tab.active { color: #c9a227; }
  .tab:active { opacity: 0.7; }
</style>
