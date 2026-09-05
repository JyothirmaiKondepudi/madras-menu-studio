// The manager's actual per-person price ranges by occasion type — the
// authoritative source is a handwritten sheet, transcribed and confirmed
// directly with the user (not guessed). Used only to *prefill* Min/Max
// Price in AddOccasionModal as a starting suggestion; staff can still
// freely override both fields per event, per CLAUDE.md's "he changes
// prices based on the person" rule. Replaces the old PriceTier-based
// prefill (a single basePerPerson value repeated into both fields) now
// that we have the real range for each type — PriceTier's own
// occasionType+serviceStyle-keyed shape never actually matched how this
// business prices things (there's no service-style breakdown here at
// all), so this is a plain lookup rather than a schema change.
export const OCCASION_PRICE_PRESETS: Record<string, { min: number; max: number }> = {
  breakfast: { min: 18, max: 44 },
  wedding_lunch: { min: 27, max: 70 },
  wedding_dinner: { min: 55, max: 250 },
  sangeet: { min: 48, max: 175 },
  cocktail_hour: { min: 25, max: 75 },
  mehendi: { min: 35, max: 140 },
  ceremony_refreshments: { min: 16, max: 35 },
  vidai_farewell_brunch: { min: 28, max: 68 },
  welcome_dinner: { min: 45, max: 95 },
  welcome_lunch: { min: 29, max: 79 },
  haldi: { min: 35, max: 65 },
  baraat: { min: 18, max: 35 },
  wedding_ceremony_snacks: { min: 12, max: 18 },
  walima: { min: 45, max: 175 },
  birthday: { min: 28, max: 55 },
  mundan: { min: 35, max: 75 },
  graduation: { min: 28, max: 45 },
  boxed_lunch: { min: 21, max: 35 },
  boxed_breakfast: { min: 18, max: 30 },
  high_tea: { min: 18, max: 40 },
  house_warming: { min: 35, max: 120 },
  anniversary: { min: 35, max: 90 },
};
