// Pages can override the status-bar appearance by calling setStatusBar()
// from their own <script> before the layout mounts.
//
// Usage in a page:
//   import { setStatusBar } from '$lib/stores/statusBar.js';
//   setStatusBar({ appLabel: 'O.N.C.E.' });   // replaces default jail badge
//   setStatusBar({ jail: true });              // explicit (also the default)
//   setStatusBar({});                          // plain — no badge

import { writable } from 'svelte/store';

export const statusBarConfig = writable({ jail: true });

export function setStatusBar(config) {
  statusBarConfig.set(config);
}
