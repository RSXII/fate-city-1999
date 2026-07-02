<!-- Settings tab — account, subscription, about, Nexkin footer -->
<div class="screen-settings">
  <div class="settings-hero">
    <div class="tier-pill">Free Tier</div>
    <button class="settings-upgrade">Upgrade to Premium</button>
  </div>

  <div class="card">
    <div class="lock-row">
      <div class="lock-row-left">
        <div class="lock-row-name">Account</div>
        <div class="lock-row-value">Linked to Wire ID</div>
      </div>
    </div>
    <div class="lock-row">
      <div class="lock-row-left">
        <div class="lock-row-name">Subscription</div>
        <div class="lock-row-value">Free &mdash; billed never</div>
      </div>
      <a href="#" style="color:var(--pink);font-size:11px;font-weight:700;text-decoration:none">Change &rsaquo;</a>
    </div>
    <div class="lock-row">
      <div class="lock-row-left">
        <div class="lock-row-name">Network Verification</div>
        <div class="verify-row" style="margin-top:3px">
          <span class="verify-dot"></span>
          <span class="verify-label" style="font-size:11px;color:var(--muted)">Connected</span>
          <span class="verify-time">Last check: just now</span>
        </div>
      </div>
    </div>
    <div class="lock-row">
      <div class="lock-row-left">
        <div class="lock-row-name">EchoLink OS</div>
        <div class="lock-row-value">Version 2.7.4 &mdash; up to date</div>
      </div>
    </div>
    <div class="lock-row" style="border-bottom:none">
      <div class="lock-row-left">
        <div class="lock-row-name">MoodLog Sync</div>
        <div class="lock-row-value">Enabled &mdash; syncing emotional patterns</div>
      </div>
      <a href="#" style="color:var(--muted);font-size:11px;font-weight:700;text-decoration:none">Manage &rsaquo;</a>
    </div>
  </div>

  <div class="section-label">About</div>
  <div class="card">
    <div class="lock-row">
      <div class="lock-row-left">
        <div class="lock-row-name">EverNear</div>
        <div class="lock-row-value">A Nexkin Inc. product</div>
      </div>
    </div>
    <div class="lock-row" style="border-bottom:none">
      <div class="lock-row-left">
        <div class="lock-row-name">Infrastructure</div>
        <div class="lock-row-value">S.K.AM Technologies (network licensing only)</div>
      </div>
    </div>
  </div>

  <div class="nexkin-footer">
    <strong>NEXKIN INC.</strong><br />
    <span style="margin-top:4px;display:block">Why be lonely, when you can be billed?</span>
  </div>
  <div class="tos-row">
    <a class="tos-link" href="#">Terms of Service</a>
    &nbsp;&middot;&nbsp;
    <a class="tos-link" href="#">Privacy Policy</a>
    &nbsp;&middot;&nbsp;
    <a class="tos-link" href="#">Refund Policy</a>
  </div>
  <div style="height:16px"></div>
</div>

<style>
  .screen-settings { padding: 18px 16px 8px; }
  .section-label { font-size:10px; letter-spacing:2px; text-transform:uppercase; color:var(--muted); margin:18px 0 10px; }

  .settings-hero { display:flex; flex-direction:column; align-items:center; padding:20px 0 16px; gap:10px; }
  .tier-pill { font-size:10px; font-weight:700; letter-spacing:2px; text-transform:uppercase; color:var(--muted); border:1px solid var(--border); padding:5px 14px; border-radius:20px; }
  .settings-upgrade { border:none; border-radius:12px; background:var(--grad); color:#fff; font-size:13px; font-weight:700; padding:12px 28px; cursor:pointer; letter-spacing:0.3px; }

  .card { background:var(--surface); border:1px solid var(--border); border-radius:14px; padding:0 16px; margin-bottom:10px; }
  .lock-row { display:flex; align-items:center; justify-content:space-between; padding:12px 0; border-bottom:1px solid var(--border); }
  .lock-row-left { display:flex; flex-direction:column; gap:3px; }
  .lock-row-name { font-size:13px; font-weight:500; }
  .lock-row-value { font-size:11px; color:var(--muted); }

  .verify-row { display:flex; align-items:center; gap:8px; }
  .verify-dot { width:8px; height:8px; border-radius:50%; background:#2ecc71; animation:verify-pulse 2.5s ease-in-out infinite; }
  @keyframes verify-pulse {
    0%,100% { box-shadow:0 0 0 0 rgba(46,204,113,0.45); }
    50% { box-shadow:0 0 0 5px rgba(46,204,113,0); }
  }
  .verify-label { font-size:12px; }
  .verify-time { font-size:11px; color:var(--muted); margin-left:auto; }

  .nexkin-footer { text-align:center; padding:28px 0 6px; font-size:10px; letter-spacing:1px; color:var(--muted); }
  .nexkin-footer strong { color:var(--cyan); }
  .tos-row { text-align:center; margin-top:8px; }
  .tos-link { font-size:11px; color:var(--muted); text-decoration:underline; text-underline-offset:2px; }
</style>
