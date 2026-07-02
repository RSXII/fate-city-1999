// ── EverNear active-tab store ─────────────────────────────────────────────────
// Persists to sessionStorage so navigating away (e.g. to gacha) and back
// restores the player to the same tab they left.

import { writable } from "svelte/store";

const KEY = "evernear-active-tab";

function createTabStore() {
  const initial =
    (typeof sessionStorage !== "undefined"
      ? sessionStorage.getItem(KEY)
      : null) ?? "home";

  const { subscribe, set } = writable(initial);

  return {
    subscribe,
    set(val) {
      if (typeof sessionStorage !== "undefined") {
        sessionStorage.setItem(KEY, val);
      }
      set(val);
    },
  };
}

export const activeTab = createTabStore();
