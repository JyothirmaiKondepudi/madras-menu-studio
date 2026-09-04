import type { CuisineProfile, Event, MenuItem, Occasion, PriceTier } from "@prisma/client";
import { computeOptionPrice } from "../services/pricingService";
import { formatSlug } from "../../lib/formatSlug";

// Which courses make up an option depends on the occasion type — real
// caterers don't serve the same course structure at a cocktail hour as at
// a wedding lunch. A real wedding lunch spread has a veg main AND a
// non-veg main, rice, bread, and a dessert — not one dish per course — so
// a course name can appear twice: pickItem excludes whatever it already
// picked (via usedNonStapleIds), so a repeated "main" entry correctly
// yields a *second, different* main rather than repeating the first.
//
// This is the "Deluxe" baseline lineup for each occasion type — Standard
// and Premium are derived from it (see courseLineupForTier below). Sized
// to what the real seeded data actually supports per occasion type
// (checked directly against the database, not guessed): appetizers are
// almost entirely tagged cocktail_hour/sangeet (zero for wedding_lunch,
// dinner_reception, breakfast — so those omit it rather than guarantee a
// warning every single time), desserts skew toward dinner_reception,
// bread/rice are tagged "any" and available everywhere. Thinner occasions
// (mehndi, welcome_dinner, breakfast) get a shorter, still-honest baseline
// rather than padding it out with courses that don't exist for them yet —
// that gap is exactly why extracting the remaining source documents
// matters.
const DELUXE_LINEUP_BY_OCCASION: Record<string, string[]> = {
  cocktail_hour: ["appetizer", "appetizer", "appetizer", "beverage"],
  sangeet: ["appetizer", "appetizer", "main", "main", "dessert"],
  mehndi: ["appetizer", "main"],
  wedding_lunch: ["main", "main", "rice", "bread", "dessert"],
  welcome_dinner: ["main", "bread", "rice"],
  dinner_reception: ["main", "main", "rice", "bread", "dessert"],
  breakfast: ["main", "main"],
  late_night_snacks: ["snack", "snack"],
};
const DEFAULT_DELUXE_LINEUP = ["main", "main", "rice", "bread"];

// The three packages staff present to a client — a pricing/business
// decision (confirmed with user), not just a visual layout: Standard is a
// trimmed-down core menu, Deluxe is the considered full spread above, and
// Premium adds extra portions of whichever courses this occasion type
// already has real coverage for (rather than guessing at a new course the
// data doesn't support). Price isn't set separately per tier — it falls
// out naturally from computeOptionPrice(), since more dishes means a
// higher summed price without needing an artificial markup.
export const TIER_ORDER = ["standard", "deluxe", "premium"] as const;
export type Tier = (typeof TIER_ORDER)[number];
export const TIER_LABELS: Record<Tier, string> = {
  standard: "Standard",
  deluxe: "Deluxe",
  premium: "Premium",
};

function courseLineupForTier(deluxeLineup: string[], tier: Tier): string[] {
  if (tier === "deluxe") return deluxeLineup;
  if (tier === "standard") {
    // Trim the two least-essential (last-listed) courses, but never below
    // a 2-course minimum — some baselines (mehndi, breakfast) are already
    // that short, so Standard and Deluxe end up the same size there;
    // there's nothing smaller to honestly offer.
    const trimTo = Math.max(2, deluxeLineup.length - 2);
    return deluxeLineup.slice(0, trimTo);
  }
  // Premium: add one extra portion each of the first and last course in
  // the baseline — both are courses already proven to have data coverage
  // for this occasion type, so this is "more of what works," not a guess.
  return [...deluxeLineup, deluxeLineup[0], deluxeLineup[deluxeLineup.length - 1]];
}

export type GeneratedOptionDraft = {
  optionNumber: number;
  computedPricePerPerson: number;
  items: MenuItem[];
};

export type GenerationResult = {
  options: GeneratedOptionDraft[];
  warnings: string[];
};

// The one class in this backend (everything else is plain functions — see
// the plan doc for why). Unlike a stateless calculation, this one
// genuinely accumulates state: the set of used non-staple items grows as
// it walks Standard -> Deluxe -> Premium, so later tiers can't repeat what
// an earlier one already picked. Constructing it with the ledger's current
// contents (from noRepeatLedger.ts) means it also respects every item
// already used in *other* occasions of the same event.
export class MenuGenerator {
  private usedNonStapleIds: Set<string>;

  constructor(usedNonStapleIds: Set<string>) {
    // Copy so generating doesn't mutate whatever set the caller passed in.
    this.usedNonStapleIds = new Set(usedNonStapleIds);
  }

  generateForOccasion(
    occasion: Occasion,
    event: Event,
    cuisineProfile: CuisineProfile | null,
    priceTier: PriceTier | null,
    pool: MenuItem[]
  ): GenerationResult {
    const warnings: string[] = [];
    const options: GeneratedOptionDraft[] = [];
    const basePerPerson = priceTier ? Number(priceTier.basePerPerson) : 0;
    const deluxeLineup = DELUXE_LINEUP_BY_OCCASION[occasion.occasionType] ?? DEFAULT_DELUXE_LINEUP;

    // optionNumber stays 1/2/3 in the database (no schema change needed) —
    // 1=Standard, 2=Deluxe, 3=Premium by convention; TIER_LABELS is the
    // single place that mapping is defined, used by both this file's
    // warning text and the UI layer.
    TIER_ORDER.forEach((tier, index) => {
      const optionNumber = index + 1;
      const courseLineup = courseLineupForTier(deluxeLineup, tier);
      const chosen: MenuItem[] = [];
      // Separate from usedNonStapleIds (the cross-event ledger, staples
      // exempt) — this tracks every item chosen so far in *this one
      // option*, staples included. Without it, a course lineup needing the
      // same course twice (e.g. wedding_lunch's two "main" slots) could
      // pick the identical staple both times — CLAUDE.md's "staples can
      // repeat anywhere" is meant for a dal or naan reappearing across
      // *different* occasions, not the same dish listed twice within one
      // printed option (found by actually generating against real seeded
      // data: Dal Makhani, correctly tagged isStaple, filled every "main"
      // slot in an option because nothing ever ruled it out a second time).
      const usedInThisOption = new Set<string>();

      for (const course of courseLineup) {
        const candidate = this.pickItem(pool, course, occasion, event, cuisineProfile, usedInThisOption);
        if (!candidate) {
          // Never silently repeat a non-staple item — surface a warning
          // instead, per CLAUDE.md's no-repeat rule.
          warnings.push(
            `${TIER_LABELS[tier]}: no available "${formatSlug(course)}" dish left for this cuisine/occasion combination.`
          );
          continue;
        }
        chosen.push(candidate);
        usedInThisOption.add(candidate.id);
        if (!candidate.isStaple) this.usedNonStapleIds.add(candidate.id);
      }

      options.push({
        optionNumber,
        computedPricePerPerson: computeOptionPrice(basePerPerson, chosen),
        items: chosen,
      });
    });

    return { options, warnings };
  }

  private pickItem(
    pool: MenuItem[],
    course: string,
    occasion: Occasion,
    event: Event,
    cuisineProfile: CuisineProfile | null,
    usedInThisOption: Set<string>
  ): MenuItem | undefined {
    return pool.find((item) => {
      if (item.course !== course) return false;
      if (!item.isStaple && this.usedNonStapleIds.has(item.id)) return false;
      // Blocks a repeat within this one option regardless of staple status
      // — the cross-event ledger above only ever tracked non-staples, which
      // is right for "dal shows up at every occasion" but wrong for "dal
      // fills both main-course slots in the same option" (see the comment
      // at the call site in generateForOccasion).
      if (usedInThisOption.has(item.id)) return false;

      // Cuisine: only restrict if the profile actually specifies tags —
      // an empty profile means "no cuisine restriction."
      if (cuisineProfile && cuisineProfile.cuisineTags.length > 0) {
        const overlaps = item.cuisineTags.some((t) => cuisineProfile.cuisineTags.includes(t));
        if (!overlaps) return false;
      }

      // Occasion suitability: real seeded data sometimes uses "any",
      // sometimes lists occasions explicitly; an empty array means "no
      // restriction" (some seeded items never got this field populated).
      if (item.occasionSuitability.length > 0) {
        const suits =
          item.occasionSuitability.includes("any") ||
          item.occasionSuitability.includes(occasion.occasionType);
        if (!suits) return false;
      }

      // Religion suitability: real data spells out every allowed tradition
      // (e.g. ["christian","hindu","muslim","other"]) rather than always
      // using a single "any" sentinel — handle both conventions.
      if (event.tradition && item.religionSuitability.length > 0) {
        const suits =
          item.religionSuitability.includes("any") ||
          item.religionSuitability.includes(event.tradition);
        if (!suits) return false;
      }

      return true;
    });
  }
}
