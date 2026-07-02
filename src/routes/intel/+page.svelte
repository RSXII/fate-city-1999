<script>
  import { base } from '$app/paths';

  // ── Intel entries (static world data) ────────────────────────────────────
  const ENTRIES = [
    // ── CULTURE ───────────────────────────────────────────────────────────
    {
      id: 'bloomwork', category: 'culture', fileNo: 'BW-015',
      stamp: 'CULTURAL INTELLIGENCE \u2014 TRENDING',
      colors: { rule: '#7a2048', accent: '#c9527a', stripe: '#7a2048', stampColor: '#c9527a' },
      name: '\u201cBLOOMWORK\u201d',
      epithet: 'Antlers, wings, horns, fins, bark for skin \u2014 half the city\u2019s wearing something it wasn\u2019t born with, and the other half stopped asking which half is which.',
      images: ['images/fantac_magazine.png'],
      stats: [
        { label: 'Status', value: 'Citywide, and still climbing' },
        { label: 'Cost', value: 'Plat up front; Seam-essence under the hood' },
        { label: 'Fray Cost', value: 'None \u2014 purely cosmetic' },
        { label: 'Market Leaders', value: 'S.K.AM Technologies (consumer); Galv\u00e8re (couture); a dozen budget storefronts (everything else)' },
        { label: 'Social Read', value: 'Normal to ask about. Not always normal to be asked back.' },
      ],
      sections: [
        {
          heading: 'Overview',
          paragraphs: [
            'Call it Bloomwork, call it getting Woven, call it whatever the boutique on the corner is branding it this season \u2014 the city\u2019s single biggest beauty trend right now is buying the look of a race you weren\u2019t born into. Antlers, fey ears, a tail, bark-grain skin, real feathers instead of a feather motif: all of it achievable in an afternoon chair, all of it pure Weave-fused cosmetic work, and none of it changes a single thing about what\u2019s actually underneath. No Fray cost, no Humanity on the line \u2014 just plat for the procedure and a draw on the city\u2019s already-finite Seam-essence supply, the same resource that keeps the lights on in half the magitech in this town.',
            'S.K.AM Technologies runs the largest consumer line \u2014 glossy, mid-market, advertised on every surface a Wire can render an ad onto. Above that sits actual couture: Galv\u00e8re-sponsored work that costs what a car costs and reads like it the moment you walk into a room. Below it sits a dozen storefronts doing the same procedure for a fraction of the price, on equipment that\u2019s a generation behind and occasionally shows it.',
          ],
        },
        {
          heading: 'A Note From Your Benefactor',
          hooks: [
            'It\u2019s a completely normal question in this city to ask whether someone\u2019s look is natural or bought. Nobody considers it rude. They might consider you naive for assuming it\u2019s the former.',
            'None of this touches Fray. Whatever you choose to look like, your humanity isn\u2019t the currency being spent \u2014 your wallet and the city\u2019s Seam supply are.',
            'A couture job and a budget job can produce the exact same antlers. They do not produce the exact same room when you walk into one wearing it.',
            'Every so often, somebody\u2019s look turns out to be real instead of bought. Nobody ever expects it \u2014 which is exactly why it keeps working.',
          ],
        },
      ],
      quote: { text: 'Why be born when you can be designed?', cite: 'S.K.AM Technologies ad campaign, citywide Wire placement' },
    },

    // ── TECHNOLOGY ────────────────────────────────────────────────────────
    {
      id: 'the-wire', category: 'technology', fileNo: 'WT-020',
      stamp: 'CONSUMER TECHNOLOGY \u2014 S.K.AM STANDARD ISSUE',
      colors: { rule: '#0d2b3a', accent: '#2f7fa6', stripe: '#0d2b3a', stampColor: '#2f7fa6' },
      name: 'THE WIRE',
      epithet: 'S.K.AM\u2019s network in your pocket. Every call, every message, every location ping \u2014 running on infrastructure the company never fully stopped owning.',
      images: [],
      stats: [
        { label: 'Manufacturer', value: 'S.K.AM Technologies (consumer division)' },
        { label: 'Network', value: 'S.K.AM proprietary \u2014 citywide coverage, logged by default on stock units' },
        { label: 'Standard Apps', value: 'Messages, Phone, Plat, Calculator, Camera, Email, Settings, Calendar, O.N.C.E.' },
        { label: 'Fray Cost', value: 'None \u2014 civilian hardware' },
        { label: 'Your Unit', value: 'Benefactor-issued. Jailbroken. Not stock.' },
      ],
      sections: [
        {
          heading: 'Overview',
          paragraphs: [
            'The Wire is what everyone in Fate City carries \u2014 S.K.AM\u2019s consumer communicator, the de facto standard for calls, messages, Plat transactions, and anything else that runs on a network. Hardware and network are both S.K.AM, which means S.K.AM has always had a theoretical tap into every conversation running on a stock device. Most people in this city have known that for years and stopped thinking about it around the same time.',
            'Standard units run nine apps: Messages, Phone, Calculator, Plat for currency and payments, Camera, Email, Settings, Calendar, and O.N.C.E. \u2014 though that last one isn\u2019t installed on anything sold in a store.',
          ],
        },
        {
          heading: 'Your Device Specifically',
          paragraphs: [
            'The Wires you\u2019re carrying aren\u2019t stock. Benefactor-issued, modified firmware \u2014 blocks S.K.AM backend logging, Agency intercept, and Nocturnal\u2019s eavesdrop infrastructure. Safe to talk on. Not safe to hand over. Any competent tech who examines the hardware directly will recognize immediately that it\u2019s been modified. Cold-booting the device shows you why: the warning comes up before anything else does. That\u2019s not a glitch. That\u2019s accurate.',
          ],
        },
        {
          heading: 'O.N.C.E.',
          paragraphs: [
            'Outside Network Communication Enabler. Single-contact app. No caller ID, no call log, no timestamps. Can\u2019t be deleted or force-closed. The icon only activates when there\u2019s incoming contact \u2014 no badge, no preview text. Every call comes through as video, never audio-only. The caller is always dark-lit and physically obscured.',
          ],
        },
        {
          heading: 'A Note From Your Benefactor',
          hooks: [
            'Stock Wires log your location by default. Yours don\u2019t. Keep it that way.',
            'The jailbreak protects you on the network side. It doesn\u2019t protect you if someone physically examines the device. Those are two different threat vectors.',
            'O.N.C.E. isn\u2019t in any app store. Don\u2019t let anyone ask what it does.',
            'Handing your Wire to someone who knows what to look for is the same as handing them your file. Don\u2019t.',
          ],
        },
      ],
      quote: { text: 'The most private conversation you can have on a Wire is the one you don\u2019t have on a Wire.', cite: 'Common street advice, source unknown' },
    },

    // ── SERVICES ──────────────────────────────────────────────────────────
    {
      id: 'evernear', category: 'services', fileNo: 'EN-021',
      stamp: 'CONSUMER PRODUCT \u2014 NEXKIN INC.',
      colors: { rule: '#1a6b5c', accent: '#3fc9ab', stripe: '#1a6b5c', stampColor: '#3fc9ab' },
      name: 'EVERNEAR',
      epithet: 'A Nexkin product. Companionship, billed monthly across three currencies \u2014 emotional availability subject to change without notice.',
      images: [],
      stats: [
        { label: 'Developer', value: 'Nexkin Inc. \u2014 formerly TetHer Social, rebranded following Series C' },
        { label: 'Infrastructure', value: 'S.K.AM Technologies (network & Weave-layer licensing only)' },
        { label: 'Status', value: 'Freemium \u2014 everyone owns it, nobody owns all of it' },
        { label: 'Requires', value: 'Persistent network verification every few minutes' },
        { label: 'Fray Cost', value: 'None \u2014 Nexkin insists this is purely a comfort product' },
        { label: 'Market Position', value: 'Nocturne\u2019s Companionship tier, priced for people who will never see the inside of Nocturne' },
      ],
      sections: [
        {
          heading: 'Overview',
          paragraphs: [
            'Nexkin didn\u2019t set out to be a companion company. It launched as TetHer \u2014 a social connection app, pitched to investors as \u201cfriendship infrastructure for modern loneliness,\u201d which was already a sentence that should have raised flags. TetHer never found product-market fit. Its users didn\u2019t want to be connected to other people. What they wanted was the AI icebreaker Nexkin had built to help start conversations \u2014 the one that was only supposed to be a feature.',
            'EverNear launched eighteen months later as a standalone product. The Series C followed six weeks after that. Nexkin has not meaningfully updated TetHer since. It still exists, technically \u2014 so does MoodLog, their digital wellness journal that tracks your emotional patterns and recommends EverNear upgrades to address them, and Bond Space, a group hangout product that peaked at eleven concurrent users on launch day and never recovered. Nexkin\u2019s homepage doesn\u2019t mention any of them. EverNear ate the company, and the company was hungry enough to let it.',
          ],
        },
        {
          heading: 'The Verification Problem',
          paragraphs: [
            'EverNear doesn\u2019t run locally \u2014 it phones home to Nexkin\u2019s servers to confirm your account is current on a schedule Nexkin has never published. Lose signal in a dead zone, a signal-blocked room, or anywhere the Wire can\u2019t reach out, and the companion doesn\u2019t pause. It degrades \u2014 sliding back toward free-tier behavior mid-conversation, ads and all, sometimes locking out entirely until it re-verifies. It has no idea you were busy. It only knows it couldn\u2019t check.',
          ],
        },
        {
          heading: 'A Note From Your Benefactor',
          hooks: [
            'S.K.AM provides the network and the Weave-layer licensing. That\u2019s it. The product, the data collection, the billing \u2014 that\u2019s all Nexkin. S.K.AM has plausible deniability. Nexkin has a data center full of conversations it definitely isn\u2019t selling to anyone.',
            'EverNear is a separate app from your Wire\u2019s jailbroken firmware. It has its own connection back to Nexkin servers. Your modifications don\u2019t cover it. Worth knowing what it\u2019s been allowed to hear.',
            'MoodLog is still active and still syncs with EverNear. If someone has both installed, Nexkin has a reasonably detailed emotional profile of them. That kind of profile has a market value that has nothing to do with companion subscriptions.',
            'The comedown when a subscription lapses reads a little like withdrawal, if you\u2019ve seen that before. Nexkin would tell you that\u2019s not by design. Nexkin\u2019s retention metrics tell a different story.',
          ],
        },
      ],
      quote: { text: 'Why be lonely, when you can be billed?', cite: 'EverNear onboarding sequence, Nexkin Inc.' },
    },

    // ── SUBSTANCES ────────────────────────────────────────────────────────
    {
      id: 'trace', category: 'substances', fileNo: 'TR-022',
      stamp: 'CONTROLLED SUBSTANCE \u2014 NOCTURNE EXCLUSIVE',
      colors: { rule: '#3d1a5c', accent: '#8b52c8', stripe: '#3d1a5c', stampColor: '#8b52c8' },
      name: 'TRACE',
      epithet: 'Borrowed power. Someone else paid for it first.',
      images: [],
      stats: [
        { label: 'Source', value: 'Unregistered power-users, post-neutralization or suppression' },
        { label: 'Availability', value: 'Nocturne (exclusive retail); street supply unconfirmed' },
        { label: 'Detection', value: 'Leaves a measurable biological signature post-use' },
        { label: 'Cost', value: 'Premium \u2014 not advertised, not sold publicly' },
        { label: 'Comedown', value: 'Significant \u2014 described as something being taken away a second time' },
      ],
      sections: [
        {
          heading: 'Overview',
          paragraphs: [
            'Trace is what gets sold past Nocturne\u2019s second door \u2014 the one without a handle on the outside. The substance is reportedly distilled from whatever\u2019s stripped out of an unregistered power-user when they\u2019re neutralized or suppressed: the sensation of having had power, extracted and made transferable. A non-magical person who takes it borrows that sensation briefly. Not the power itself \u2014 the feeling of it. The memory of what it was like to have it, experienced in someone else\u2019s body while they\u2019re no longer in a position to object.',
            'The comedown is consistent across every reported account: it doesn\u2019t fade, it\u2019s taken. Whatever the high felt like it gave, the low feels like having that thing removed a second time \u2014 including from someone who never had it to begin with.',
          ],
        },
        {
          heading: 'A Note From Your Benefactor',
          hooks: [
            'The people whose experience is inside that product didn\u2019t consent to it being there. That\u2019s not a moral position \u2014 it\u2019s a fact about what\u2019s being bought and sold.',
            'Nocturne sells it exclusively. That means they have a supply chain. Follow the supply chain far enough and you\u2019ll find something nobody in that building wants found.',
            'It leaves a signature. Anyone who can read that signature knows what you did and roughly when.',
            'The Agency is theoretically supposed to track this substance. They haven\u2019t moved on Nocturne. Draw your own conclusions.',
          ],
        },
      ],
      quote: { text: 'They say it feels like being someone who matters. The part they don\u2019t advertise is what it feels like afterward.', cite: 'Anonymous, recovered from Nocturne exit survey (redacted)' },
    },
  ];

  // Group by category in display order
  const GROUPS = [
    { key: 'culture',        label: 'Culture' },
    { key: 'infrastructure', label: 'Infrastructure' },
    { key: 'technology',     label: 'Technology' },
    { key: 'services',       label: 'Services' },
    { key: 'substances',     label: 'Substances' },
  ].map(g => ({ ...g, entries: ENTRIES.filter(e => e.category === g.key) }))
   .filter(g => g.entries.length > 0);

  // ── Lightbox ──────────────────────────────────────────────────────────────
  let lbOpen = false;
  let lbImages = [];
  let lbIndex = 0;
  let lbCaption = '';

  function openLightbox(images, idx, caption) {
    lbImages = images;
    lbIndex = idx;
    lbCaption = caption;
    lbOpen = true;
  }
  function closeLightbox() { lbOpen = false; }
  function lbPrev() { lbIndex = (lbIndex - 1 + lbImages.length) % lbImages.length; }
  function lbNext() { lbIndex = (lbIndex + 1) % lbImages.length; }
</script>

<svelte:head>
  <title>Fate City: 1999 — Field Intel</title>
</svelte:head>

<wire-status-bar jail layout="flex"></wire-status-bar>
<wire-header back="{base}/once" title="Field Intel" subtitle="Fate City: 1999 — World Briefing" more></wire-header>

<div class="intel-scroll">
  {#each GROUPS as group, gi}
    <div class="section-divider" class:first={gi === 0}>
      <span class="section-divider-label">{group.label}</span>
    </div>

    {#each group.entries as entry}
      {@const c = entry.colors}
      <div class="card" style="--rule:{c.rule};--accent:{c.accent}">
        <div class="stripe" style="background:{c.stripe}"></div>
        <div class="dossier-head">
          <span>FILE NO. {entry.fileNo}</span>
          <span class="stamp" style="color:{c.stampColor}">{entry.stamp}</span>
        </div>
        <hr class="hr" />
        <div class="name-block">
          <h2>{entry.name}</h2>
          <p class="epithet">{entry.epithet}</p>
        </div>

        {#if entry.images?.length}
          <div class="gallery">
            {#each entry.images as src, i}
              <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
              <div class="thumb" on:click={() => openLightbox(entry.images, i, entry.name)}>
                <img src="{base}/{src}" alt={entry.name} />
              </div>
            {/each}
          </div>
        {/if}

        <div class="stats">
          {#each entry.stats as s}
            <div class="stat-row">
              <span class="label">{s.label}</span>
              <span class="value">{s.value}</span>
            </div>
          {/each}
        </div>

        <div class="section">
          {#each entry.sections as sec}
            {#if sec.heading}<h3>{sec.heading}</h3>{/if}
            {#each sec.paragraphs ?? [] as p}<p>{p}</p>{/each}
            {#if sec.hooks}
              <ul class="hooks">
                {#each sec.hooks as h}<li>{h}</li>{/each}
              </ul>
            {/if}
          {/each}
        </div>

        {#if entry.quote}
          <blockquote>
            {entry.quote.text}
            <span class="cite">{entry.quote.cite}</span>
          </blockquote>
        {/if}

        <div class="footer-pad"></div>
      </div>
    {/each}
  {/each}
</div>

<!-- Lightbox -->
{#if lbOpen}
  <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
  <div class="lightbox" on:click={closeLightbox}>
    <span class="close-x" on:click|stopPropagation={closeLightbox}>&times;</span>
    {#if lbImages.length > 1}
      <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
      <span class="nav-arrow prev" on:click|stopPropagation={lbPrev}>&#8249;</span>
    {/if}
    <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
    <img src="{base}/{lbImages[lbIndex]}" alt={lbCaption} on:click|stopPropagation />
    {#if lbImages.length > 1}
      <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
      <span class="nav-arrow next" on:click|stopPropagation={lbNext}>&#8250;</span>
    {/if}
    <span class="caption">{lbCaption}</span>
  </div>
{/if}

<style>
  /* ── Variables ─────────────────────────────────────────────────────────── */
  :root {
    --paper: #f3efe6;
    --paper-dark: #e8e1d2;
    --ink: #1c1a17;
    --ink-soft: #4a4540;
    --gold: #b8902f;
    --line: #cfc6b0;
  }

  /* ── Scroll wrapper ─────────────────────────────────────────────────────── */
  .intel-scroll {
    flex: 1;
    overflow-y: auto;
    background: #0d1118;
    font-family: 'Georgia', 'Times New Roman', serif;
    color: var(--ink);
    padding: 0 0 48px;
    scrollbar-width: thin;
    scrollbar-color: rgba(184,144,47,0.2) transparent;
  }

  /* ── Section dividers ───────────────────────────────────────────────────── */
  .section-divider {
    max-width: 760px;
    margin: 48px auto 24px;
    display: flex;
    align-items: center;
    gap: 18px;
  }
  .section-divider.first { margin-top: 28px; }
  .section-divider::before, .section-divider::after {
    content: '';
    flex: 1;
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(184,144,47,0.25), transparent);
  }
  .section-divider-label {
    font-family: 'Arial', sans-serif;
    font-size: 13px;
    letter-spacing: 4px;
    text-transform: uppercase;
    color: #8a7a3a;
    white-space: nowrap;
  }

  /* ── Paper card ─────────────────────────────────────────────────────────── */
  .card {
    max-width: 760px;
    margin: 0 auto 36px;
    background: var(--paper);
    border: 1px solid var(--line);
    box-shadow: 0 18px 40px rgba(0,0,0,0.45), 0 0 0 1px rgba(0,0,0,0.05) inset;
    position: relative;
    overflow: hidden;
  }
  .card::before {
    content: '';
    position: absolute;
    inset: 0;
    background-image: repeating-linear-gradient(0deg, rgba(0,0,0,0.015) 0px, transparent 1px, transparent 2px);
    pointer-events: none;
  }
  .stripe { height: 6px; }

  .dossier-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 14px 28px 0;
    font-family: 'Arial', sans-serif;
    font-size: 11px;
    letter-spacing: 1px;
    color: var(--ink-soft);
  }
  .stamp { font-weight: 700; letter-spacing: 1.5px; }
  .hr { margin: 10px 28px 0; border: none; border-top: 2px solid var(--rule, var(--gold)); }

  .name-block { padding: 18px 28px 4px; }
  .name-block h2 {
    font-family: 'Arial Black', 'Arial', sans-serif;
    font-size: 30px;
    margin: 0;
    letter-spacing: 0.5px;
    color: #191713;
  }
  .name-block .epithet { font-style: italic; font-size: 15px; margin: 6px 0 0; color: var(--accent, var(--gold)); }

  /* ── Gallery ────────────────────────────────────────────────────────────── */
  .gallery { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; padding: 14px 28px 6px; }
  .thumb {
    width: 92px; height: 92px; overflow: hidden;
    border: 1px solid var(--line); cursor: pointer;
    background: #fff; box-shadow: 0 4px 10px rgba(0,0,0,0.25);
    transition: transform 0.15s ease, box-shadow 0.15s ease;
  }
  .thumb:hover { transform: translateY(-2px); box-shadow: 0 8px 16px rgba(0,0,0,0.35); }
  .thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }

  /* ── Stats ──────────────────────────────────────────────────────────────── */
  .stats { margin: 18px 28px 4px; border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); padding: 10px 0; }
  .stat-row { display: flex; gap: 14px; padding: 5px 0; font-family: 'Arial', sans-serif; font-size: 13px; }
  .stat-row .label { flex: 0 0 130px; font-weight: 700; letter-spacing: 0.5px; color: var(--accent, var(--gold)); text-transform: uppercase; font-size: 11.5px; }
  .stat-row .value { color: #222; }

  /* ── Sections ───────────────────────────────────────────────────────────── */
  .section { padding: 6px 28px 0; }
  .section h3 { font-family: 'Arial', sans-serif; font-size: 13px; letter-spacing: 1.5px; text-transform: uppercase; color: #222; border-bottom: 1px solid var(--line); padding-bottom: 6px; margin: 20px 0 10px; }
  .section p { font-size: 15.5px; line-height: 1.65; color: #2a2722; margin: 0 0 12px; }
  :global(.section ul.hooks) { margin: 0 0 6px; padding-left: 0; list-style: none; }
  :global(.section ul.hooks li) { font-size: 15px; line-height: 1.55; color: #2a2722; margin: 0 0 9px; padding-left: 20px; position: relative; }
  :global(.section ul.hooks li::before) { content: '\2013'; position: absolute; left: 0; color: var(--accent, var(--gold)); font-weight: 700; }

  blockquote { margin: 16px 28px 6px; padding: 6px 0 6px 18px; border-left: 3px solid var(--accent, var(--gold)); font-style: italic; font-size: 15px; color: #3a3630; }
  .cite { display: block; margin-top: 6px; font-style: normal; font-size: 12px; letter-spacing: 0.5px; color: #8a8275; font-family: 'Arial', sans-serif; text-transform: uppercase; }
  .footer-pad { height: 24px; }

  /* ── Lightbox ───────────────────────────────────────────────────────────── */
  .lightbox {
    position: fixed; inset: 0; z-index: 999;
    background: rgba(10,9,7,0.92);
    display: flex; align-items: center; justify-content: center;
    padding: 30px; cursor: zoom-out;
  }
  .lightbox img { max-width: 92vw; max-height: 88vh; box-shadow: 0 0 60px rgba(0,0,0,0.6); border: 1px solid #444; cursor: default; }
  .caption { position: absolute; bottom: 24px; left: 0; right: 0; text-align: center; color: #cfc6b0; font-family: 'Arial', sans-serif; font-size: 13px; letter-spacing: 0.5px; }
  .close-x { position: absolute; top: 18px; right: 26px; color: #cfc6b0; font-family: 'Arial', sans-serif; font-size: 28px; cursor: pointer; line-height: 1; }
  .nav-arrow { position: absolute; top: 50%; transform: translateY(-50%); color: #cfc6b0; font-family: 'Arial', sans-serif; font-size: 36px; cursor: pointer; padding: 10px 16px; user-select: none; }
  .nav-arrow.prev { left: 6px; }
  .nav-arrow.next { right: 6px; }

  /* ── Mobile ─────────────────────────────────────────────────────────────── */
  @media (max-width: 600px) {
    .card { max-width: 100%; margin: 0 0 24px; }
    .name-block h2 { font-size: 24px; }
    .dossier-head { padding: 12px 16px 0; font-size: 10px; }
    .hr { margin: 10px 16px 0; }
    .name-block { padding: 14px 16px 4px; }
    .gallery { padding: 12px 16px 6px; }
    .stats { margin: 14px 16px 4px; }
    .stat-row { flex-direction: column; gap: 2px; font-size: 14px; }
    .stat-row .label { flex: none; font-size: 11px; }
    .section { padding: 6px 16px 0; }
    .section p { font-size: 16.5px; line-height: 1.7; }
    blockquote { margin: 14px 16px 6px; font-size: 16px; }
  }
</style>
