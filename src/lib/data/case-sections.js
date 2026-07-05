// Registry of briefing case types the GM console builder can author into.
// Adding a future case type = one entry here + a route that fetches
// `briefings` filtered by that key (see persons/locations/intel +page.svelte).
export const CASE_SECTIONS = [
  { key: 'persons', label: 'Persons' },
  { key: 'locations', label: 'Locations' },
  { key: 'intel', label: 'Intel' },
];
