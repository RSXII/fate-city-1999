// ── Wire Header ───────────────────────────────────────────────────────────────
// Renders the app-level header bar (back button, title, optional subtitle).
//
// Attributes
//   back          – string  – href for the back button (required for back nav)
//   title         – string  – header title text (required)
//   subtitle      – string  – optional subtitle line below title
//   icon          – boolean – shows the gradient dot before the title
//   more          – boolean – shows the ⋮ overflow button on the right
//   layout="flex" – flex-item mode (no fixed positioning)

class WireHeader extends HTMLElement {
  connectedCallback() {
    const back = this.getAttribute("back");
    const title = this.getAttribute("title") || "";
    const subtitle = this.getAttribute("subtitle") || "";
    const icon = this.hasAttribute("icon");
    const more = this.hasAttribute("more");

    const backBtn = back
      ? `<a class="wire-hdr-back" href="${back}" aria-label="Back">\u2039</a>`
      : "";

    const iconEl = icon
      ? '<span class="wire-hdr-icon" aria-hidden="true"></span>'
      : "";

    const subtitleEl = subtitle
      ? `<div class="wire-hdr-sub">${subtitle}</div>`
      : "";

    const moreEl = more
      ? '<span class="wire-hdr-more" aria-hidden="true">\u22EE</span>'
      : "";

    this.innerHTML = `
      <div class="wire-header">
        ${backBtn}
        <div class="wire-hdr-text">
          <div class="wire-hdr-title">${iconEl}${title}</div>
          ${subtitleEl}
        </div>
        ${moreEl}
      </div>
    `;
  }
}

customElements.define("wire-header", WireHeader);
