"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatSlug } from "@/src/lib/formatSlug";
import CustomSelect from "@/src/components/CustomSelect";

// Mirrors menu_etl_pipeline.py's controlled vocabulary exactly (COURSES,
// CUISINE_TAGS, ALLERGENS, DIETARY_FLAGS, RELIGION_SUITABILITY,
// OCCASION_SUITABILITY, SPICE_LEVELS) — that Python module is the source of
// truth (it's what constrains the LLM's extraction in the first place), so
// keep these lists in sync with it if either ever changes.
const COURSES = ["appetizer", "live_station", "main", "bread", "rice_biryani", "side", "salad", "dessert", "beverage", "condiment"];
const CUISINE_TAGS = [
  "north_indian", "south_indian", "punjabi", "sindhi", "marathi", "pakistani",
  "bangladeshi", "gujarati", "kerala", "telugu_andhra", "tamil", "rajasthani",
  "fusion", "chinese", "mexican", "italian", "american", "mediterranean",
  "thai", "sushi", "modern",
];
const ALLERGENS = ["nuts", "dairy", "gluten", "shellfish", "egg", "soy", "sesame"];
const DIETARY_FLAGS = ["vegan", "jain", "halal", "kosher", "gluten_free"];
const RELIGION_SUITABILITY = ["hindu", "muslim", "christian", "any"];
const OCCASION_SUITABILITY = [
  "breakfast", "lunch", "wedding_lunch", "welcome_dinner", "mehndi", "sangeet",
  "cocktail_hour", "dinner_reception", "late_night_snacks", "dessert_only", "any",
];
const SPICE_LEVELS = ["mild", "medium", "hot"];
const PRICE_WEIGHTS = ["light", "standard", "premium"];
const VEG_NONVEG = ["veg", "nonveg"];

export type DraftItem = {
  id: string;
  name: string;
  course: string;
  vegNonveg: string;
  cuisineTags: string[];
  priceWeight: string;
  isStaple: boolean;
  allergens: string[];
  dietaryFlags: string[];
  religionSuitability: string[];
  occasionSuitability: string[];
  spiceLevel: string | null;
  prepMethod: string | null;
  confidence: string | null;
  reviewStatus: string;
};

function ChipToggleGroup({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string;
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <label className="field-full">
      {label}
      <div className="chip-group">
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            className="chip"
            aria-pressed={selected.includes(opt)}
            onClick={() => onToggle(opt)}
          >
            {formatSlug(opt)}
          </button>
        ))}
      </div>
    </label>
  );
}

export default function ReviewCard({ item }: { item: DraftItem }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Edit-mode local state, seeded from the draft's current values —
  // committed via PATCH only on explicit Save, so a stray click never
  // half-edits a dish silently.
  const [name, setName] = useState(item.name);
  const [course, setCourse] = useState(item.course);
  const [vegNonveg, setVegNonveg] = useState(item.vegNonveg);
  const [cuisineTags, setCuisineTags] = useState(item.cuisineTags);
  const [priceWeight, setPriceWeight] = useState(item.priceWeight);
  const [isStaple, setIsStaple] = useState(item.isStaple);
  const [allergens, setAllergens] = useState(item.allergens);
  const [dietaryFlags, setDietaryFlags] = useState(item.dietaryFlags);
  const [religionSuitability, setReligionSuitability] = useState(item.religionSuitability);
  const [occasionSuitability, setOccasionSuitability] = useState(item.occasionSuitability);
  const [spiceLevel, setSpiceLevel] = useState(item.spiceLevel ?? "");
  const [prepMethod, setPrepMethod] = useState(item.prepMethod ?? "");

  function toggle(list: string[], setList: (v: string[]) => void, value: string) {
    setList(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  }

  async function patch(body: Record<string, unknown>) {
    setSubmitting(true);
    await fetch(`/api/menu-item-drafts/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSubmitting(false);
    setEditing(false);
    router.refresh();
  }

  async function handleApprove() {
    await patch({ reviewStatus: "approved" });
  }

  async function handleReject() {
    await patch({ reviewStatus: "rejected" });
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    await patch({
      reviewStatus: "edited",
      name, course, vegNonveg, cuisineTags, priceWeight, isStaple,
      allergens, dietaryFlags, religionSuitability, occasionSuitability,
      spiceLevel: spiceLevel || null,
      prepMethod: prepMethod || null,
    });
  }

  // Editing used to swap the whole card for an inline form, cramped into
  // the same ~250px card-grid cell it was already too small for (found
  // directly from a screenshot, same session as the button-overflow fix).
  // A page-centered modal — same component AddOccasionModal already uses
  // (.modal-overlay/.modal-box/.modal-header) — gives it real room
  // regardless of how narrow the grid cell is.
  return (
    <>
      <div className="entity-card">
        <div className="entity-card-title">
          <span className={`diet-dot ${item.vegNonveg}`} />
          {item.name}
        </div>
        <div className="entity-card-meta">
          {formatSlug(item.course)} · {item.confidence ? `${formatSlug(item.confidence)} confidence` : "Confidence unknown"}
          {item.reviewStatus !== "pending" && <> · <strong>{formatSlug(item.reviewStatus)}</strong></>}
        </div>
        <div className="chip-row">
          {item.cuisineTags.map((t) => <span key={t} className="chip">{formatSlug(t)}</span>)}
          {item.isStaple && <span className="chip"><strong>Staple</strong></span>}
        </div>
        <div className="review-actions">
          <button className="btn-compact" onClick={handleApprove} disabled={submitting}>Approve</button>
          <button className="btn-compact btn-danger" onClick={handleReject} disabled={submitting}>Reject</button>
          <button className="btn-compact btn-outline" onClick={() => setEditing(true)} disabled={submitting}>Edit</button>
        </div>
      </div>

      {editing && (
        <div className="modal-overlay" onClick={() => setEditing(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Edit — {item.name}</h3>
              <button type="button" className="modal-close" onClick={() => setEditing(false)}>×</button>
            </div>
            <form onSubmit={handleSaveEdit} className="field-grid">
              <label className="field-full">
                Name
                <input value={name} onChange={(e) => setName(e.target.value)} required />
              </label>
              <label>
                Course
                <CustomSelect value={course} onChange={setCourse} options={COURSES.map((c) => ({ value: c, label: formatSlug(c) }))} />
              </label>
              <label>
                Veg / Non-veg
                <CustomSelect value={vegNonveg} onChange={setVegNonveg} options={VEG_NONVEG.map((v) => ({ value: v, label: formatSlug(v) }))} />
              </label>
              <label>
                Price Weight
                <CustomSelect value={priceWeight} onChange={setPriceWeight} options={PRICE_WEIGHTS.map((p) => ({ value: p, label: formatSlug(p) }))} />
              </label>
              <label>
                Spice Level
                <CustomSelect value={spiceLevel} onChange={setSpiceLevel} options={SPICE_LEVELS.map((s) => ({ value: s, label: formatSlug(s) }))} placeholder="None" />
              </label>
              <label>
                Prep Method
                <input value={prepMethod} onChange={(e) => setPrepMethod(e.target.value)} placeholder="e.g. fried, tandoor" />
              </label>
              <label className="tag-picklist-any">
                <input type="checkbox" checked={isStaple} onChange={(e) => setIsStaple(e.target.checked)} />
                Staple (exempt from the no-repeat ledger)
              </label>
              <ChipToggleGroup label="Cuisine Tags" options={CUISINE_TAGS} selected={cuisineTags} onToggle={(v) => toggle(cuisineTags, setCuisineTags, v)} />
              <ChipToggleGroup label="Allergens" options={ALLERGENS} selected={allergens} onToggle={(v) => toggle(allergens, setAllergens, v)} />
              <ChipToggleGroup label="Dietary Flags" options={DIETARY_FLAGS} selected={dietaryFlags} onToggle={(v) => toggle(dietaryFlags, setDietaryFlags, v)} />
              <ChipToggleGroup label="Religion Suitability" options={RELIGION_SUITABILITY} selected={religionSuitability} onToggle={(v) => toggle(religionSuitability, setReligionSuitability, v)} />
              <ChipToggleGroup label="Occasion Suitability" options={OCCASION_SUITABILITY} selected={occasionSuitability} onToggle={(v) => toggle(occasionSuitability, setOccasionSuitability, v)} />
              <div className="field-full" style={{ display: "flex", gap: "0.6rem" }}>
                <button type="submit" disabled={submitting}>{submitting ? "Saving..." : "Save & Mark Edited"}</button>
                <button type="button" className="btn-outline" onClick={() => setEditing(false)} disabled={submitting}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
