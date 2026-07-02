// ── Wire Clock — shared status-bar clock ─────────────────────────────────────
// Import and call startClock() once per page.  Safe to call multiple times
// (subsequent calls clear the previous interval).

var _clockInterval = null;

export function startClock() {
  function tick() {
    var el = document.getElementById("wire-clock");
    if (!el) return;
    var n = new Date();
    var h = String(n.getHours()).padStart(2, "0");
    var m = String(n.getMinutes()).padStart(2, "0");
    el.textContent = h + ":" + m;
  }
  tick();
  if (_clockInterval) clearInterval(_clockInterval);
  _clockInterval = setInterval(tick, 15000);
  return function stopClock() {
    if (_clockInterval) {
      clearInterval(_clockInterval);
      _clockInterval = null;
    }
  };
}
