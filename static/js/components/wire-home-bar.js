// ── Wire Home Bar ─────────────────────────────────────────────────────────────
// Renders the bottom home-indicator bar.
//
// Attributes
//   layout="flex" – flex-item mode (no fixed positioning)
//   href          – string – if set, renders the bar as an <a> element
//                   (used by once.html which navigates to index.html)

class WireHomeBar extends HTMLElement {
  connectedCallback() {
    const href = this.getAttribute("href");

    if (href) {
      this.innerHTML = `<a class="wire-home" href="${href}" aria-label="Home"><div class="wire-home-ind" aria-hidden="true"></div></a>`;
    } else {
      this.innerHTML = `<div class="wire-home"><div class="wire-home-ind" aria-hidden="true"></div></div>`;
    }
  }
}

customElements.define("wire-home-bar", WireHomeBar);
