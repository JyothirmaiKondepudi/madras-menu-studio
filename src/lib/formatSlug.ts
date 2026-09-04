// "wedding_lunch" -> "Wedding Lunch", "late_night_snacks" -> "Late Night
// Snacks" — occasion types, service styles, etc. are stored as lowercase
// slugs (matching the ETL pipeline's controlled vocabulary) but read as
// plain nouns anywhere they're shown to a person, so they get Title Case
// at render time rather than storing display-formatted values.
export function formatSlug(slug: string): string {
  return slug
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
