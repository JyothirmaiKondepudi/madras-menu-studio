import Link from "next/link";
import { notFound } from "next/navigation";
import { getOccasionWithDetails } from "@/src/server/services/occasionService";
import { formatSlug } from "@/src/lib/formatSlug";
import GenerateButton from "./GenerateButton";

// optionNumber is stored as a plain 1/2/3 in the database (no schema
// change needed for the tier rename) — this is the single place that
// 1=Standard/2=Deluxe/3=Premium mapping is defined for display, mirroring
// TIER_LABELS in MenuGenerator.ts.
const TIER_LABELS_BY_OPTION_NUMBER: Record<number, string> = {
  1: "Standard",
  2: "Deluxe",
  3: "Premium",
};

// Friendly section headers per raw `course` value, and the fixed order
// they render in — matches the mockup's grouped layout (MORNING SPREAD /
// STARTERS / SIDES / SWEETS) rather than one flat list with the course
// name tacked on in parentheses next to each dish.
const COURSE_SECTION_LABELS: Record<string, string> = {
  appetizer: "Starters",
  snack: "Starters",
  main: "Main Course",
  rice: "Rice & Bread",
  bread: "Rice & Bread",
  salad: "Sides",
  condiment: "Sides",
  live_station: "Live Station",
  dessert: "Sweets",
  beverage: "Beverages",
};
const COURSE_SECTION_ORDER = [
  "Starters",
  "Live Station",
  "Main Course",
  "Rice & Bread",
  "Sides",
  "Sweets",
  "Beverages",
];

function groupItemsByCourseSection<T extends { menuItem: { course: string } }>(items: T[]) {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const section = COURSE_SECTION_LABELS[item.menuItem.course] ?? "Other";
    if (!groups.has(section)) groups.set(section, []);
    groups.get(section)!.push(item);
  }
  const order = [...COURSE_SECTION_ORDER, "Other"];
  return order
    .filter((section) => groups.has(section))
    .map((section) => ({ section, items: groups.get(section)! }));
}

export default async function OccasionDetailPage({
  params,
}: {
  params: Promise<{ id: string; occasionId: string }>;
}) {
  const { id, occasionId } = await params;
  const occasion = await getOccasionWithDetails(occasionId);
  if (!occasion) notFound();

  return (
    <div className="page">
      <p><Link href={`/events/${id}`}>← {occasion.event.eventName}</Link></p>
      <h1>Day {occasion.dayNumber} — {formatSlug(occasion.occasionType)}</h1>
      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <p className="meta-line" style={{ margin: 0 }}>
          {occasion.serviceType ? formatSlug(occasion.serviceType) : "?"} · {occasion.guestCount ?? "?"} guests ·{" "}
          Cuisine: {occasion.cuisineTags.length > 0 ? occasion.cuisineTags.map((t) => formatSlug(t)).join(" + ") : "Any"} ·{" "}
          {occasion.minPricePerPerson != null && occasion.maxPricePerPerson != null
            ? `Target: $${occasion.minPricePerPerson} – $${occasion.maxPricePerPerson} / person`
            : `Price tier: ${occasion.priceTier?.name ?? "none"} ($${occasion.priceTier ? String(occasion.priceTier.basePerPerson) : "?"} base)`}
        </p>
      </div>

      <GenerateButton occasionId={occasion.id} />

      <div className="option-grid">
        {occasion.generatedOptions.map((option) => (
          <div key={option.id} className="option-card">
            <div className="option-card-header">
              <h3>{TIER_LABELS_BY_OPTION_NUMBER[option.optionNumber] ?? `Option ${option.optionNumber}`}</h3>
              <span className="option-price">${String(option.computedPricePerPerson)} / person</span>
            </div>
            {groupItemsByCourseSection(option.items).map(({ section, items }) => (
              <div key={section} className="menu-section">
                <div className="menu-section-label">{section}</div>
                <ul>
                  {items.map((item) => (
                    <li key={item.id} className="menu-item-row">
                      {/* Standard Indian-menu convention: a green square+dot
                          for veg, red for non-veg — instantly recognizable
                          without reading the label. */}
                      {(item.menuItem.vegNonveg === "veg" || item.menuItem.vegNonveg === "nonveg") && (
                        <span className={`diet-dot ${item.menuItem.vegNonveg}`} title={item.menuItem.vegNonveg} />
                      )}
                      <span className="menu-item-name">{item.menuItem.name}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            {option.liveStations.length > 0 && (
              <div className="menu-section">
                <div className="menu-section-label">Live Stations</div>
                <ul>
                  {option.liveStations.map((station) => (
                    <li key={station.id} className="menu-item-row">
                      <span className="menu-item-name">
                        {station.name} (+${String(station.pricePerPerson)}/person)
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ))}
      </div>
      {occasion.generatedOptions.length === 0 && (
        <p className="meta-line">No options generated yet — click the button above.</p>
      )}
    </div>
  );
}
