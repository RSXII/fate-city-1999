// ── Banner configs — data-driven gacha ───────────────────────────────────────
// Each banner drives the entire gacha page: theme, copy, pool, and roll logic.
// The gacha page reads ?banner= and looks up BANNERS[id].

export const BANNERS = {
  echo7: {
    id: "echo7",
    // Wire header
    headerTitle: "Resonance Pull",
    headerSubtitle: "EverNear \u2014 Agent ECHO-7 Banner",
    // Page content
    title: "Agent ECHO-7",
    subtitle:
      "Pull for exclusive Season of Tender\u2122 cosmetics, voice packs, and " +
      "limited memory keepsakes. These items will not return after the event ends.",
    videoSrc: "images/evernear/gacha-agent-banner.mp4",
    audioSrc: "sounds/agent_echo7_theme.mp3",
    // CSS custom properties applied to the page wrapper
    cssVars: {
      "--banner-accent": "#b8962a",
      "--banner-dim": "rgba(184,150,42,0.18)",
      "--banner-alt": "#0dd4c8",
      "--banner-grad": "linear-gradient(135deg,#b8962a,#0dd4c8,#a855f7)",
      "--banner-insuf": "var(--pink)",
    },
    // Intro overlay
    intro: {
      icon: "\ud83d\udd75\ufe0f", // 🕵️
      eyebrow: "EverNear",
      headline: ["Operation", "ECHO-7"],
      tapText: "Tap to begin mission",
    },
    // Rate chips shown above pull buttons
    rates: [
      {
        label: "\u2605\u2605\u2605",
        pct: "1.6%",
        colorVar: "var(--rs)",
        small: false,
      },
      {
        label: "\u2605\u2605",
        pct: "13.0%",
        colorVar: "var(--purple)",
        small: false,
      },
      { label: "\u2605", pct: "85.4%", colorVar: "var(--bt)", small: false },
    ],
    featured: null, // no featured section for this banner
    pityMax: 80,
    costSingle: 3,
    costMulti: 25,
    multiGuaranteeDesc: "1 \u2605\u2605 or higher guaranteed",
    finePrint:
      "Pity resets to 0 after a \u2605\u2605\u2605 pull. Guaranteed \u2605\u2605\u2605 at 80 pulls.\n" +
      "All items are cosmetic and non-transferable. No refunds on pulls.",
    pool: {
      rs: [
        { icon: "\ud83d\udcab", name: "Starlight Veil", rarity: "rs" },
        { icon: "\ud83c\udf38", name: "Tender Bloom Voice", rarity: "rs" },
        { icon: "\u2728", name: "\u00c9clat Memory Frame", rarity: "rs" },
      ],
      purple: [
        { icon: "\ud83c\udf80", name: "Lace Accent Pack", rarity: "purple" },
        { icon: "\ud83c\udf19", name: "Moonrise Expression", rarity: "purple" },
        { icon: "\ud83e\udd8b", name: "Flutter Gesture Set", rarity: "purple" },
        { icon: "\ud83c\udf37", name: "Petal Theme", rarity: "purple" },
      ],
      bt: [
        { icon: "\ud83d\udca0", name: "BondToken \xd75", rarity: "bt" },
        { icon: "\ud83d\udd37", name: "BondToken \xd73", rarity: "bt" },
        { icon: "\ud83d\udd39", name: "NP \xd720", rarity: "bt" },
        { icon: "\u26a1", name: "Energy Shard", rarity: "bt" },
        { icon: "\ud83c\udfb5", name: "Audio Clip", rarity: "bt" },
        { icon: "\ud83d\udcce", name: "Memory Clip", rarity: "bt" },
      ],
    },
    rollOne(pityCount, forceUpgrade) {
      let pity = pityCount + 1;
      let roll;
      if (pity >= 80) {
        const arr = this.pool.rs;
        return {
          item: arr[Math.floor(Math.random() * arr.length)],
          newPity: 0,
        };
      }
      const r = Math.random() * 100;
      if (r < 1.6) {
        roll = "rs";
      } else if (r < 14.6) {
        roll = "purple";
      } else {
        roll = "bt";
      }
      if (forceUpgrade && roll === "bt") roll = "purple";
      const newPity = roll === "rs" ? 0 : pity;
      const arr = this.pool[roll];
      return { item: arr[Math.floor(Math.random() * arr.length)], newPity };
    },
  },

  nyan: {
    id: "nyan",
    headerTitle: "Resonance Pull",
    headerSubtitle: "EverNear \u2014 Nyan Nyan Racer Banner",
    title: "Nyan Nyan Racer",
    subtitle:
      "Exclusive collab cosmetics, voice packs, and racing-themed memory frames. " +
      "Pull for limited items unavailable anywhere else. This banner will not return after it ends.",
    videoSrc: "images/evernear/gacha-nyan-banner.mp4",
    audioSrc: "sounds/nyannyan_theme.mp3",
    cssVars: {
      "--banner-accent": "#39ff14",
      "--banner-dim": "rgba(57,255,20,0.18)",
      "--banner-alt": "#ff3a3a",
      "--banner-grad": "linear-gradient(135deg,#ff3a3a,#ff4d8e,#39ff14)",
      "--banner-insuf": "#ff3a3a",
    },
    intro: {
      icon: "\ud83d\udc31", // 🐱
      eyebrow: "Fate City Records \xd7 EverNear",
      headline: ["Prepare", "For Speed"],
      tapText: "Tap anywhere to begin",
    },
    rates: [
      {
        label: "Full Pack 5\u2605",
        pct: "0.01%",
        colorVar: "var(--rs)",
        small: true,
      },
      { label: "5\u2605", pct: "1.59%", colorVar: "var(--rs)", small: false },
      {
        label: "4\u2605",
        pct: "13.0%",
        colorVar: "var(--purple)",
        small: false,
      },
      { label: "3\u2605", pct: "85.4%", colorVar: "var(--bt)", small: false },
    ],
    featured: [
      { icon: "\ud83d\udc31", name: "Full Racer Pack", rarity: "5" },
      { icon: "\ud83c\udfa4", name: "Drift Voice Pack", rarity: "5" },
      { icon: "\ud83c\udfc1", name: "Checkered Visor", rarity: "5" },
      { icon: "\ud83c\udfb5", name: "FCR Album Theme", rarity: "5" },
    ],
    pityMax: 80,
    costSingle: 3,
    costMulti: 25,
    multiGuaranteeDesc: "1 4\u2605 or higher guaranteed",
    finePrint:
      "Pity resets to 0 after a 5\u2605 pull. Guaranteed 5\u2605 at 80 pulls.\n" +
      "Pity does not carry over between banners. All items are cosmetic and non-transferable.",
    pool: {
      five_featured: {
        icon: "\ud83d\udc31",
        name: "Full Racer Pack",
        rarity: "5",
      },
      five_std: [
        { icon: "\ud83c\udfa4", name: "Drift Voice Pack", rarity: "5" },
        { icon: "\ud83c\udfc1", name: "Checkered Visor", rarity: "5" },
        { icon: "\ud83c\udfb5", name: "FCR Album Theme", rarity: "5" },
      ],
      five: [
        { icon: "\ud83d\udc31", name: "Full Racer Pack", rarity: "5" },
        { icon: "\ud83c\udfa4", name: "Drift Voice Pack", rarity: "5" },
        { icon: "\ud83c\udfc1", name: "Checkered Visor", rarity: "5" },
        { icon: "\ud83c\udfb5", name: "FCR Album Theme", rarity: "5" },
      ],
      four: [
        { icon: "\ud83c\udfce\ufe0f", name: "Racing Stripe Expr", rarity: "4" },
        { icon: "\ud83d\udc3e", name: "Cat Ear Crown", rarity: "4" },
        { icon: "\ud83d\udca8", name: "Speed Blur Trail", rarity: "4" },
        { icon: "\ud83c\udfb6", name: "Engine Beat Loop", rarity: "4" },
        { icon: "\ud83d\udd34", name: "Turbo LED Eyes", rarity: "4" },
      ],
      three: [
        { icon: "\ud83d\udca0", name: "BondToken \xd75", rarity: "3" },
        { icon: "\ud83d\udd37", name: "BondToken \xd73", rarity: "3" },
        { icon: "\ud83d\udd39", name: "NP \xd720", rarity: "3" },
        { icon: "\ud83c\udff7\ufe0f", name: "Pit Stop Sticker", rarity: "3" },
        { icon: "\ud83c\udfa9", name: "Rev Audio Clip", rarity: "3" },
        { icon: "\ud83d\udcce", name: "Memory Clip", rarity: "3" },
      ],
    },
    rollOne(pityCount, forceUpgrade) {
      let pity = pityCount + 1;
      if (pity >= 80) {
        const arr = this.pool.five;
        return {
          item: arr[Math.floor(Math.random() * arr.length)],
          newPity: 0,
        };
      }
      const r = Math.random() * 100;
      if (r < 0.01) {
        return { item: this.pool.five_featured, newPity: 0 };
      } else if (r < 1.6) {
        const arr = this.pool.five_std;
        return {
          item: arr[Math.floor(Math.random() * arr.length)],
          newPity: 0,
        };
      } else if (r < 14.6) {
        const arr = this.pool.four;
        return {
          item: arr[Math.floor(Math.random() * arr.length)],
          newPity: pity,
        };
      } else {
        const tier = forceUpgrade ? this.pool.four : this.pool.three;
        return {
          item: tier[Math.floor(Math.random() * tier.length)],
          newPity: pity,
        };
      }
    },
  },
};
