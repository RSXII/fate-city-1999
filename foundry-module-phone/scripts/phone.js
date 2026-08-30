// Fate City 1999 — Phone module
//
// Opens the already-deployed Wire PWA (GitHub Pages) inside a Foundry
// window, via a plain iframe. No auth to fight — Wire talks to its
// Firebase Realtime Database over unauthenticated REST, so whatever
// per-device codename/session already lives in this browser's
// localStorage for the Wire origin just carries over.
//
// Wrapped in an IIFE: classic (non-module) <script> tags share one global
// lexical scope for top-level let/const/class, so an unwrapped top-level
// `const MODULE_ID` here collides with any other installed module that
// picked the same name (fc99-bridge does exactly this) and throws a
// parse-time SyntaxError that kills the whole file before anything runs.
(() => {
  const MODULE_ID = 'fc99-phone';
  const CONTROL_LAYER_NAME = 'fc99PhoneLayer';

  // The Wire Phone control group has no real canvas tools, only an action
  // button — but Foundry's scene-control click handler only re-renders the
  // toolbar when the click actually causes a layer transition. Pointing
  // `layer` at an existing, already-active layer would make the click a
  // no-op. Registering a real (if empty) layer for the group to target
  // guarantees every click is a genuine transition. (Same pattern as
  // ../../foundryvtt-cpr-eventoverlay's CprEventOverlayLayer.)
  class Fc99PhoneLayer extends InteractionLayer {
    static get layerOptions() {
      return foundry.utils.mergeObject(super.layerOptions, { name: CONTROL_LAYER_NAME });
    }
  }

  // `id`/`title`/`url` are per-instance (passed via the constructor's options
  // and merged over defaultOptions by Foundry's own Application base class),
  // so the player's own phone and a hacked-device window can be open at the
  // same time without colliding on DOM id.
  class WirePhoneApp extends Application {
    static get defaultOptions() {
      return foundry.utils.mergeObject(super.defaultOptions, {
        id: 'fc99-phone-app',
        title: 'Wire',
        template: `modules/${MODULE_ID}/templates/phone.html`,
        classes: ['fc99-phone-app'],
        width: 400,
        height: 780,
        resizable: false,
        popOut: true,
      });
    }

    getData() {
      return { url: this.options.url };
    }
  }

  // Appends the hacked-device login route to the configured Wire URL — see
  // src/routes/hacked in the main app and docs/npc-device-hack-audit.md.
  // Foundry's role here is deliberately dumb: open a second window at this
  // URL, no credential checking or filtering logic lives in this module.
  function hackedDeviceUrl() {
    const base = game.settings.get(MODULE_ID, 'wireUrl').replace(/\/+$/, '');
    return `${base}/hacked`;
  }

  let phoneApp = null;
  let hackedApp = null;

  function togglePhone() {
    if (!phoneApp) {
      phoneApp = new WirePhoneApp({
        id: 'fc99-phone-app',
        title: 'Wire',
        url: game.settings.get(MODULE_ID, 'wireUrl'),
      });
    }
    if (phoneApp.rendered) phoneApp.close();
    else phoneApp.render(true);
  }

  function toggleHackedDevice() {
    if (!hackedApp) {
      hackedApp = new WirePhoneApp({
        id: 'fc99-hacked-phone-app',
        title: 'Hacked Device',
        url: hackedDeviceUrl(),
      });
    }
    if (hackedApp.rendered) hackedApp.close();
    else hackedApp.render(true);
  }

  Hooks.once('init', () => {
    game.settings.register(MODULE_ID, 'wireUrl', {
      name: 'Wire URL',
      hint: 'Address the phone window loads. Default is the public GitHub Pages build; point this at a LAN dev server (npm run dev) instead if you need one.',
      scope: 'world',
      config: true,
      type: String,
      default: 'https://rsxii.github.io/fate-city-1999/',
    });

    CONFIG.Canvas.layers[CONTROL_LAYER_NAME] = {
      layerClass: Fc99PhoneLayer,
      group: 'interface',
    };
  });

  Hooks.on('getSceneControlButtons', (controls) => {
    const group = {
      name: MODULE_ID,
      title: 'Wire Phone',
      icon: 'fa-solid fa-mobile-screen-button',
      layer: CONTROL_LAYER_NAME,
      tools: [
        {
          name: 'open',
          title: 'Open Wire Phone',
          icon: 'fa-solid fa-mobile-screen-button',
          button: true,
          onClick: togglePhone,
        },
        {
          name: 'hacked',
          title: 'Hacked Device',
          icon: 'fa-solid fa-terminal',
          button: true,
          onClick: toggleHackedDevice,
        },
      ],
    };

    // v12 passes an array; v13+ passes an object keyed by control name.
    if (Array.isArray(controls)) controls.push(group);
    else controls[group.name] = group;
  });
})();
