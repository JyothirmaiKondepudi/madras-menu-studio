import type { Event, MenuItem, Occasion, PriceTier } from "@prisma/client";
import { computeOptionPrice, PRICE_WEIGHT_DOLLARS } from "../services/pricingService";
import { formatSlug } from "../../lib/formatSlug";

// Which courses make up an option depends on the occasion type — real
// caterers don't serve the same course structure at a cocktail hour as at
// a wedding lunch. Originally this was a fixed per-tier course *list*
// (trimmed for Standard, padded for Premium) — now it's a course
// *preference cycle*: generateForOccasion() walks through it repeatedly,
// picking one item per step, for as long as the tier's price budget allows
// (see fillToBudget below). Sized to what the real seeded data actually
// supports per occasion type (checked directly against the database, not
// guessed): appetizers are almost entirely tagged cocktail_hour/sangeet
// (zero for wedding_lunch, dinner_reception, breakfast — so those omit it),
// desserts skew toward dinner_reception, bread/rice are tagged "any" and
// available everywhere.
const DELUXE_LINEUP_BY_OCCASION: Record<string, string[]> = {
  cocktail_hour: ["appetizer", "appetizer", "appetizer", "beverage"],
  sangeet: ["appetizer", "appetizer", "main", "main", "dessert"],
  // "mehendi", not "mehndi" — matches the actual spelling used everywhere
  // else (the modal's OCCASION_TYPES, the manager's price sheet). This key
  // used to say "mehndi", silently never matching "mehendi" and falling
  // back to DEFAULT_DELUXE_LINEUP the whole time — found while reconciling
  // occasion types against the manager's sheet, not by design.
  mehendi: ["appetizer", "main"],
  wedding_lunch: ["main", "main", "rice", "bread", "dessert"],
  welcome_dinner: ["main", "bread", "rice"],
  // Renamed from dinner_reception — same occasion, the manager's actual
  // name for it is "Wedding Dinner" (confirmed with user; no existing
  // occasions in the DB used the old key, so this is a clean rename).
  wedding_dinner: ["main", "main", "rice", "bread", "dessert"],
  breakfast: ["main", "main"],
  late_night_snacks: ["snack", "snack"],
};
const DEFAULT_DELUXE_LINEUP = ["main", "main", "rice", "bread"];

// A narrow regional cuisine tag falls back to its broader region only when
// its own exact-tag pool comes up empty for a course (see
// pickItemWithFallback) — never a blanket substitute, so a well-covered
// specific cuisine still gets preferred first. Only mappings to a broader
// tag that's actually well-populated in the real data are worth having;
// checked directly against the DB, not guessed — gujarati/marathi/sindhi/
// bengali/bangladeshi/pakistani have no correspondingly-used "west_indian"/
// "east_indian" tag to fall back to, so they're left out rather than
// mapped to a parent tag that would just find nothing either way (that's a
// real data gap — extracting more source docs might help, but only if
// they happen to contain that specific cuisine's dishes; it's not
// something this fallback table can paper over).
const CUISINE_TAG_FALLBACK: Record<string, string> = {
  telugu_andhra: "south_indian",
  tamil: "south_indian",
  kerala: "south_indian",
  punjabi: "north_indian",
  rajasthani: "north_indian",
  kashmiri: "north_indian",
};

// Occasion.dietaryPreferences was wired up for selection/storage but never
// actually checked during generation — found by testing: selecting only
// "Vegetarian" still returned Lamb Madras and Fish Vindaloo. An item
// passes if it satisfies *any* selected preference (OR, not AND) — e.g.
// picking both Vegetarian and Vegan just means "either is fine," and
// picking both Vegetarian and Non-Vegetarian (how "mixed" gets expressed)
// correctly ends up unrestricted, since every item is one or the other.
// vegNonveg's third real value, "both", always satisfies either veg or
// non-veg preferences — it means the dish already works for both.
function itemSatisfiesDietaryPreferences(item: MenuItem, dietaryPreferences: string[]): boolean {
  if (dietaryPreferences.length === 0) return true;
  return dietaryPreferences.some((pref) => {
    if (pref === "vegetarian") {
      return item.vegNonveg === "veg" || item.vegNonveg === "both" || item.dietaryFlags.includes("vegetarian");
    }
    if (pref === "non_vegetarian") {
      return item.vegNonveg === "nonveg" || item.vegNonveg === "both";
    }
    if (pref === "vegan") return item.dietaryFlags.includes("vegan");
    if (pref === "jain") return item.dietaryFlags.includes("jain");
    return false;
  });
}

// The three packages staff present to a client — Standard/Deluxe/Premium
// mapping to the manager's min/mid/max per-person price (confirmed with
// user: he quotes a price range per occasion, negotiated per client, and
// how many dishes an option gets should scale with how much budget that
// price allows — the inverse of the old model, where a fixed course list
// decided dish count and price just fell out of summing it).
export const TIER_ORDER = ["standard", "deluxe", "premium"] as const;
export type Tier = (typeof TIER_ORDER)[number];
export const TIER_LABELS: Record<Tier, string> = {
  standard: "Standard",
  deluxe: "Deluxe",
  premium: "Premium",
};

// Legacy-only: used solely by the fallback path below, for an occasion
// created before min/maxPricePerPerson existed. Trims/pads a fixed course
// list the same way this whole file used to for every occasion.
function courseLineupForTier(deluxeLineup: string[], tier: Tier): string[] {
  if (tier === "deluxe") return deluxeLineup;
  if (tier === "standard") {
    const trimTo = Math.max(2, deluxeLineup.length - 2);
    return deluxeLineup.slice(0, trimTo);
  }
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
    cuisineTags: string[],
    priceTier: PriceTier | null,
    pool: MenuItem[]
  ): GenerationResult {
    const warnings: string[] = [];
    const options: GeneratedOptionDraft[] = [];
    const courseCycle = DELUXE_LINEUP_BY_OCCASION[occasion.occasionType] ?? DEFAULT_DELUXE_LINEUP;

    const hasPriceRange = occasion.minPricePerPerson != null && occasion.maxPricePerPerson != null;

    // optionNumber stays 1/2/3 in the database (no schema change needed) —
    // 1=Standard, 2=Deluxe, 3=Premium by convention; TIER_LABELS is the
    // single place that mapping is defined, used by both this file's
    // warning text and the UI layer.
    if (hasPriceRange) {
      const min = Number(occasion.minPricePerPerson);
      const max = Number(occasion.maxPricePerPerson);
      const targetByTier: Record<Tier, number> = {
        standard: min,
        deluxe: (min + max) / 2,
        premium: max,
      };

      // Generate biggest-budget-first (Premium, then Deluxe, then
      // Standard) even though options are stored/displayed in the usual
      // Standard->Deluxe->Premium order below — found by generating a real
      // wedding lunch where the vegetarian Tamil dessert pool had only one
      // dish in it: Deluxe (generated first, under the old order) grabbed
      // it, leaving Premium with none despite Premium having the larger
      // budget and needing more, not fewer, dishes. Whichever tier runs
      // first gets the freshest pool from the shared no-repeat ledger, so
      // the tier that's *supposed* to end up with the most should be the
      // one that runs first — otherwise a thinning pool can leave the
      // priciest tier cheaper and thinner than the ones below it.
      const resultsByTier = {} as Record<Tier, { chosen: MenuItem[]; ranOut: boolean }>;
      for (const tier of ["premium", "deluxe", "standard"] as const) {
        resultsByTier[tier] = this.fillToBudget(
          pool,
          courseCycle,
          occasion,
          event,
          cuisineTags,
          targetByTier[tier]
        );
      }

      TIER_ORDER.forEach((tier, index) => {
        const { chosen, ranOut } = resultsByTier[tier];
        if (chosen.length === 0) {
          warnings.push(
            `${TIER_LABELS[tier]}: no available dish found for this cuisine/occasion combination.`
          );
        } else if (ranOut) {
          // Distinct from an empty option — the budget allowed more, but
          // every course in the cycle ran dry before the target was
          // reached. Worth telling staff the price target may be under-met.
          warnings.push(
            `${TIER_LABELS[tier]}: ran out of matching dishes before reaching the $${targetByTier[tier].toFixed(2)} target.`
          );
        }
        options.push({
          optionNumber: index + 1,
          // No separate base fee — the manager's number *is* the full
          // per-person target, built entirely from summed dish weights.
          computedPricePerPerson: computeOptionPrice(0, chosen),
          items: chosen,
        });
      });
    } else {
      // Fallback for an occasion with no price range set (e.g. created
      // before this feature existed) — exactly today's old fixed-lineup
      // behavior, so nothing already in the database breaks.
      const basePerPerson = priceTier ? Number(priceTier.basePerPerson) : 0;

      TIER_ORDER.forEach((tier, index) => {
        const lineup = courseLineupForTier(courseCycle, tier);
        const chosen: MenuItem[] = [];
        const usedInThisOption = new Set<string>();

        for (const course of lineup) {
          const candidate = this.pickItemWithFallback(pool, course, occasion, event, cuisineTags, usedInThisOption);
          if (!candidate) {
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
          optionNumber: index + 1,
          computedPricePerPerson: computeOptionPrice(basePerPerson, chosen),
          items: chosen,
        });
      });
    }

    return { options, warnings };
  }

  // Walks courseCycle repeatedly (wrapping back to the start), adding one
  // item per step for as long as doing so wouldn't push the running total
  // over targetPrice — the manager's per-person price IS the dish-count
  // driver now, not the other way around. Always takes at least one item
  // (a menu option is never empty, even if that first dish alone already
  // meets or exceeds the target). Stops on: budget exhausted, a safety cap
  // (20 items — already generous for a real catering package), or a full
  // lap of the cycle with zero hits (pool has nothing left to offer any
  // course in it — `ranOut` signals this so the caller can warn if the
  // target price was never actually reached).
  private fillToBudget(
    pool: MenuItem[],
    courseCycle: string[],
    occasion: Occasion,
    event: Event,
    cuisineTags: string[],
    targetPrice: number
  ): { chosen: MenuItem[]; ranOut: boolean } {
    const MAX_ITEMS = 20;
    const chosen: MenuItem[] = [];
    const usedInThisOption = new Set<string>();
    let runningTotal = 0;
    let cycleIndex = 0;
    let consecutiveMisses = 0;

    while (chosen.length < MAX_ITEMS && consecutiveMisses < courseCycle.length) {
      const course = courseCycle[cycleIndex % courseCycle.length];
      cycleIndex++;

      const candidate = this.pickItemWithFallback(pool, course, occasion, event, cuisineTags, usedInThisOption);
      if (!candidate) {
        consecutiveMisses++;
        continue;
      }
      consecutiveMisses = 0;

      const price = PRICE_WEIGHT_DOLLARS[candidate.priceWeight] ?? 0;
      if (chosen.length > 0 && runningTotal + price > targetPrice) break;

      chosen.push(candidate);
      usedInThisOption.add(candidate.id);
      if (!candidate.isStaple) this.usedNonStapleIds.add(candidate.id);
      runningTotal += price;
    }

    const ranOut = consecutiveMisses >= courseCycle.length && runningTotal < targetPrice;
    return { chosen, ranOut };
  }

  // Tries the exact cuisine tags first; only if that finds nothing for
  // this course, retries once with each tag's broader region added
  // (CUISINE_TAG_FALLBACK) — e.g. a "Telugu" occasion with only
  // telugu_andhra dishes to draw from (found by generating against real
  // data: a Telugu breakfast came back completely empty because only 2
  // telugu_andhra mains exist and neither is breakfast-suitable) also gets
  // to try south_indian dishes, but only once its own specific pool is
  // confirmed empty for that course — never as a first-choice substitute.
  private pickItemWithFallback(
    pool: MenuItem[],
    course: string,
    occasion: Occasion,
    event: Event,
    cuisineTags: string[],
    usedInThisOption: Set<string>
  ): MenuItem | undefined {
    const strict = this.pickItem(pool, course, occasion, event, cuisineTags, usedInThisOption);
    if (strict) return strict;
    if (cuisineTags.length === 0) return undefined;

    const expandedTags = new Set(cuisineTags);
    for (const tag of cuisineTags) {
      const parent = CUISINE_TAG_FALLBACK[tag];
      if (parent) expandedTags.add(parent);
    }
    if (expandedTags.size === cuisineTags.length) return undefined; // nothing to fall back to

    return this.pickItem(pool, course, occasion, event, Array.from(expandedTags), usedInThisOption);
  }

  private pickItem(
    pool: MenuItem[],
    course: string,
    occasion: Occasion,
    event: Event,
    cuisineTags: string[],
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

      // Cuisine: only restrict if the occasion actually specifies tags —
      // an empty array means "no cuisine restriction."
      if (cuisineTags.length > 0) {
        const overlaps = item.cuisineTags.some((t) => cuisineTags.includes(t));
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

      if (!itemSatisfiesDietaryPreferences(item, occasion.dietaryPreferences)) return false;

      return true;
    });
  }
}
