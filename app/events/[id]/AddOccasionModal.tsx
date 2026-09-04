"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { CuisineProfile } from "@prisma/client";
import { formatSlug } from "@/src/lib/formatSlug";
import CustomSelect from "@/src/components/CustomSelect";

type PlainPriceTier = {
  id: string;
  name: string;
  occasionType: string;
  serviceStyle: string;
  basePerPerson: number;
};

const OCCASION_TYPES = [
  "breakfast", "welcome_dinner", "mehendi", "sangeet",
  "wedding_lunch", "cocktail_hour", "dinner_reception", "late_night_snacks", 
  "ceremony_refreshments", "farwell_brunch", "haldi", "baraat", "birthday","graduation",
  "anniversary", "boxed_lunch", "boxed_breakfast", "other"
];
const SERVICE_TYPES = ["buffet", "live_stations", "plated", "family_style", "butler_passed"];
const VENUE_TYPES = ["hotel", "outdoor", "mueseum", "country_club", "private_home",, "banquet_hall", "other"];
const NEW_CUISINE_VALUE = "__new__";

// A controlled component now, not a self-contained trigger+popup — it used
// to own its own `open` state, one independent instance per day column,
// which meant nothing stopped two from being opened at once (click one
// "+", then another before it closes, and both render centered on top of
// each other — exactly the ghosted double-modal photo the user reported).
// The parent (DayColumnsBoard) now owns a single "which day is open"
// state and mounts at most one instance of this component at a time.
export default function AddOccasionModal({
  eventId,
  dayNumber,
  cuisineProfiles,
  priceTiers,
  availableCuisineTags,
  nextSequenceOrder,
  onClose,
}: {
  eventId: string;
  dayNumber: number;
  cuisineProfiles: CuisineProfile[];
  priceTiers: PlainPriceTier[];
  availableCuisineTags: string[];
  nextSequenceOrder: number;
  onClose: () => void;
}) {
  const router = useRouter();
  const [occasionType, setOccasionType] = useState(OCCASION_TYPES[0]);
  const [guestCount, setGuestCount] = useState<number | "">("");
  const [serviceType, setServiceType] = useState(SERVICE_TYPES[0]);
  const [cuisineProfileId, setCuisineProfileId] = useState(
    cuisineProfiles[0]?.id ?? (cuisineProfiles.length === 0 ? NEW_CUISINE_VALUE : "")
  );
  const [priceTierId, setPriceTierId] = useState(priceTiers[0]?.id ?? "");
  const [newCuisineName, setNewCuisineName] = useState("");
  // A picklist of real MenuItem.cuisineTags values, not free text — a
  // profile used to be creatable with a typo'd or blank tag, which
  // MenuGenerator's exact-string match then silently treated as either
  // "matches nothing" or "no restriction at all" (see slugify.ts and
  // menuItemService.listDistinctCuisineTags). "Any cuisine" is now its own
  // explicit checkbox so "no restriction" is a deliberate choice rather
  // than what happens by default when someone leaves the tags blank.
  const [anyCuisine, setAnyCuisine] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagError, setTagError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function toggleTag(tag: string) {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }

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

    if (cuisineProfileId === NEW_CUISINE_VALUE && !anyCuisine && selectedTags.length === 0) {
      setTagError("Pick at least one cuisine tag, or choose \"Any cuisine\".");
      return;
    }
    setTagError(null);
    setSubmitting(true);

    let resolvedCuisineProfileId = cuisineProfileId;
    if (cuisineProfileId === NEW_CUISINE_VALUE) {
      const res = await fetch(`/api/events/${eventId}/cuisine-profiles`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newCuisineName,
          cuisineTags: anyCuisine ? [] : selectedTags,
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

    setSubmitting(false);
    onClose();
    router.refresh();
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Add a Service — Day {dayNumber}</h3>
          <button type="button" className="modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit} className="field-grid">
          <label>
            Occasion Type
            <CustomSelect
              value={occasionType}
              onChange={setOccasionType}
              options={OCCASION_TYPES.map((t) => ({ value: t, label: formatSlug(t) }))}
            />
          </label>
          <label>
            Service Style
            <CustomSelect
              value={serviceType}
              onChange={setServiceType}
              options={SERVICE_TYPES.map((t) => ({ value: t, label: formatSlug(t) }))}
            />
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
            <CustomSelect
              value={cuisineProfileId}
              onChange={setCuisineProfileId}
              options={[
                ...cuisineProfiles.map((p) => ({ value: p.id, label: p.name })),
                { value: NEW_CUISINE_VALUE, label: "+ New cuisine profile..." },
              ]}
            />
          </label>
          <label>
            Price Tier
            <CustomSelect
              value={priceTierId}
              onChange={setPriceTierId}
              options={priceTiers.map((t) => ({
                value: t.id,
                label: `${t.name} — ${formatSlug(t.occasionType)}/${formatSlug(t.serviceStyle)} ($${t.basePerPerson})`,
              }))}
            />
          </label>
          {cuisineProfileId === NEW_CUISINE_VALUE && (
            <>
              <label>
                New Profile Name
                <input
                  placeholder="e.g. Kerala Classics"
                  value={newCuisineName}
                  onChange={(e) => setNewCuisineName(e.target.value)}
                  required
                />
              </label>
              <label className="tag-picklist-any">
                <input
                  type="checkbox"
                  checked={anyCuisine}
                  onChange={(e) => setAnyCuisine(e.target.checked)}
                />
                Any cuisine (no restriction)
              </label>
              {!anyCuisine && (
                <label>
                  Cuisine Tags
                  <div className="tag-picklist">
                    {availableCuisineTags.map((tag) => (
                      <label key={tag} className="tag-picklist-option">
                        <input
                          type="checkbox"
                          checked={selectedTags.includes(tag)}
                          onChange={() => toggleTag(tag)}
                        />
                        {formatSlug(tag)}
                      </label>
                    ))}
                  </div>
                </label>
              )}
              {tagError && <p className="field-error">{tagError}</p>}
            </>
          )}
          <button type="submit" disabled={submitting}>
            {submitting ? "Adding..." : "Add Service"}
          </button>
        </form>
      </div>
    </div>
  );
}
