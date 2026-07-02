<!-- My ECHO tab — avatar, locked customization options -->
<div class="screen-echo">
  <div class="echo-avatar-wrap">
    <div class="echo-avatar-ring">
      <div class="echo-avatar-inner">
        <svg viewBox="0 0 60 60" width="50" height="50" fill="none">
          <defs>
            <linearGradient id="av-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#ff4d8e" />
              <stop offset="100%" stop-color="#4dd9ff" />
            </linearGradient>
          </defs>
          <circle cx="22" cy="25" rx="3.5" ry="4" fill="url(#av-grad)" />
          <circle cx="38" cy="25" rx="3.5" ry="4" fill="url(#av-grad)" />
          <path d="M 20 38 Q 30 46 40 38" stroke="url(#av-grad)" stroke-width="2.5" stroke-linecap="round" fill="none" />
        </svg>
      </div>
    </div>
    <div class="echo-name-display">ECHO-7</div>
    <div class="echo-package-current">Default &mdash; Free Tier</div>
  </div>

  <div class="card">
    <div class="lock-row">
      <div class="lock-row-left">
        <div class="lock-row-name">Name</div>
        <div class="lock-row-value">ECHO-7 (locked on free tier)</div>
      </div>
      <span class="lock-chip">200 NP</span>
    </div>
    <div class="lock-row">
      <div class="lock-row-left">
        <div class="lock-row-name">Voice Pack</div>
        <div class="lock-row-value">Standard (default)</div>
      </div>
      <span class="lock-chip">25 BT</span>
    </div>
    <div class="lock-row">
      <div class="lock-row-left">
        <div class="lock-row-name">Expression States</div>
        <div class="lock-row-value">4 of 12 unlocked</div>
      </div>
      <span class="lock-chip">8 RS each</span>
    </div>
    <div class="lock-row">
      <div class="lock-row-left">
        <div class="lock-row-name">Companion Drift</div>
        <div class="lock-row-value">Stabilization OFF — drifts every 30d</div>
      </div>
      <span class="lock-chip">500 NP/mo</span>
    </div>
    <div class="lock-row" style="border-bottom:none">
      <div class="lock-row-left">
        <div class="lock-row-name">Emotional Intimacy Tier</div>
        <div class="lock-row-value">Required for Memory Platinum</div>
      </div>
      <span class="lock-chip">12 RS/mo</span>
    </div>
  </div>

  <div class="section-label">Cosmetic Package</div>
  <div class="card">
    <div class="lock-row">
      <div class="lock-row-left">
        <div class="lock-row-name">Active Package</div>
        <div class="lock-row-value">Default (none equipped)</div>
      </div>
      <a href="#" style="color:var(--pink);font-size:11px;font-weight:700;text-decoration:none">Browse &rsaquo;</a>
    </div>
    <div class="lock-row">
      <div class="lock-row-left">
        <div class="lock-row-name">Devil Package</div>
        <div class="lock-row-value">Unleash your darker side.</div>
      </div>
      <span class="lock-chip">25 RS</span>
    </div>
    <div class="lock-row">
      <div class="lock-row-left">
        <div class="lock-row-name">Élégance</div>
        <div class="lock-row-value">Galvère collaboration</div>
      </div>
      <span class="lock-chip">40 RS</span>
    </div>
    <div class="lock-row">
      <div class="lock-row-left">
        <div class="lock-row-name">S-Cool Uniform</div>
        <div class="lock-row-value">Discipline. Style. Identity.</div>
      </div>
      <span class="lock-chip">20 RS</span>
    </div>
    <div class="lock-row" style="border-bottom:none">
      <div class="lock-row-left">
        <div class="lock-row-name">Till Plat Do Us Part</div>
        <div class="lock-row-value">Wedding package</div>
      </div>
      <span class="lock-chip">35 RS</span>
    </div>
  </div>
</div>

<style>
  .screen-echo { padding: 18px 16px 8px; }

  .echo-avatar-wrap { display:flex; flex-direction:column; align-items:center; padding:20px 0 16px; }
  .echo-avatar-ring { width:90px; height:90px; border-radius:50%; background:var(--grad); padding:2px; }
  .echo-avatar-inner { width:100%; height:100%; border-radius:50%; background:var(--bg); display:flex; align-items:center; justify-content:center; }
  .echo-name-display {
    margin-top: 10px;
    font-size: 18px;
    font-weight: 700;
    background: var(--grad);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  .echo-package-current { margin-top:4px; font-size:11px; color:var(--muted); }

  .card { background:var(--surface); border:1px solid var(--border); border-radius:14px; padding:0 16px; margin-bottom:10px; }
  .section-label { font-size:10px; letter-spacing:2px; text-transform:uppercase; color:var(--muted); margin:18px 0 10px; }

  .lock-row { display:flex; align-items:center; justify-content:space-between; padding:12px 0; border-bottom:1px solid var(--border); }
  .lock-row-left { display:flex; flex-direction:column; gap:3px; }
  .lock-row-name { font-size:13px; font-weight:500; }
  .lock-row-value { font-size:11px; color:var(--muted); }
  .lock-chip {
    font-size: 10px;
    font-weight: 700;
    color: var(--rs);
    border: 1px solid rgba(199,125,255,0.4);
    padding: 4px 9px;
    border-radius: 8px;
    white-space: nowrap;
  }
</style>
