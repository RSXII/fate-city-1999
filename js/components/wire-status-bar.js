// ── Wire Status Bar ───────────────────────────────────────────────────────────
// Renders the accent line + status bar (signal, clock, battery).
//
// Attributes
//   jail          – boolean – shows JAILBROKEN badge
//   app-label     – string  – shows a purple app label instead (e.g. "O.N.C.E.")
//   layout="flex" – flex-item mode (no fixed positioning)

class WireStatusBar extends HTMLElement {
  connectedCallback() {
    const jail = this.hasAttribute("jail");
    const appLabel = this.getAttribute("app-label");

    const badge = jail
      ? '<span class="wire-jail">JAILBROKEN</span>'
      : appLabel
        ? `<span class="wire-app-label">${appLabel}</span>`
        : "";

    this.innerHTML = `
      <div class="wire-once" aria-hidden="true"></div>
      <div class="wire-status">
        <div class="wire-status-left">
          <div class="wire-sig" aria-label="Signal">
            <span style="height:4px"></span>
            <span style="height:6px"></span>
            <span style="height:9px"></span>
            <span style="height:11px"></span>
            <span style="height:12px;opacity:.28"></span>
          </div>
          <span class="wire-skam">S.K.AM</span>
          ${badge}
        </div>
        <span class="wire-clock" id="wire-clock"></span>
        <div class="wire-status-right">
          <div class="wire-batt" aria-label="Battery">
            <div class="wire-batt-fill"></div>
          </div>
        </div>
      </div>
    `;
  }
}

customElements.define("wire-status-bar", WireStatusBar);
