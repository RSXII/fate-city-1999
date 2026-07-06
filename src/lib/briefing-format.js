// Converts a raw GM-authored `briefings/{id}` record (Firebase) into the same
// entry shape the hand-authored persons/locations/intel data files use, so it
// can render through the shared BriefingCard component.
export function toBriefingEntry(raw) {
  const color = raw.accentColor || '#b8902f';

  const stats = [];
  if (raw.species) stats.push({ label: 'Species', value: raw.species });
  if (raw.rep) stats.push({ label: 'Reputation', value: raw.rep });

  const sections = [];
  if (raw.overview) sections.push({ heading: 'Overview', paragraphs: [raw.overview] });
  const hooks = (raw.notes || '').split('\n').map(s => s.trim()).filter(Boolean);
  if (hooks.length) sections.push({ heading: 'A Note From Your Benefactor', hooks });

  return {
    id: raw._id,
    fileNo: raw.fileNo || '—',
    stamp: 'GM CASE FILE',
    colors: { rule: color, accent: color, stripe: color, stampColor: color },
    name: raw.name || 'Untitled',
    epithet: '',
    images: raw.images || [],
    stats,
    sections,
  };
}
