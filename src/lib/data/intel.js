// Taxonomy for the `intel` Firestore collection — display order and labels
// for the category groupings shown on the Field Intel page. The intel
// entries themselves live in Firestore (see src/lib/content-db.js) and are
// editable from the GM console's Catalog tab.
export const CATEGORY_ORDER = [
  { key: "culture", label: "Culture" },
  { key: "infrastructure", label: "Infrastructure" },
  { key: "technology", label: "Technology" },
  { key: "services", label: "Services" },
  { key: "substances", label: "Substances" },
  { key: "mechanics", label: "Mechanics" },
];
