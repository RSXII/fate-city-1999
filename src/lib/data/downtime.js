// Character definitions and action catalogs for the Downtime system.
// Each character maps to a Wire device codename (uppercase).

export const CHARACTERS = {
  VAL: {
    codename: 'VAL',
    name: 'Val Hollow',
    role: 'ROCKERBOY',
    stats: [
      { key: 'fans',      label: 'FANS' },
      { key: 'plat',      label: 'PLAT ₱', currency: true },
      { key: 'practice',  label: 'PRACTICE' },
      { key: 'songs',     label: 'SONGS' },
      { key: 'venue',     label: 'VENUE' },
      { key: 'bandLeads', label: 'BAND LEADS' },
    ],
    statDefaults: { fans: 0, plat: 0, practice: 0, songs: 0, venue: 0, bandLeads: 0 },
    actions: [
      {
        id: 'practice_set',
        label: 'Practice Set',
        type: 'ROUTINE',
        description: 'Run through material solo. No crowd, no pressure.',
        rewardHint: '+1 Practice Token',
        outcome: { deltas: { practice: 1 } },
      },
      {
        id: 'write_material',
        label: 'Write Material',
        type: 'ROUTINE',
        description: 'The city gives you plenty to write about. Use it.',
        rewardHint: '+1 Song Token',
        outcome: { deltas: { songs: 1 } },
      },
      {
        id: 'scout_venue',
        label: 'Scout a Venue',
        type: 'PUSH',
        description: 'Walk the circuit looking for somewhere worth playing.',
        rewardHint: 'Unlock next venue tier',
        outcomes: {
          partial: { deltas: {} },
          success: { deltas: { venue: 1 } },
        },
      },
      {
        id: 'open_mic',
        label: 'Open Mic / Network',
        type: 'PUSH',
        description: "Show up. Play something short. See who's paying attention.",
        rewardHint: 'Roll to meet a band member lead',
        outcomes: {
          partial: { deltas: { fans: 10 } },
          success: { deltas: { fans: 30, bandLeads: 1 } },
        },
      },
      {
        id: 'play_a_gig',
        label: 'Play a Gig',
        type: 'SWING',
        description: 'Book a show and see what happens. Real crowd, real pressure.',
        rewardHint: 'Earn Plat + Fans — variable by roll',
        outcomes: {
          fail:    { deltas: {} },
          partial: { deltas: { plat: 100, fans: 15 } },
          success: { deltas: { plat: 300, fans: 50 } },
        },
      },
    ],
  },

  MIRAE: {
    codename: 'MIRAE',
    name: 'Mirae',
    role: 'NETRUNNER',
    stats: [
      { key: 'plat',     label: 'PLAT ₱', currency: true },
      { key: 'cafeRep',  label: 'CAFÉ REP' },
      { key: 'heat',     label: 'HEAT' },
      { key: 'progWork', label: 'PROG. WORK' },
      { key: 'staff',    label: 'STAFF' },
    ],
    statDefaults: { plat: 0, cafeRep: 0, heat: 0, progWork: 0, staff: 0 },
    actions: [
      {
        id: 'run_the_cafe',
        label: 'Run the Café',
        type: 'ROUTINE',
        description: 'Keep the doors open, orders moving, and the right kind of quiet.',
        rewardHint: '+Income, +Café Rep',
        outcome: { deltas: { plat: 150, cafeRep: 1 } },
      },
      {
        id: 'lay_low',
        label: 'Lay Low',
        type: 'ROUTINE',
        description: 'Cash only. No jobs, no trace, no footprint.',
        rewardHint: '−1 Heat',
        outcome: { deltas: { heat: -1 } },
      },
      {
        id: 'program_work',
        label: 'Program Work',
        type: 'ROUTINE',
        description: 'Late nights on development. The café closes, the terminal opens.',
        rewardHint: '+1 Program Progress',
        outcome: { deltas: { progWork: 1 } },
      },
      {
        id: 'netrunning_job',
        label: 'Netrunning Job',
        type: 'PUSH',
        description: "Take a contract. Punch through someone's ICE. Get paid.",
        rewardHint: 'Roll for payout',
        outcomes: {
          partial: { deltas: { plat: 200 } },
          success: { deltas: { plat: 450, cafeRep: 1 } },
        },
      },
      {
        id: 'hire_staff',
        label: 'Hire Staff',
        type: 'PUSH',
        description: "The café can't run on you alone. Put out feelers.",
        rewardHint: 'Roll to recruit café staff',
        outcomes: {
          partial: { deltas: {} },
          success: { deltas: { staff: 1 } },
        },
      },
    ],
  },

  M: {
    codename: 'M',
    name: 'M',
    role: 'NETRUNNER',
    stats: [
      { key: 'plat',     label: 'PLAT ₱', currency: true },
      { key: 'cafeRep',  label: 'CAFÉ REP' },
      { key: 'heat',     label: 'HEAT' },
      { key: 'progWork', label: 'PROG. WORK' },
      { key: 'staff',    label: 'STAFF' },
    ],
    statDefaults: { plat: 0, cafeRep: 0, heat: 0, progWork: 0, staff: 0 },
    actions: [
      {
        id: 'run_the_cafe',
        label: 'Run the Café',
        type: 'ROUTINE',
        description: 'Keep the doors open, orders moving, and the right kind of quiet.',
        rewardHint: '+Income, +Café Rep',
        outcome: { deltas: { plat: 150, cafeRep: 1 } },
      },
      {
        id: 'lay_low',
        label: 'Lay Low',
        type: 'ROUTINE',
        description: 'Cash only. No jobs, no trace, no footprint.',
        rewardHint: '−1 Heat',
        outcome: { deltas: { heat: -1 } },
      },
      {
        id: 'program_work',
        label: 'Program Work',
        type: 'ROUTINE',
        description: 'Late nights on development. The café closes, the terminal opens.',
        rewardHint: '+1 Program Progress',
        outcome: { deltas: { progWork: 1 } },
      },
      {
        id: 'netrunning_job',
        label: 'Netrunning Job',
        type: 'PUSH',
        description: "Take a contract. Punch through someone's ICE. Get paid.",
        rewardHint: 'Roll for payout',
        outcomes: {
          partial: { deltas: { plat: 200 } },
          success: { deltas: { plat: 450, cafeRep: 1 } },
        },
      },
      {
        id: 'hire_staff',
        label: 'Hire Staff',
        type: 'PUSH',
        description: "The café can't run on you alone. Put out feelers.",
        rewardHint: 'Roll to recruit café staff',
        outcomes: {
          partial: { deltas: {} },
          success: { deltas: { staff: 1 } },
        },
      },
    ],
  },

  REGI: {
    codename: 'REGI',
    name: 'Regi-X',
    role: 'NOMAD',
    stats: [
      { key: 'plat',      label: 'PLAT ₱', currency: true },
      { key: 'driverRep', label: 'DRIVER REP' },
      { key: 'crew',      label: 'CREW' },
      { key: 'rigCond',   label: 'RIG COND.' },
      { key: 'heat',      label: 'HEAT' },
    ],
    statDefaults: { plat: 0, driverRep: 0, crew: 0, rigCond: 0, heat: 0 },
    actions: [
      {
        id: 'maintain_rig',
        label: 'Maintain the Rig',
        type: 'ROUTINE',
        description: "Grease and patience. She'll run clean when it matters.",
        rewardHint: '+1 Rig Condition',
        outcome: { deltas: { rigCond: 1 } },
      },
      {
        id: 'drive_work',
        label: 'Drive Work',
        type: 'ROUTINE',
        description: 'Regular haul. Nothing fancy. Eurodollars spend the same.',
        rewardHint: '+₱200',
        outcome: { deltas: { plat: 200 } },
      },
      {
        id: 'crew_checkin',
        label: 'Check In With Crew',
        type: 'ROUTINE',
        description: 'Radio out, stay connected. The pack keeps you solid.',
        rewardHint: '+1 Crew',
        outcome: { deltas: { crew: 1 } },
      },
      {
        id: 'scout_circuit',
        label: 'Scout the Circuit',
        type: 'PUSH',
        description: 'Map the routes before someone else does.',
        rewardHint: 'Roll to secure a new run',
        outcomes: {
          partial: { deltas: { driverRep: 1 } },
          success: { deltas: { driverRep: 1, plat: 200 } },
        },
      },
      {
        id: 'run_the_gauntlet',
        label: 'Run the Gauntlet',
        type: 'SWING',
        description: 'High risk, high reward. Someone needs to move, no questions asked.',
        rewardHint: 'Variable payout — or heat',
        outcomes: {
          fail:    { deltas: { heat: 1 } },
          partial: { deltas: { plat: 300 } },
          success: { deltas: { plat: 600, driverRep: 1 } },
        },
      },
    ],
  },
};

export const ACTION_SLOTS = 3;

// PUSH: success on 5+, partial on 1-4 (can't fully fail)
// SWING: success on 7+, partial on 4-6, fail on 1-3
export function resolveAction(actionDef) {
  if (actionDef.type === 'ROUTINE') {
    return { level: 'success', roll: null, deltas: { ...actionDef.outcome.deltas } };
  }
  const roll = Math.floor(Math.random() * 10) + 1;
  let level;
  if (actionDef.type === 'PUSH') {
    level = roll >= 5 ? 'success' : 'partial';
  } else {
    level = roll >= 7 ? 'success' : roll >= 4 ? 'partial' : 'fail';
  }
  const outcome = actionDef.outcomes[level] ?? { deltas: {} };
  return { level, roll, deltas: { ...outcome.deltas } };
}

// Convert a Firebase object-stored array back to a plain array.
export function normActions(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  return Object.keys(raw).sort((a, b) => +a - +b).map(k => raw[k]);
}

// Format a stat delta for display in a pill (e.g. "+30 fans", "+₱300", "−1 heat").
export function formatDelta(charCodename, statKey, delta) {
  const char = CHARACTERS[charCodename];
  const stat = char?.stats.find(s => s.key === statKey);
  const label = stat?.label?.toLowerCase() ?? statKey;
  if (stat?.currency) {
    return delta >= 0 ? `+₱${delta}` : `−₱${Math.abs(delta)}`;
  }
  return delta >= 0 ? `+${delta} ${label}` : `−${Math.abs(delta)} ${label}`;
}
