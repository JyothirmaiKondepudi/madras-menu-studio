import Link from "next/link";
import { notFound } from "next/navigation";
import { getEventWithDetails } from "@/src/server/services/eventService";
import { listDistinctCuisineTags } from "@/src/server/services/menuItemService";
import { listLiveStations } from "@/src/server/services/liveStationService";
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

  const availableCuisineTags = await listDistinctCuisineTags();
  const liveStations = await listLiveStations();
  // Decimal can't cross the Server -> Client Component props boundary
  // (learned earlier this session, same fix as PriceTier before it).
  const plainLiveStations = liveStations.map((s) => ({
    id: s.id,
    name: s.name,
    region: s.region,
    vegNonveg: s.vegNonveg,
    pricePerPerson: Number(s.pricePerPerson),
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

  // Replaces the old CuisineProfile-derived label — defaultCuisineTags is
  // now a plain array directly on Event (the event's "usual" cuisine,
  // confirmed with the user as mostly-shared across its occasions), so the
  // hero label is just those tags formatted and joined.
  const cuisineLabel = event.defaultCuisineTags.map((t) => formatSlug(t)).join(" + ");

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
        defaultCuisineTags={event.defaultCuisineTags}
        availableCuisineTags={availableCuisineTags}
        liveStations={plainLiveStations}
      />
    </div>
  );
}
