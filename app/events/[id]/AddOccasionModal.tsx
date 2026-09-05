"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { formatSlug } from "@/src/lib/formatSlug";
import { OCCASION_PRICE_PRESETS } from "@/src/lib/occasionPricePresets";
import CustomSelect from "@/src/components/CustomSelect";

// Reconciled against the manager's actual handwritten price sheet
// (transcribed and confirmed with the user) — dinner_reception renamed to
// wedding_dinner and farwell_brunch to vidai_farewell_brunch to match his
// real naming, and walima/house_warming/high_tea/wedding_ceremony_snacks
// added since they weren't coded at all before. late_night_snacks and
// "other" aren't on his sheet but are left in rather than silently
// removed — they just won't get a price prefill below.
const OCCASION_TYPES = [
  "breakfast", "wedding_lunch", "wedding_dinner", "sangeet", "cocktail_hour",
  "mehendi", "ceremony_refreshments", "vidai_farewell_brunch", "welcome_dinner",
  "welcome_lunch", "haldi", "baraat", "wedding_ceremony_snacks", "walima",
  "birthday", "mundan", "graduation", "boxed_lunch", "boxed_breakfast",
  "high_tea", "house_warming", "anniversary", "late_night_snacks", "other",
];
const SERVICE_TYPES = ["buffet", "live_stations", "plated", "family_style", "butler_passed"];
const VENUE_TYPES = ["hotel", "outdoor", "mueseum", "country_club", "private_home", "banquet_hall", "other"];
// Multiple allowed at once (e.g. an event can be both "Vegan" and "Jain")
// — confirmed with the user, hence a checkbox picklist like cuisine tags,
// not a single-select dropdown. Picking both Vegetarian and Non-Vegetarian
// is how "mixed" gets expressed; no separate "mixed" option needed.
const DIETARY_PREFERENCES = ["vegetarian", "non_vegetarian", "jain", "vegan"];

type PlainLiveStation = {
  id: string;
  name: string;
  region: string;
  vegNonveg: string;
  pricePerPerson: number;
};

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
  defaultCuisineTags,
  availableCuisineTags,
  liveStations,
  nextSequenceOrder,
  onClose,
}: {
  eventId: string;
  dayNumber: number;
  defaultCuisineTags: string[];
  availableCuisineTags: string[];
  liveStations: PlainLiveStation[];
  nextSequenceOrder: number;
  onClose: () => void;
}) {
  const router = useRouter();
  const [occasionType, setOccasionType] = useState(OCCASION_TYPES[0]);
  const [guestCount, setGuestCount] = useState<number | "">("");
  const [serviceType, setServiceType] = useState(SERVICE_TYPES[0]);
  // Replaces the old fixed-rate "Price Tier" dropdown — the manager quotes
  // a min/max per-person range per occasion, negotiated per client, and
  // MenuGenerator now builds each of the 3 packages to fit inside that
  // range rather than looking up one fixed rate (see MenuGenerator.ts).
  const [minPrice, setMinPrice] = useState<number | "">("");
  const [maxPrice, setMaxPrice] = useState<number | "">("");
  // Replaces the old "Cuisine Profile" dropdown + "+ New cuisine
  // profile..." flow entirely — confirmed with the user that most
  // occasions in an event share the same cuisine, so this prefills
  // directly from the event's defaultCuisineTags and is freely editable
  // per service, no naming/saving step in between. A picklist of real
  // MenuItem.cuisineTags values, not free text — a typo'd tag here
  // silently breaks generation (found earlier: "telugu" instead of
  // "telugu_andhra" matched zero dishes). "Any cuisine" always starts
  // *unchecked*, even when the event has no default — defaulting it to
  // checked whenever defaultCuisineTags was empty meant an event created
  // without a cuisine (or one where the person just skipped that step)
  // could add every single service afterward with cuisine silently stuck
  // on "any," never once being asked (a real "Tamil wedding" breakfast
  // came back with Idli Sambar next to Moroccan Chickpea Chili this way).
  // "No restriction" now has to be actively checked, every time.
  const [anyCuisine, setAnyCuisine] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>(defaultCuisineTags);
  const [tagError, setTagError] = useState<string | null>(null);
  const [dietaryPreferences, setDietaryPreferences] = useState<string[]>([]);
  const [selectedLiveStationIds, setSelectedLiveStationIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [priceError, setPriceError] = useState<string | null>(null);

  function toggleTag(tag: string) {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }

  function toggleDietaryPreference(pref: string) {
    setDietaryPreferences((prev) =>
      prev.includes(pref) ? prev.filter((p) => p !== pref) : [...prev, pref]
    );
  }

  function toggleLiveStation(id: string) {
    setSelectedLiveStationIds((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  }

  // The manager's real per-occasion price range (OCCASION_PRICE_PRESETS)
  // prefills both fields as a starting suggestion — still just a
  // suggestion, since "he changes prices based on the person." Tracks the
  // last preset actually applied so switching occasion type re-prefills
  // correctly instead of only ever working once: checking "are the fields
  // still empty" isn't enough, since Breakfast's default prefill on mount
  // would otherwise permanently block re-prefilling for every type picked
  // afterward (found by testing — Wedding Dinner kept showing Breakfast's
  // $18/$44 instead of its own $55/$250). Only skips prefilling when the
  // current values were actually typed by hand, not left over from a
  // previous auto-fill.
  const lastPrefill = useRef<{ min: number; max: number } | null>(null);
  useEffect(() => {
    const bothEmpty = minPrice === "" && maxPrice === "";
    const stillMatchesLastPrefill =
      lastPrefill.current !== null &&
      minPrice === lastPrefill.current.min &&
      maxPrice === lastPrefill.current.max;
    if (!bothEmpty && !stillMatchesLastPrefill) return;

    const preset = OCCASION_PRICE_PRESETS[occasionType];
    if (preset) {
      setMinPrice(preset.min);
      setMaxPrice(preset.max);
      lastPrefill.current = { min: preset.min, max: preset.max };
    } else {
      lastPrefill.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [occasionType]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (minPrice !== "" && maxPrice !== "" && Number(minPrice) > Number(maxPrice)) {
      setPriceError("Min price can't be higher than max price.");
      return;
    }
    setPriceError(null);

    if (!anyCuisine && selectedTags.length === 0) {
      setTagError("Pick at least one cuisine tag, or choose \"Any cuisine\".");
      return;
    }
    setTagError(null);
    setSubmitting(true);

    await fetch(`/api/events/${eventId}/occasions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dayNumber,
        sequenceOrder: nextSequenceOrder,
        occasionType,
        guestCount: guestCount || null,
        serviceType,
        cuisineTags: anyCuisine ? [] : selectedTags,
        minPricePerPerson: minPrice || null,
        maxPricePerPerson: maxPrice || null,
        dietaryPreferences,
        liveStationIds: selectedLiveStationIds,
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
          <label className="tag-picklist-any">
            <input
              type="checkbox"
              checked={anyCuisine}
              onChange={(e) => setAnyCuisine(e.target.checked)}
            />
            Any cuisine (no restriction)
          </label>
          {!anyCuisine && (
            <label className="field-full">
              Cuisine Tags
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
          <label className="field-full">
            Dietary Preferences
            <div className="chip-group">
              {DIETARY_PREFERENCES.map((pref) => (
                <button
                  key={pref}
                  type="button"
                  className="chip"
                  aria-pressed={dietaryPreferences.includes(pref)}
                  onClick={() => toggleDietaryPreference(pref)}
                >
                  {formatSlug(pref)}
                </button>
              ))}
            </div>
          </label>
          <label className="field-full">
            Live Stations
            <div className="chip-group">
              {liveStations.map((station) => (
                <button
                  key={station.id}
                  type="button"
                  className="chip"
                  aria-pressed={selectedLiveStationIds.includes(station.id)}
                  onClick={() => toggleLiveStation(station.id)}
                >
                  {station.name} — {formatSlug(station.region)} — ${station.pricePerPerson}/person
                </button>
              ))}
              {liveStations.length === 0 && <p className="meta-line">No live stations available.</p>}
            </div>
          </label>
          <label>
            Min Price / Person ($)
            <input
              type="number"
              min={0}
              step="0.01"
              placeholder="e.g. 25"
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value ? Number(e.target.value) : "")}
              required
            />
          </label>
          <label>
            Max Price / Person ($)
            <input
              type="number"
              min={0}
              step="0.01"
              placeholder="e.g. 60"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value ? Number(e.target.value) : "")}
              required
            />
          </label>
          {priceError && <p className="field-error">{priceError}</p>}
          <button type="submit" disabled={submitting}>
            {submitting ? "Adding..." : "Add Service"}
          </button>
        </form>
      </div>
    </div>
  );
}
