"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import CustomSelect from "@/src/components/CustomSelect";

const TRADITION_OPTIONS = [
  { value: "hindu", label: "Hindu" },
  { value: "muslim", label: "Muslim" },
  { value: "christian", label: "Christian" },
  { value: "other", label: "Other" },
];

export default function NewEventPage() {
  const router = useRouter();
  const [clientName, setClientName] = useState("");
  const [eventName, setEventName] = useState("");
  const [guestCount, setGuestCount] = useState<number | "">("");
  const [venue, setVenue] = useState("");
  const [tradition, setTradition] = useState("hindu");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientName, eventName, guestCount, venue, tradition, startDate, endDate }),
    });
    if (!res.ok) {
      setError(`Failed to create event: ${res.status}`);
      return;
    }
    const event = await res.json();
    router.push(`/events/${event.id}`);
  }

  return (
    <div className="page" style={{ maxWidth: 420 }}>
      <h1>New Event</h1>
      <form onSubmit={handleSubmit} className="card" style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
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
        {error && <p style={{ color: "red" }}>{error}</p>}
        <button type="submit">Create Event</button>
      </form>
    </div>
  );
}
