// Event/occasion dates are stored as date-only values (midnight UTC).
// Rendering with the browser's local timezone shifts them back a day for
// anyone west of UTC (e.g. a 10/1 start date showing as 9/30) — forcing
// UTC when formatting keeps the date exactly as entered.
export function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("en-US", { timeZone: "UTC" });
}
