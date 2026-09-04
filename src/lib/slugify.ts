// Normalizes freeform text into the lower_snake_case form used throughout
// the seeded data for cuisine tags (e.g. "south_indian", "telugu_andhra").
// Exists because a CuisineProfile's cuisineTags used to accept raw typed
// text ("south indian" — a space, not an underscore) which then silently
// never matched MenuItem.cuisineTags in MenuGenerator's exact-string
// overlap check, causing every course to come back empty. Applied
// defensively wherever a cuisine tag is written, even though the UI now
// sources tags from a picklist of real values (see AddOccasionModal) —
// this is the safety net for any tag that reaches the API some other way.
export function slugifyTag(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}
