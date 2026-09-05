"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Occasion } from "@prisma/client";
import { formatSlug } from "@/src/lib/formatSlug";
import AddOccasionModal from "./AddOccasionModal";

type PlainLiveStation = {
  id: string;
  name: string;
  region: string;
  vegNonveg: string;
  pricePerPerson: number;
};

// One card's width + the flex gap between cards, in px — matches
// .day-column { flex: 0 0 230px } and .day-columns { gap: 1.5rem } in
// globals.css. Used to scroll by exactly one card at a time.
const CARD_STEP = 230 + 24;

// Owns the single "which day's modal is open" state — at most one
// AddOccasionModal is ever mounted, no matter how many day columns or
// triggers exist, which is what actually guarantees only one popup can
// ever be on screen (see AddOccasionModal.tsx for why that matters).
export default function DayColumnsBoard({
  eventId,
  totalDays,
  occasions,
  defaultCuisineTags,
  availableCuisineTags,
  liveStations,
}: {
  eventId: string;
  totalDays: number;
  occasions: Occasion[];
  defaultCuisineTags: string[];
  availableCuisineTags: string[];
  liveStations: PlainLiveStation[];
}) {
  const router = useRouter();
  const [openDay, setOpenDay] = useState<number | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);

  const occasionsByDay = new Map<number, Occasion[]>();
  for (const o of occasions) {
    if (!occasionsByDay.has(o.dayNumber)) occasionsByDay.set(o.dayNumber, []);
    occasionsByDay.get(o.dayNumber)!.push(o);
  }
  const days = Array.from({ length: totalDays }, (_, i) => i + 1);
  const nextSequenceOrder = occasions.length + 1;

  // An absolute scrollTo target, not a relative scrollBy — snapping to the
  // nearest card boundary first makes each click's target predictable
  // regardless of where mid-scroll the container currently is. Instant
  // (behavior: "auto"), not smooth: passing behavior:"smooth" here (or via
  // the CSS scroll-behavior property) silently failed to move the scroll
  // position at all in testing — an animated transition isn't worth
  // reintroducing that failure mode for.
  function scrollByCard(direction: 1 | -1) {
    const el = scrollerRef.current;
    if (!el) return;
    const currentIndex = Math.round(el.scrollLeft / CARD_STEP);
    const maxScroll = el.scrollWidth - el.clientWidth;
    const target = Math.min(Math.max((currentIndex + direction) * CARD_STEP, 0), maxScroll);
    el.scrollTo({ left: target, behavior: "auto" });
  }

  // A plain overflow-x:auto element only scrolls horizontally from a
  // trackpad swipe or shift+wheel — a normal vertical mouse wheel does
  // nothing to it (it just scrolls the page instead), which is exactly
  // what left a mouse user stuck unable to reach the later days. This
  // redirects an ordinary wheel scroll into horizontal movement whenever
  // the cursor is over the carousel.
  function handleWheel(e: React.WheelEvent<HTMLDivElement>) {
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      e.currentTarget.scrollBy({ left: e.deltaY });
      e.preventDefault();
    }
  }

  async function handleDeleteService(e: React.MouseEvent, occasionId: string, label: string) {
    // The delete button sits inside the whole-card <Link>, so without
    // these the click would also trigger navigation to that service's page.
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`Delete "${label}"? This removes any menus generated for it — can't be undone.`)) return;
    await fetch(`/api/occasions/${occasionId}`, { method: "DELETE" });
    router.refresh();
  }

  async function handleDeleteDay(day: number, count: number) {
    const message =
      count > 0
        ? `Delete Day ${day}? This removes its ${count} service${count !== 1 ? "s" : ""} and any generated menus — can't be undone.`
        : `Remove Day ${day}?`;
    if (!confirm(message)) return;
    await fetch(`/api/events/${eventId}/days/${day}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <>
      <div className="day-columns-row">
        <button
          type="button"
          className="day-columns-nav"
          onClick={() => scrollByCard(-1)}
          aria-label="Scroll to earlier days"
        >
          ‹
        </button>

        <div className="day-columns" ref={scrollerRef} onWheel={handleWheel}>
          {days.map((day) => {
            const dayOccasions = occasionsByDay.get(day) ?? [];
            return (
              <div key={day} className="day-column">
                <div className="day-column-header">
                  <button
                    type="button"
                    className="day-column-delete"
                    onClick={() => handleDeleteDay(day, dayOccasions.length)}
                    aria-label={`Delete Day ${day}`}
                    title={`Delete Day ${day}`}
                  >
                    ×
                  </button>
                  <span className="day-column-header-label">Day</span>
                  <span className="day-column-header-number">{day}</span>
                </div>
                <div className="day-column-body">
                  {dayOccasions.map((o) => (
                    <Link
                      key={o.id}
                      href={`/events/${eventId}/occasions/${o.id}`}
                      className="service-row"
                    >
                      <button
                        type="button"
                        className="service-row-delete"
                        onClick={(e) => handleDeleteService(e, o.id, formatSlug(o.occasionType))}
                        aria-label={`Delete ${formatSlug(o.occasionType)}`}
                        title="Delete this service"
                      >
                        ×
                      </button>
                      <div className="service-row-title">{formatSlug(o.occasionType)}</div>
                      <div className="service-row-action">View menus →</div>
                    </Link>
                  ))}
                  {dayOccasions.length === 0 && (
                    <div className="day-column-empty">Nothing scheduled yet</div>
                  )}
                  <button type="button" className="day-add-trigger" onClick={() => setOpenDay(day)}>
                    + Add Service
                  </button>
                </div>
              </div>
            );
          })}

          <div className="day-column">
            <div className="day-column-add-day">
              <button type="button" className="day-add-trigger" onClick={() => setOpenDay(totalDays + 1)}>
                + Add Day {totalDays + 1}
              </button>
            </div>
          </div>
        </div>

        <button
          type="button"
          className="day-columns-nav"
          onClick={() => scrollByCard(1)}
          aria-label="Scroll to later days"
        >
          ›
        </button>
      </div>

      {openDay !== null && (
        <AddOccasionModal
          eventId={eventId}
          dayNumber={openDay}
          defaultCuisineTags={defaultCuisineTags}
          availableCuisineTags={availableCuisineTags}
          liveStations={liveStations}
          nextSequenceOrder={nextSequenceOrder}
          onClose={() => setOpenDay(null)}
        />
      )}
    </>
  );
}
