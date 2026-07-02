<script>
  import { browser } from '$app/environment';
  import { getCodename } from '$lib/utils.js';

  const codename = browser ? (getCodename() ?? 'OPERATIVE') : 'OPERATIVE';
</script>

<!-- Home tab — hologram stage, daily check-in, memory bar, bond level -->
<div class="screen-home">
  <div class="hologram-stage">
    <div class="hologram-ring">
      <div class="hologram-glow"></div>
      <div class="hologram-inner">
        <svg class="smiley-face" viewBox="0 0 110 110" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <radialGradient id="face-grad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stop-color="#2a1045" />
              <stop offset="100%" stop-color="#0a0710" />
            </radialGradient>
            <linearGradient id="smiley-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#ff4d8e" />
              <stop offset="50%" stop-color="#a855f7" />
              <stop offset="100%" stop-color="#4dd9ff" />
            </linearGradient>
          </defs>
          <circle cx="55" cy="55" r="52" fill="url(#face-grad)" />
          <circle class="eye" cx="39" cy="44" rx="6" ry="7" fill="url(#smiley-grad)" />
          <circle class="eye eye-r" cx="71" cy="44" rx="6" ry="7" fill="url(#smiley-grad)" />
          <path d="M 36 66 Q 55 82 74 66" stroke="url(#smiley-grad)" stroke-width="3.5" stroke-linecap="round" fill="none" />
        </svg>
      </div>
    </div>
    <div class="companion-name">ECHO-7</div>
    <div class="companion-tier-tag">Free Tier &mdash; Standard</div>
    <div class="companion-greeting">Hello, {codename}</div>
    <a class="see-echo-link" href="#">Upgrade to see ECHO-7 &rsaquo;</a>
  </div>

  <div class="card">
    <div class="card-title">Daily Bond Check-In</div>
    <button class="grad-btn">Check In &nbsp;+5 NP</button>
    <div class="checkin-reward">
      Daily streak: <strong>3 days</strong> &nbsp;&mdash;&nbsp; Next milestone at 7 days (<strong class="np-text">50 NP</strong>)
    </div>
  </div>

  <div class="card">
    <div class="card-title">Memory Retention</div>
    <div class="bond-row">
      <span class="bond-row-label">Current tier</span>
      <span class="bond-row-value">Free (3 lines)</span>
    </div>
    <div class="bar-track"><div class="bar-fill" style="width:12%"></div></div>
    <div class="bar-caption">
      <span>Free</span>
      <span>Silver &nbsp;&rsaquo;&nbsp; Gold &nbsp;&rsaquo;&nbsp; Platinum*</span>
    </div>
    <div style="margin-top:10px;font-size:11px;color:var(--muted)">
      Memory resets each session. &nbsp;<a href="#" style="color:var(--pink);text-decoration:none">Upgrade Memory &rsaquo;</a>
    </div>
  </div>

  <div class="card">
    <div class="card-title">Bond Level</div>
    <div class="bond-row">
      <span class="bond-row-label">Level</span>
      <span class="bond-row-value">4</span>
    </div>
    <div class="bar-track"><div class="bar-fill" style="width:42%"></div></div>
    <div class="bar-caption">
      <span>420 / 1000 XP to Level 5</span><span>+1 XP / conversation</span>
    </div>
  </div>
</div>

<style>
  .screen-home { padding: 18px 16px 8px; }

  .hologram-stage {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 18px 0 22px;
  }
  .hologram-ring {
    width: 210px;
    height: 210px;
    border-radius: 50%;
    background: var(--grad);
    padding: 3px;
    position: relative;
  }
  .hologram-inner {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    background: var(--bg);
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }
  .hologram-glow {
    position: absolute;
    inset: -10px;
    border-radius: 50%;
    box-shadow: 0 0 35px rgba(255,77,142,0.3), 0 0 70px rgba(77,217,255,0.15);
    pointer-events: none;
    animation: holo-pulse 3s ease-in-out infinite;
  }
  @keyframes holo-pulse { 0%,100%{opacity:.55} 50%{opacity:1} }

  .smiley-face { width: 110px; height: 110px; }
  :global(.smiley-face circle.eye) {
    animation: eye-blink 4.5s ease-in-out infinite;
    transform-origin: center;
    transform-box: fill-box;
  }
  :global(.smiley-face circle.eye-r) { animation-delay: 0.08s; }
  @keyframes eye-blink {
    0%,85%,100% { transform: scaleY(1); }
    90%,95% { transform: scaleY(0.08); }
  }

  .companion-name {
    margin-top: 16px;
    font-size: 22px;
    font-weight: 800;
    letter-spacing: 3px;
    background: var(--grad);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  .companion-tier-tag {
    margin-top: 5px;
    font-size: 9.5px;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: var(--muted);
  }
  .companion-greeting {
    margin-top: 8px;
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: rgba(255, 77, 142, 0.75);
  }
  .see-echo-link {
    margin-top: 7px;
    font-size: 11px;
    color: var(--pink);
    text-decoration: none;
    letter-spacing: 0.3px;
    display: flex;
    align-items: center;
    gap: 3px;
  }

  .card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 14px;
    padding: 16px;
    margin-bottom: 10px;
  }
  .card-title {
    font-size: 11px;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: var(--muted);
    margin-bottom: 10px;
  }
  .grad-btn {
    width: 100%;
    padding: 14px;
    border: none;
    border-radius: 12px;
    background: var(--grad);
    color: #fff;
    font-size: 14px;
    font-weight: 700;
    letter-spacing: 0.5px;
    cursor: pointer;
  }
  .checkin-reward { font-size:11px; color:var(--muted); text-align:center; margin-top:8px; }
  .checkin-reward strong { color: var(--np); }
  .np-text { color: var(--np); }

  .bond-row { display:flex; align-items:center; justify-content:space-between; margin-bottom:8px; }
  .bond-row-label { font-size:12px; color:var(--muted); }
  .bond-row-value { font-size:12px; font-weight:700; }
  .bar-track { height:5px; background:var(--lock); border-radius:3px; overflow:hidden; }
  .bar-fill { height:100%; border-radius:3px; background:var(--grad); }
  .bar-caption { display:flex; justify-content:space-between; margin-top:5px; font-size:10px; color:var(--muted); }
  .bar-caption span:last-child { color:var(--pink); }
</style>
