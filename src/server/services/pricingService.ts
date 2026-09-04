import type { MenuItem } from "@prisma/client";

// Dishes don't carry a real dollar cost — priceWeight is just a rough
// ingredient-cost tier the ETL extraction guessed ("light"/"standard"/
// "premium"). These are placeholder per-person dollar add-ons — replace
// with real costing figures later, same as the ETL script's own
// placeholder tax rates (DEFAULT_TAX_CATEGORIES in menu_etl_pipeline.py).
export const PRICE_WEIGHT_DOLLARS: Record<string, number> = {
  light: 4,
  standard: 8,
  premium: 15,
};

// Business rule #2 from CLAUDE.md: PriceTier.basePerPerson, adjusted by the
// sum of every chosen item's priceWeight. Live-station add-ons are left out
// for today's demo (no live-station selection UI yet) — see the plan doc.
export function computeOptionPrice(basePerPerson: number, items: MenuItem[]): number {
  const itemsTotal = items.reduce(
    (sum, item) => sum + (PRICE_WEIGHT_DOLLARS[item.priceWeight] ?? 0),
    0
  );
  return basePerPerson + itemsTotal;
}
