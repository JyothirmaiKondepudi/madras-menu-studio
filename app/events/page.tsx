import Link from "next/link";
import { listEvents } from "@/src/server/services/eventService";
import { formatDate } from "@/src/lib/formatDate";

// A Server Component — runs only on the server, so it can call the service
// (and through it, Prisma) directly. No fetch, no API route needed for a
// plain read like this one.
export default async function EventsPage() {
  const events = await listEvents();

  return (
    <div className="page">
      <h1>Events</h1>
      <p>
        <Link href="/events/new">+ New Event</Link>
      </p>
      <div className="card-grid">
        {events.map((event) => (
          <Link key={event.id} href={`/events/${event.id}`} className="entity-card">
            <span className="entity-card-arrow">›</span>
            <div className="entity-card-title">{event.eventName}</div>
            <div className="entity-card-meta">{event.clientName}</div>
            {event.venue && <div className="entity-card-meta">{event.venue}</div>}
            <div className="entity-card-meta">
              {formatDate(event.startDate)} – {formatDate(event.endDate)}
            </div>
          </Link>
        ))}
      </div>
      {events.length === 0 && <p className="meta-line">No events yet.</p>}
    </div>
  );
}
