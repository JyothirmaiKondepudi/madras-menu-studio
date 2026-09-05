"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import CustomSelect from "@/src/components/CustomSelect";
import { formatSlug } from "@/src/lib/formatSlug";

const TRADITION_OPTIONS = [
  { value: "hindu", label: "Hindu" },
  { value: "muslim", label: "Muslim" },
  { value: "christian", label: "Christian" },
  { value: "other", label: "Other" },
];

export default function NewEventForm({ availableCuisineTags }: { availableCuisineTags: string[] }) {
  const router = useRouter();
  const [clientName, setClientName] = useState("");
  const [eventName, setEventName] = useState("");
  const [guestCount, setGuestCount] = useState<number | "">("");
  const [venue, setVenue] = useState("");
  const [tradition, setTradition] = useState("hindu");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  // The event's "usual" cuisine combo — most occasions in an event share
  // the same cuisine (confirmed with the user), so this is a real default
  // every new service prefills from, not just a suggestion. Replaces the
  // old CuisineProfile-picking flow entirely. Defaults to *unchecked* —
  // "Any cuisine" pre-checked meant the chip picklist stayed hidden and
  // nobody was ever actually asked to pick a cuisine, which for a
  // cuisine-driven catering business is exactly backwards (found from a
  // real "Tamil wedding" event whose breakfast came back with Idli Sambar
  // next to Moroccan Chickpea Chili, because cuisine silently stayed "any"
  // through the whole flow). Showing the picklist by default forces an
  // active choice — pick tags, or deliberately check "any" instead.
  const [anyCuisine, setAnyCuisine] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [tagError, setTagError] = useState<string | null>(null);

  function toggleTag(tag: string) {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!anyCuisine && selectedTags.length === 0) {
      setTagError("Pick at least one cuisine tag, or check \"Not sure yet\".");
      return;
    }
    setTagError(null);
    setError(null);
    const res = await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientName,
        eventName,
        guestCount,
        venue,
        tradition,
        startDate,
        endDate,
        defaultCuisineTags: anyCuisine ? [] : selectedTags,
      }),
    });
    if (!res.ok) {
      setError(`Failed to create event: ${res.status}`);
      return;
    }
    const event = await res.json();
    router.push(`/events/${event.id}`);
  }

  return (
    <div className="page" style={{ maxWidth: 560 }}>
      <h1>New Event</h1>
      <form onSubmit={handleSubmit} className="card field-grid">
        <label>
          Event Name
          <input value={eventName} onChange={(e) => setEventName(e.target.value)} required />
        </label>
        <label>
          Client Name
          <input value={clientName} onChange={(e) => setClientName(e.target.value)} required />
        </label>
        <label>
          Number of Guests
          <input
            type="number"
            min={1}
            value={guestCount}
            onChange={(e) => setGuestCount(e.target.value ? Number(e.target.value) : "")}
            required
          />
        </label>
        <label>
          Venue
          <input value={venue} onChange={(e) => setVenue(e.target.value)} required />
        </label>
        <label>
          Start Date
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
        </label>
        <label>
          End Date
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
        </label>
        <label>
          Religion
          <CustomSelect value={tradition} onChange={setTradition} options={TRADITION_OPTIONS} />
        </label>
        <label className="tag-picklist-any">
          <input
            type="checkbox"
            checked={anyCuisine}
            onChange={(e) => setAnyCuisine(e.target.checked)}
          />
          Not sure yet / no fixed cuisine
        </label>
        {!anyCuisine && (
          <label className="field-full">
            Usual Cuisine For This Event
            <div className="chip-group">
              {availableCuisineTags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  className="chip"
                  aria-pressed={selectedTags.includes(tag)}
                  onClick={() => toggleTag(tag)}
                >
                  {formatSlug(tag)}
                </button>
              ))}
            </div>
          </label>
        )}
        {tagError && <p className="field-error">{tagError}</p>}
        {error && <p style={{ color: "red" }}>{error}</p>}
        <button type="submit">Create Event</button>
      </form>
    </div>
  );
}
