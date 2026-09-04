import Link from "next/link";
import { notFound } from "next/navigation";
import { getEventWithDetails } from "@/src/server/services/eventService";
import { listPriceTiers } from "@/src/server/services/priceTierService";
import { listDistinctCuisineTags } from "@/src/server/services/menuItemService";
import { formatDate } from "@/src/lib/formatDate";
import { formatSlug } from "@/src/lib/formatSlug";
import DayColumnsBoard from "./DayColumnsBoard";
import DeleteEventButton from "./DeleteEventButton";

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const event = await getEventWithDetails(id);
  if (!event) notFound();

  const priceTiers = await listPriceTiers();
  const availableCuisineTags = await listDistinctCuisineTags();
  const plainPriceTiers = priceTiers.map((t) => ({
    id: t.id,
    name: t.name,
    occasionType: t.occasionType,
    serviceStyle: t.serviceStyle,
    basePerPerson: Number(t.basePerPerson),
  }));

  // Day count is not purely date-derived — it also grows with the highest
  // occasion dayNumber actually in use, so the trailing "+" tile can add a
  // new day simply by creating an occasion one day past the current
  // range, without a separate "extend the event's dates" action.
  const dateDerivedDays = Math.round(
    (new Date(event.endDate).getTime() - new Date(event.startDate).getTime()) / 86_400_000
  ) + 1;
  const maxOccasionDay = event.occasions.reduce((max, o) => Math.max(max, o.dayNumber), 0);
  const totalDays = Math.max(dateDerivedDays, maxOccasionDay, 1);

  // The schema deliberately allows an Event to carry more than one
  // CuisineProfile (a fusion wedding can mix cuisines across occasions —
  // see CLAUDE.md) — the reference mockup assumes one label per event, so
  // this joins whatever profiles exist into a single line rather than
  // forcing the data model back down to "one cuisine per event."
  const cuisineLabel = event.cuisineProfiles.map((p) => p.name).join(" + ");

  return (
    <div className="page">
      <p style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span>
          <Link href="/events">← All Events</Link>
          <span className="meta-line" style={{ marginLeft: "0.75rem" }}>
            Client: {event.clientName} · Tradition: {event.tradition ? formatSlug(event.tradition) : "—"}
            {event.venue && <> · {event.venue}</>}
            {event.guestCount != null && <> · {event.guestCount} guests</>} ·{" "}
            {formatDate(event.startDate)} – {formatDate(event.endDate)}
          </span>
        </span>
        <DeleteEventButton eventId={event.id} eventName={event.eventName} />
      </p>

      <div className="event-hero">
        {cuisineLabel && <div className="event-hero-eyebrow">{cuisineLabel} Catering</div>}
        <h1 className="event-hero-title">{event.eventName}</h1>
        <p className="event-hero-subtitle">
          {totalDays} day{totalDays !== 1 ? "s" : ""} · Select any service to view menu options
        </p>
      </div>

      <DayColumnsBoard
        eventId={event.id}
        totalDays={totalDays}
        occasions={event.occasions}
        cuisineProfiles={event.cuisineProfiles}
        priceTiers={plainPriceTiers}
        availableCuisineTags={availableCuisineTags}
      />
    </div>
  );
}
