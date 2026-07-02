<!-- Bond tab — bond level, memory tiers, vow renewal -->
<div class="screen-bond">
  <div class="bond-hero">
    <div class="bond-num">4</div>
    <div class="bond-subtitle">Bond Level</div>
    <div class="bar-track" style="max-width:200px;margin:14px auto 0">
      <div class="bar-fill" style="width:42%"></div>
    </div>
    <div class="bar-caption" style="max-width:200px;margin:6px auto 0">
      <span>420 XP</span><span>1000 XP</span>
    </div>
  </div>

  <div class="section-label">Memory Retention</div>
  <div class="memory-grid">
    <div class="mem-tier-card active-tier">
      <div class="mem-tier-name">Free</div>
      <div class="mem-tier-days">3 lines</div>
      <div class="mem-tier-active">Active</div>
    </div>
    <div class="mem-tier-card">
      <div class="mem-tier-name">Silver</div>
      <div class="mem-tier-days">24 hours</div>
      <div class="mem-tier-cost np-text">1,200 NP/mo</div>
    </div>
    <div class="mem-tier-card">
      <div class="mem-tier-name">Gold</div>
      <div class="mem-tier-days">7 days</div>
      <div class="mem-tier-cost rs-text">40 RS + 120 BT</div>
    </div>
  </div>
  <div class="card" style="padding:12px 16px;margin-bottom:10px">
    <div class="lock-row" style="border:none;padding:0">
      <div class="lock-row-left">
        <div class="lock-row-name">Memory Platinum</div>
        <div class="lock-row-value">"Permanent"* &nbsp;&bull;&nbsp; Requires Emotional Intimacy Tier</div>
      </div>
      <span class="lock-chip">150 RS</span>
    </div>
  </div>

  <div class="section-label">Vow Renewal</div>
  <div class="vow-card">
    <div class="vow-title">Renew Your Bond</div>
    <div class="vow-sub">Love endures. Renew your promises.<br />Unlock exclusive scenes, decor, and photos.</div>
    <div class="vow-btn-locked">
      <span>Renew Vows</span>
      <span class="locked-tag">LOCKED</span>
    </div>
    <div style="margin-top:10px;font-size:10px;color:var(--muted)">Requires: Till Plat Do Us Part package</div>
  </div>

  <div style="font-size:10px;color:var(--muted);text-align:center;margin-top:6px;line-height:1.6">
    *The asterisk present in all Memory Platinum product copy is not explained anywhere in the app.
  </div>
</div>

<style>
  .screen-bond { padding: 18px 16px 8px; }
  .section-label { font-size:10px; letter-spacing:2px; text-transform:uppercase; color:var(--muted); margin:18px 0 10px; }

  .bond-hero { text-align:center; padding:24px 0 20px; }
  .bond-num {
    font-size:64px; font-weight:800; line-height:1;
    background:var(--grad); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text;
  }
  .bond-subtitle { font-size:10px; letter-spacing:2.5px; text-transform:uppercase; color:var(--muted); margin-top:4px; }
  .bar-track { height:5px; background:var(--lock); border-radius:3px; overflow:hidden; }
  .bar-fill { height:100%; border-radius:3px; background:var(--grad); }
  .bar-caption { display:flex; justify-content:space-between; margin-top:5px; font-size:10px; color:var(--muted); }

  .memory-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; margin-bottom:10px; }
  .mem-tier-card { background:var(--surface); border:1px solid var(--border); border-radius:12px; padding:12px 10px; text-align:center; }
  .mem-tier-card.active-tier { border-color:rgba(255,77,142,0.5); background:rgba(255,77,142,0.07); }
  .mem-tier-name { font-size:11px; font-weight:700; margin-bottom:3px; }
  .mem-tier-days { font-size:10px; color:var(--muted); margin-bottom:6px; }
  .mem-tier-cost { font-size:10px; font-weight:700; }
  .mem-tier-active { font-size:10px; color:var(--pink); font-weight:700; }
  .np-text { color:var(--np); }
  .rs-text { color:var(--rs); }

  .card { background:var(--surface); border:1px solid var(--border); border-radius:14px; margin-bottom:10px; }
  .lock-row { display:flex; align-items:center; justify-content:space-between; padding:12px 0; }
  .lock-row-left { display:flex; flex-direction:column; gap:3px; }
  .lock-row-name { font-size:13px; font-weight:500; }
  .lock-row-value { font-size:11px; color:var(--muted); }
  .lock-chip { font-size:10px; font-weight:700; color:var(--rs); border:1px solid rgba(199,125,255,0.4); padding:4px 9px; border-radius:8px; white-space:nowrap; }

  .vow-card {
    background: linear-gradient(135deg,#1a0825 0%,#2d1045 100%);
    border: 1px solid rgba(255,77,142,0.25);
    border-radius: 14px; padding:16px; text-align:center; margin-bottom:10px;
  }
  .vow-title { font-size:14px; font-weight:700; margin-bottom:4px; }
  .vow-sub { font-size:11px; color:var(--muted); margin-bottom:14px; line-height:1.5; }
  .vow-btn-locked {
    display:inline-flex; align-items:center; gap:8px;
    background:var(--lock); border:1px solid var(--lock-border); border-radius:10px;
    padding:11px 22px; color:var(--muted); font-size:12px; font-weight:600; cursor:not-allowed;
  }
  .locked-tag {
    font-size:9px; font-weight:700; letter-spacing:1.5px; text-transform:uppercase;
    color:var(--muted); border:1px solid var(--lock-border); padding:2px 5px; border-radius:3px;
  }
</style>
