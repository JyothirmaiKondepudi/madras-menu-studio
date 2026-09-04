import { prisma } from "../../lib/prisma";

// Business rule #1 from CLAUDE.md: a non-staple MenuItem can't appear more
// than once across an entire Event (every occasion, all 3 options each).
// This is deliberately a derived query, not a stored ledger table — it
// walks GeneratedMenuOptionItem up through GeneratedMenuOption -> Occasion
// to this event, and excludes staples (chai, rice, dal, naan, etc., which
// are exempt and can repeat anywhere).
//
// `excludeOccasionId` matters for regeneration: the generate route deletes
// an occasion's own previous options and creates fresh ones, but it computes
// the ledger *before* that delete happens (so generation and the delete can
// stay in one atomic transaction). Without excluding the occasion being
// regenerated, its own about-to-be-replaced picks would count as
// permanently "used" against itself — on a thin course pool (e.g. only 3
// breakfast-suitable mains total), a second click of "Generate" on the same
// occasion would see all 3 already "used" by itself and return nothing.
export async function getUsedNonStapleItemIds(
  eventId: string,
  excludeOccasionId?: string
): Promise<Set<string>> {
  const rows = await prisma.generatedMenuOptionItem.findMany({
    where: {
      menuItem: { isStaple: false },
      generatedMenuOption: {
        occasion: {
          eventId,
          ...(excludeOccasionId ? { id: { not: excludeOccasionId } } : {}),
        },
      },
    },
    select: { menuItemId: true },
  });
  return new Set(rows.map((r) => r.menuItemId));
}
