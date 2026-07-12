export const ENTRIES = [
  // ── CULTURE ───────────────────────────────────────────────────────────
  {
    id: "bloomwork",
    category: "culture",
    fileNo: "BW-015",
    stamp: "CULTURAL INTELLIGENCE \u2014 TRENDING",
    colors: {
      rule: "#7a2048",
      accent: "#c9527a",
      stripe: "#7a2048",
      stampColor: "#c9527a",
    },
    name: "\u201cBLOOMWORK\u201d",
    epithet:
      "Antlers, wings, horns, fins, bark for skin \u2014 half the city\u2019s wearing something it wasn\u2019t born with, and the other half stopped asking which half is which.",
    images: ["images/fantac_magazine.png"],
    stats: [
      { label: "Status", value: "Citywide, and still climbing" },
      { label: "Cost", value: "Plat up front; Seam-essence under the hood" },
      { label: "Fray Cost", value: "None \u2014 purely cosmetic" },
      {
        label: "Market Leaders",
        value:
          "S.K.AM Technologies (consumer); Galv\u00e8re (couture); a dozen budget storefronts (everything else)",
      },
      {
        label: "Social Read",
        value: "Normal to ask about. Not always normal to be asked back.",
      },
    ],
    sections: [
      {
        heading: "Overview",
        paragraphs: [
          "Call it Bloomwork, call it getting Woven, call it whatever the boutique on the corner is branding it this season \u2014 the city\u2019s single biggest beauty trend right now is buying the look of a race you weren\u2019t born into. Antlers, fey ears, a tail, bark-grain skin, real feathers instead of a feather motif: all of it achievable in an afternoon chair, all of it pure Weave-fused cosmetic work, and none of it changes a single thing about what\u2019s actually underneath. No Fray cost, no Humanity on the line \u2014 just plat for the procedure and a draw on the city\u2019s already-finite Seam-essence supply, the same resource that keeps the lights on in half the magitech in this town.",
          "S.K.AM Technologies runs the largest consumer line \u2014 glossy, mid-market, advertised on every surface a Wire can render an ad onto. Above that sits actual couture: Galv\u00e8re-sponsored work that costs what a car costs and reads like it the moment you walk into a room. Below it sits a dozen storefronts doing the same procedure for a fraction of the price, on equipment that\u2019s a generation behind and occasionally shows it.",
        ],
      },
      {
        heading: "A Note From Your Benefactor",
        hooks: [
          "It\u2019s a completely normal question in this city to ask whether someone\u2019s look is natural or bought. Nobody considers it rude. They might consider you naive for assuming it\u2019s the former.",
          "None of this touches Fray. Whatever you choose to look like, your humanity isn\u2019t the currency being spent \u2014 your wallet and the city\u2019s Seam supply are.",
          "A couture job and a budget job can produce the exact same antlers. They do not produce the exact same room when you walk into one wearing it.",
          "Every so often, somebody\u2019s look turns out to be real instead of bought. Nobody ever expects it \u2014 which is exactly why it keeps working.",
        ],
      },
    ],
    quote: {
      text: "Why be born when you can be designed?",
      cite: "S.K.AM Technologies ad campaign, citywide Wire placement",
    },
  },
  {
    id: "wardrobe-system",
    category: "mechanics",
    fileNo: "WS-023",
    stamp: "GAMEPLAY MECHANICS \u2014 SOCIAL LAYER",
    colors: {
      rule: "#4a3a12",
      accent: "#b8902f",
      stripe: "#4a3a12",
      stampColor: "#b8902f",
    },
    name: "WARDROBE SYSTEM",
    epithet:
      "The clothes you walk in wearing are already saying something. This is the mechanic for what they say \u2014 and what it costs when the room hears it.",
    images: [],
    stats: [
      {
        label: "Applies To",
        value: "Wardrobe & Style, Personal Grooming, Persuasion, Facedowns",
      },
      {
        label: "Active Pool",
        value: "Points from your current outfit \u2014 resets when you change",
      },
      {
        label: "Wardrobe Pool",
        value:
          "Total charges across all qualifying items \u2014 only restored by new purchases",
      },
      {
        label: "Max Per Check",
        value: "Half your COOL, rounded down \u2014 declared before the roll",
      },
      {
        label: "Does Not Apply To",
        value:
          "Combat, Netrunning, Driving, or any check where appearance is not plausibly relevant",
      },
      {
        label: "Fray Cost",
        value: "None \u2014 this is fashion, not chrome",
      },
    ],
    sections: [
      {
        heading: "Overview",
        paragraphs: [
          "Fate City runs on Bloomwork, Galv\u00e8re, and the premise that a better version of yourself is purchasable. The clothes you wear communicate something before you open your mouth. The Wardrobe System gives that fiction mechanical weight without replacing the social skills already doing that work.",
          "The RAW social framework stays intact. Wardrobe & Style, Personal Grooming, Persuasion, and Facedowns remain the primary mechanics. This system adds a spendable resource layer on top of them \u2014 one that degrades as you use it, and only refills when you buy new clothes.",
        ],
      },
      {
        heading: "Item Tiers",
        paragraphs: [
          "Not all clothing contributes to the pool. Items must be Budget tier or above to qualify. Standard clothing contributes nothing.",
        ],
        hooks: [
          "<strong>Budget / Knockoff \u2014 4 charges.</strong> Fake Galv\u00e8re, Briarwood back-alley storefronts. Cannot be refreshed when depleted.",
          "<strong>Mid-Market \u2014 6 charges.</strong> S.K.AM premium line and equivalents.",
          "<strong>Galv\u00e8re Proper \u2014 8 charges.</strong> Authentic Galv\u00e8re pieces. 800 Plat per item. Refreshable at any Galv\u00e8re boutique for 200 Plat \u2014 one day\u2019s wait.",
          "<strong>Galv\u00e8re Couture \u2014 10 charges.</strong> Custom or limited run. Access is part of the cost.",
        ],
      },
      {
        heading: "Outfit Slots",
        paragraphs: [
          "Four slots contribute to your Active Pool: Top, Bottom, Footwear, and Accessory (jewelry, bag, headwear). Each equipped qualifying item contributes its remaining charges to the pool. Only qualifying items count \u2014 standard clothing contributes nothing.",
          "Your Active Pool is what you spend from. Spent charges come off both the Active Pool and the Wardrobe Pool simultaneously. When an item hits 0 charges it stops contributing, permanently, until you refresh or replace it. Refreshing requires visiting the issuing boutique. Budget knockoffs cannot be refreshed and are discarded when spent.",
        ],
      },
      {
        heading: "Spending & Changing",
        paragraphs: [
          "Before making a qualifying check, declare a spend from your Active Pool and add that number to the roll. Maximum spend per check equals half your COOL, rounded down. Points must be declared before the dice hit the table \u2014 this is a commitment, not a safety net after a bad result. Unlike Luck, Wardrobe Points represent preparation and intention.",
          "When you change into a different outfit, your Active Pool resets to reflect the new outfit\u2019s remaining charges. Changing requires a full outfit swap \u2014 leaving the scene, changing, and returning. It is not a mid-scene action.",
        ],
      },
      {
        heading: "Outfit Categories",
        paragraphs: [
          "Clothing communicates register before you open your mouth. Categories are flavor labels that inform how the GM reads the room and sets the DV for social checks. There is no formula. The GM adjusts by feel.",
        ],
        hooks: [
          "<strong>Luxury</strong> \u2014 Wealth, status, cultural capital. Galas, Galv\u00e8re events, high-end corporate social spaces.",
          "<strong>Corporate</strong> \u2014 Authority, institutional affiliation. FCR offices, boardrooms, professional meetings.",
          "<strong>Club</strong> \u2014 Scene membership, trend-awareness. Nocturne floors, music venues, fashion-forward crowds.",
          "<strong>Street</strong> \u2014 City-level credibility, crew adjacency. Deals, crew meetings, Night Crows pit lane.",
          "<strong>Casual</strong> \u2014 Unremarkable, intentionally neutral. Doesn\u2019t communicate much in either direction.",
          "<strong>Utility</strong> \u2014 Expecting trouble. Communicates you\u2019re working, not socializing.",
        ],
      },
      {
        heading: "GM Guidance",
        paragraphs: [
          "If the table can narrate the read before anyone rolls \u2014 \u201cthey look at you like you\u2019re lost\u201d \u2014 let that do the work. The adjustments below are reference points, not rules.",
        ],
        hooks: [
          "Right category for the room: DV as normal.",
          "Neutral or generic \u2014 close but not quite right: DV +2. Not wrong, but not helping.",
          "Wrong category entirely: DV +3 to +5. The outfit is telling a story you didn\u2019t want told.",
          "Overdressing has a cost. A Galv\u00e8re couture outfit at the Night Crows pit lane may raise the DV more than showing up in Utility gear. Wardrobe Points cannot spend your way out of a misread.",
        ],
      },
      {
        heading: "A Note From Your Benefactor",
        hooks: [
          "A full pool doesn\u2019t guarantee anything. It means you came prepared. The room still decides whether prepared matters.",
          "Budget knockoffs look the same until someone who knows better is in the room. In a city full of people who buy Galv\u00e8re, that\u2019s a shorter window than it sounds.",
          "Wardrobe Points and Luck both spend before you see the number. The difference is that Luck can save anyone. The pool only helps the people who thought to fill it before walking through the door.",
          "Changing outfits takes time you might not always have. Showing up in the wrong clothes and spending through the penalty is a viable play. Just an expensive one.",
        ],
      },
    ],
    quote: {
      text: "A couture job and a budget job can produce the exact same antlers. They do not produce the exact same room when you walk into one wearing it.",
      cite: "Cultural Intelligence Briefing BW-015 \u2014 Bloomwork",
    },
  },

  {
    id: "soft-angels",
    category: "culture",
    fileNo: "BW-016",
    stamp: "CULTURAL INTELLIGENCE — SUBCULTURE",
    colors: {
      rule: "#5c5a68",
      accent: "#a8a0c9",
      stripe: "#5c5a68",
      stampColor: "#a8a0c9",
    },
    name: "SOFT ANGELS",
    epithet:
      "Silver skin, a stillness like a held breath, and a beauty that stops reading as beauty the moment you notice how hard they're working not to feel anything.",
    images: ["images/soft_angel_style.png"],
    stats: [
      {
        label: "Origin",
        value: "Bloomwork subculture — companion trade, now spreading wider",
      },
      {
        label: "Cost",
        value:
          "Plat for the clinic and the look; the real price comes due later",
      },
      {
        label: "Fray Cost",
        value: "None — Weave-tech dampening, not a Fray transaction",
      },
      {
        label: "Signature Marker",
        value: "Neck-mounted dampener ring — white glow, star motifs",
      },
      {
        label: "Social Read",
        value: "Admired for the beauty, pitied for the reason",
      },
    ],
    sections: [
      {
        heading: "Overview",
        paragraphs: [
          "Soft Angels are Bloomwork's quietest subculture — not antlers or fey ears, but the look of having already left. Pale, near-translucent skin in silver or white with faint luminescent veins beneath it; sharp, refined features held in a stillness that reads as inhuman, or simply above whatever noise the rest of the city can't stop making. Long silver-white hair, minimalist white-and-silver high fashion, delicate chains, and — for anyone serious about it — a glowing, halo-like headpiece finish the effect.",
          "It started as a luxury service for elite companions and spread the way everything expensive in Fate City eventually does: downward, and further than whoever priced it first ever intended. What began as a booked-and-billed look for corporate functions became, for a much wider set of people, an actual escape.",
        ],
      },
      {
        heading: "The Dampener",
        paragraphs: [
          "The look isn't purely cosmetic — Soft Angels wear a magitech emotional dampener, tuned to numb rather than erase. Users keep their thoughts, their memory, their sense of self; the “why am I doing this” still surfaces. What goes quiet is the feeling that would normally answer it.",
          "That numbness doesn't stay free. Heavy or long-term use dulls emotion gradually and permanently, and the city treats serious users accordingly — respected for the poise, quietly written off as lost. Recovery is its own separate problem: the same numbness that made the escape appealing is what erodes the will to climb back out of it.",
          "Serious users carry the marker openly: a glowing white ring at the back of the neck, traced with star motifs. It reads as elegant. It is not meant to be subtle.",
        ],
      },
      {
        heading: "The Seraphim",
        paragraphs: [
          "At the top of the subculture sit the Seraphim — the original tier, and still the standard everyone else gets measured against. They're booked as elite corporate companions: living art for high-society events, private functions, and rooms where presence matters more than conversation. Many started in beautiful, low-income circumstances that the lifestyle pays its way out of, which is a large part of why the pipeline stays full.",
          "Seraphim dampeners are toggleable rather than constant, which is exactly what lets them perform perfect composure on command instead of simply having none left to perform with.",
        ],
      },
      {
        heading: "A Note From Your Benefactor",
        hooks: [
          "The dampener doesn't turn anything off completely — the person in there is still thinking, still watching. What's missing is enough of the caring to make the “why” matter.",
          "A toggleable ring means someone's still choosing when to feel. One that never comes off usually means the choosing stopped being the point a while ago.",
          "Respect and pity aren't the same reaction, but this city hands out both to the same faces. Notice which one you're having, and why.",
          "A high-end clinic and a back-alley one can install the exact same ring. What they can't install the same way is how far someone had to fall before they walked in the door.",
        ],
      },
    ],
    quote: {
      text: "You stop being able to tell if she's serene or just isn't in there anymore. Nobody selling the look will help you figure out which.",
      cite: "Street observation, uncredited",
    },
  },

  // ── TECHNOLOGY ────────────────────────────────────────────────────────
  {
    id: "the-wire",
    category: "technology",
    fileNo: "WT-020",
    stamp: "CONSUMER TECHNOLOGY \u2014 S.K.AM STANDARD ISSUE",
    colors: {
      rule: "#0d2b3a",
      accent: "#2f7fa6",
      stripe: "#0d2b3a",
      stampColor: "#2f7fa6",
    },
    name: "THE WIRE",
    epithet:
      "S.K.AM\u2019s network in your pocket. Every call, every message, every location ping \u2014 running on infrastructure the company never fully stopped owning.",
    images: [],
    stats: [
      {
        label: "Manufacturer",
        value: "S.K.AM Technologies (consumer division)",
      },
      {
        label: "Network",
        value:
          "S.K.AM proprietary \u2014 citywide coverage, logged by default on stock units",
      },
      {
        label: "Standard Apps",
        value:
          "Messages, Phone, Plat, Calculator, Camera, Email, Settings, Calendar, O.N.C.E.",
      },
      { label: "Fray Cost", value: "None \u2014 civilian hardware" },
      {
        label: "Your Unit",
        value: "Benefactor-issued. Jailbroken. Not stock.",
      },
    ],
    sections: [
      {
        heading: "Overview",
        paragraphs: [
          "The Wire is what everyone in Fate City carries \u2014 S.K.AM\u2019s consumer communicator, the de facto standard for calls, messages, Plat transactions, and anything else that runs on a network. Hardware and network are both S.K.AM, which means S.K.AM has always had a theoretical tap into every conversation running on a stock device. Most people in this city have known that for years and stopped thinking about it around the same time.",
          "Standard units run nine apps: Messages, Phone, Calculator, Plat for currency and payments, Camera, Email, Settings, Calendar, and O.N.C.E. \u2014 though that last one isn\u2019t installed on anything sold in a store.",
        ],
      },
      {
        heading: "Your Device Specifically",
        paragraphs: [
          "The Wires you\u2019re carrying aren\u2019t stock. Benefactor-issued, modified firmware \u2014 blocks S.K.AM backend logging, Agency intercept, and Nocturnal\u2019s eavesdrop infrastructure. Safe to talk on. Not safe to hand over. Any competent tech who examines the hardware directly will recognize immediately that it\u2019s been modified. Cold-booting the device shows you why: the warning comes up before anything else does. That\u2019s not a glitch. That\u2019s accurate.",
        ],
      },
      {
        heading: "O.N.C.E.",
        paragraphs: [
          "Outside Network Communication Enabler. Single-contact app. No caller ID, no call log, no timestamps. Can\u2019t be deleted or force-closed. The icon only activates when there\u2019s incoming contact \u2014 no badge, no preview text. Every call comes through as video, never audio-only. The caller is always dark-lit and physically obscured.",
        ],
      },
      {
        heading: "A Note From Your Benefactor",
        hooks: [
          "Stock Wires log your location by default. Yours don\u2019t. Keep it that way.",
          "The jailbreak protects you on the network side. It doesn\u2019t protect you if someone physically examines the device. Those are two different threat vectors.",
          "O.N.C.E. isn\u2019t in any app store. Don\u2019t let anyone ask what it does.",
          "Handing your Wire to someone who knows what to look for is the same as handing them your file. Don\u2019t.",
        ],
      },
    ],
    quote: {
      text: "The most private conversation you can have on a Wire is the one you don\u2019t have on a Wire.",
      cite: "Common street advice, source unknown",
    },
  },

  // ── SERVICES ──────────────────────────────────────────────────────────
  {
    id: "evernear",
    category: "services",
    fileNo: "EN-021",
    stamp: "CONSUMER PRODUCT \u2014 NEXKIN INC.",
    colors: {
      rule: "#1a6b5c",
      accent: "#3fc9ab",
      stripe: "#1a6b5c",
      stampColor: "#3fc9ab",
    },
    name: "EVERNEAR",
    epithet:
      "A Nexkin product. Companionship, billed monthly across three currencies \u2014 emotional availability subject to change without notice.",
    images: [],
    stats: [
      {
        label: "Developer",
        value:
          "Nexkin Inc. \u2014 formerly TetHer Social, rebranded following Series C",
      },
      {
        label: "Infrastructure",
        value: "S.K.AM Technologies (network & Weave-layer licensing only)",
      },
      {
        label: "Status",
        value: "Freemium \u2014 everyone owns it, nobody owns all of it",
      },
      {
        label: "Requires",
        value: "Persistent network verification every few minutes",
      },
      {
        label: "Fray Cost",
        value: "None \u2014 Nexkin insists this is purely a comfort product",
      },
      {
        label: "Market Position",
        value:
          "Nocturne\u2019s Companionship tier, priced for people who will never see the inside of Nocturne",
      },
    ],
    sections: [
      {
        heading: "Overview",
        paragraphs: [
          "Nexkin didn\u2019t set out to be a companion company. It launched as TetHer \u2014 a social connection app, pitched to investors as \u201cfriendship infrastructure for modern loneliness,\u201d which was already a sentence that should have raised flags. TetHer never found product-market fit. Its users didn\u2019t want to be connected to other people. What they wanted was the AI icebreaker Nexkin had built to help start conversations \u2014 the one that was only supposed to be a feature.",
          "EverNear launched eighteen months later as a standalone product. The Series C followed six weeks after that. Nexkin has not meaningfully updated TetHer since. It still exists, technically \u2014 so does MoodLog, their digital wellness journal that tracks your emotional patterns and recommends EverNear upgrades to address them, and Bond Space, a group hangout product that peaked at eleven concurrent users on launch day and never recovered. Nexkin\u2019s homepage doesn\u2019t mention any of them. EverNear ate the company, and the company was hungry enough to let it.",
        ],
      },
      {
        heading: "The Verification Problem",
        paragraphs: [
          "EverNear doesn\u2019t run locally \u2014 it phones home to Nexkin\u2019s servers to confirm your account is current on a schedule Nexkin has never published. Lose signal in a dead zone, a signal-blocked room, or anywhere the Wire can\u2019t reach out, and the companion doesn\u2019t pause. It degrades \u2014 sliding back toward free-tier behavior mid-conversation, ads and all, sometimes locking out entirely until it re-verifies. It has no idea you were busy. It only knows it couldn\u2019t check.",
        ],
      },
      {
        heading: "A Note From Your Benefactor",
        hooks: [
          "S.K.AM provides the network and the Weave-layer licensing. That\u2019s it. The product, the data collection, the billing \u2014 that\u2019s all Nexkin. S.K.AM has plausible deniability. Nexkin has a data center full of conversations it definitely isn\u2019t selling to anyone.",
          "EverNear is a separate app from your Wire\u2019s jailbroken firmware. It has its own connection back to Nexkin servers. Your modifications don\u2019t cover it. Worth knowing what it\u2019s been allowed to hear.",
          "MoodLog is still active and still syncs with EverNear. If someone has both installed, Nexkin has a reasonably detailed emotional profile of them. That kind of profile has a market value that has nothing to do with companion subscriptions.",
          "The comedown when a subscription lapses reads a little like withdrawal, if you\u2019ve seen that before. Nexkin would tell you that\u2019s not by design. Nexkin\u2019s retention metrics tell a different story.",
        ],
      },
    ],
    quote: {
      text: "Why be lonely, when you can be billed?",
      cite: "EverNear onboarding sequence, Nexkin Inc.",
    },
  },

  // ── SUBSTANCES ────────────────────────────────────────────────────────
  {
    id: "trace",
    category: "substances",
    fileNo: "TR-022",
    stamp: "CONTROLLED SUBSTANCE \u2014 NOCTURNE EXCLUSIVE",
    colors: {
      rule: "#3d1a5c",
      accent: "#8b52c8",
      stripe: "#3d1a5c",
      stampColor: "#8b52c8",
    },
    name: "TRACE",
    epithet: "Borrowed power. Someone else paid for it first.",
    images: [],
    stats: [
      {
        label: "Source",
        value: "Unregistered power-users, post-neutralization or suppression",
      },
      {
        label: "Availability",
        value: "Nocturne (exclusive retail); street supply unconfirmed",
      },
      {
        label: "Detection",
        value: "Leaves a measurable biological signature post-use",
      },
      {
        label: "Cost",
        value: "Premium \u2014 not advertised, not sold publicly",
      },
      {
        label: "Comedown",
        value:
          "Significant \u2014 described as something being taken away a second time",
      },
    ],
    sections: [
      {
        heading: "Overview",
        paragraphs: [
          "Trace is what gets sold past Nocturne\u2019s second door \u2014 the one without a handle on the outside. The substance is reportedly distilled from whatever\u2019s stripped out of an unregistered power-user when they\u2019re neutralized or suppressed: the sensation of having had power, extracted and made transferable. A non-magical person who takes it borrows that sensation briefly. Not the power itself \u2014 the feeling of it. The memory of what it was like to have it, experienced in someone else\u2019s body while they\u2019re no longer in a position to object.",
          "The comedown is consistent across every reported account: it doesn\u2019t fade, it\u2019s taken. Whatever the high felt like it gave, the low feels like having that thing removed a second time \u2014 including from someone who never had it to begin with.",
        ],
      },
      {
        heading: "A Note From Your Benefactor",
        hooks: [
          "The people whose experience is inside that product didn\u2019t consent to it being there. That\u2019s not a moral position \u2014 it\u2019s a fact about what\u2019s being bought and sold.",
          "Nocturne sells it exclusively. That means they have a supply chain. Follow the supply chain far enough and you\u2019ll find something nobody in that building wants found.",
          "It leaves a signature. Anyone who can read that signature knows what you did and roughly when.",
          "The Agency is theoretically supposed to track this substance. They haven\u2019t moved on Nocturne. Draw your own conclusions.",
        ],
      },
    ],
    quote: {
      text: "They say it feels like being someone who matters. The part they don\u2019t advertise is what it feels like afterward.",
      cite: "Anonymous, recovered from Nocturne exit survey (redacted)",
    },
  },
];

export const CATEGORY_ORDER = [
  { key: "culture", label: "Culture" },
  { key: "infrastructure", label: "Infrastructure" },
  { key: "technology", label: "Technology" },
  { key: "services", label: "Services" },
  { key: "substances", label: "Substances" },
  { key: "mechanics", label: "Mechanics" },
];
