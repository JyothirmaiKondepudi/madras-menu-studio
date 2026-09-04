"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { CuisineProfile } from "@prisma/client";

// Plain shape, not the full Prisma PriceTier — its basePerPerson is a
// Decimal class instance, which can't cross the Server -> Client
// Component boundary as a prop (must be plain serializable data).
type PlainPriceTier = {
  id: string;
  name: string;
  occasionType: string;
  serviceStyle: string;
  basePerPerson: number;
};

// These are the occasion types the seeded PriceTiers actually cover — kept
// as a plain list here rather than fetched, since it's just dropdown
// options, not data.
const OCCASION_TYPES = [
  "breakfast", "welcome_dinner", "mehndi", "sangeet",
  "wedding_lunch", "cocktail_hour", "dinner_reception", "late_night_snacks",
];
const SERVICE_TYPES = ["buffet", "stations", "plated", "family_style"];
const NEW_CUISINE_VALUE = "__new__";

export default function OccasionForm({
  eventId,
  cuisineProfiles,
  priceTiers,
  nextSequenceOrder,
}: {
  eventId: string;
  cuisineProfiles: CuisineProfile[];
  priceTiers: PlainPriceTier[];
  nextSequenceOrder: number;
}) {
  const router = useRouter();
  const [dayNumber, setDayNumber] = useState(1);
  const [occasionType, setOccasionType] = useState(OCCASION_TYPES[0]);
  const [guestCount, setGuestCount] = useState<number | "">("");
  const [serviceType, setServiceType] = useState(SERVICE_TYPES[0]);
  const [cuisineProfileId, setCuisineProfileId] = useState(cuisineProfiles[0]?.id ?? "");
  const [priceTierId, setPriceTierId] = useState(priceTiers[0]?.id ?? "");
  const [newCuisineName, setNewCuisineName] = useState("");
  const [newCuisineTags, setNewCuisineTags] = useState("");

  // useState's initial value only runs once, at mount — it does NOT
  // re-run when props change on a later render. Since this form exists
  // before any CuisineProfile does (a brand new event has none yet), the
  // very first render locks in cuisineProfileId = "", and it silently
  // stayed empty forever even after a profile got added and this
  // component re-rendered with a non-empty `cuisineProfiles` prop. This
  // effect re-syncs the selection whenever the available list changes and
  // the current selection isn't (or is no longer) valid.
  useEffect(() => {
    if (cuisineProfileId !== NEW_CUISINE_VALUE && !cuisineProfiles.some((p) => p.id === cuisineProfileId)) {
      setCuisineProfileId(cuisineProfiles[0]?.id ?? (cuisineProfiles.length === 0 ? NEW_CUISINE_VALUE : ""));
    }
  }, [cuisineProfiles, cuisineProfileId]);

  useEffect(() => {
    if (!priceTiers.some((t) => t.id === priceTierId)) {
      setPriceTierId(priceTiers[0]?.id ?? "");
    }
  }, [priceTiers, priceTierId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // No separate "manage cuisine profiles" section on this page anymore
    // (moved out per feedback) — creating one inline here, right when it's
    // first needed, instead of requiring a trip elsewhere first.
    let resolvedCuisineProfileId = cuisineProfileId;
    if (cuisineProfileId === NEW_CUISINE_VALUE) {
      const res = await fetch(`/api/events/${eventId}/cuisine-profiles`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newCuisineName,
          cuisineTags: newCuisineTags.split(",").map((t) => t.trim()).filter(Boolean),
        }),
      });
      const created = await res.json();
      resolvedCuisineProfileId = created.id;
    }

    await fetch(`/api/events/${eventId}/occasions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dayNumber,
        sequenceOrder: nextSequenceOrder,
        occasionType,
        guestCount: guestCount || null,
        serviceType,
        cuisineProfileId: resolvedCuisineProfileId || null,
        priceTierId: priceTierId || null,
      }),
    });
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="field-grid">
      <label>
        Day
        <input type="number" min={1} value={dayNumber} onChange={(e) => setDayNumber(Number(e.target.value))} />
      </label>
      <label>
        Occasion Type
        <select value={occasionType} onChange={(e) => setOccasionType(e.target.value)}>
          {OCCASION_TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </label>
      <label>
        Service Style
        <select value={serviceType} onChange={(e) => setServiceType(e.target.value)}>
          {SERVICE_TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </label>
      <label>
        Guest Count
        <input
          type="number"
          placeholder="e.g. 150"
          value={guestCount}
          onChange={(e) => setGuestCount(e.target.value ? Number(e.target.value) : "")}
        />
      </label>
      <label>
        Cuisine Profile
        <select value={cuisineProfileId} onChange={(e) => setCuisineProfileId(e.target.value)}>
          {cuisineProfiles.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
          <option value={NEW_CUISINE_VALUE}>+ New cuisine profile...</option>
        </select>
      </label>
      <label>
        Price Tier
        <select value={priceTierId} onChange={(e) => setPriceTierId(e.target.value)}>
          {priceTiers.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} — {t.occasionType}/{t.serviceStyle} (${String(t.basePerPerson)})
            </option>
          ))}
        </select>
      </label>
      {cuisineProfileId === NEW_CUISINE_VALUE && (
        <>
          <label>
            New Profile Name
            <input placeholder="e.g. Kerala Classics" value={newCuisineName} onChange={(e) => setNewCuisineName(e.target.value)} required />
          </label>
          <label>
            New Cuisine Tags
            <input placeholder="e.g. kerala, south_indian" value={newCuisineTags} onChange={(e) => setNewCuisineTags(e.target.value)} />
          </label>
        </>
      )}
      <button type="submit">Add Occasion</button>
    </form>
  );
}
