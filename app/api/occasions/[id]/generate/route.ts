import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { getOccasionWithDetails } from "@/src/server/services/occasionService";
import { getUsedNonStapleItemIds } from "@/src/server/services/noRepeatLedger";
import { MenuGenerator } from "@/src/server/generation/MenuGenerator";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const occasion = await getOccasionWithDetails(id);
  if (!occasion) {
    return NextResponse.json({ error: "Occasion not found" }, { status: 404 });
  }

  // The ledger is scoped to the whole event, not just this occasion — that's
  // what makes the no-repeat rule work across occasions, not just within one.
  // Excludes this occasion's own existing picks, since they're about to be
  // deleted and replaced below — otherwise regenerating the same occasion
  // twice would count its own prior picks against itself.
  const usedNonStapleIds = await getUsedNonStapleItemIds(occasion.eventId, occasion.id);
  const pool = await prisma.menuItem.findMany({ where: { active: true } });

  const generator = new MenuGenerator(usedNonStapleIds);
  const { options, warnings } = generator.generateForOccasion(
    occasion,
    occasion.event,
    occasion.cuisineTags,
    occasion.priceTier,
    pool
  );

  // Live stations are a service decision, not a budget-driven dish pick —
  // confirmed with user: every selected station shows up in all 3 tiers
  // identically, and its price is added on top of the dish-driven target,
  // not counted against it (previously wired up for selection/storage
  // only — never actually attached to what got generated, so a selected
  // "Dosa Station" silently never appeared in any menu).
  const liveStationTotal = occasion.liveStations.reduce(
    (sum, s) => sum + Number(s.pricePerPerson),
    0
  );

  // Replace whatever was previously generated for this occasion, so
  // clicking "Generate" again during a demo doesn't pile up duplicate
  // option sets — delete children before parents (no cascade configured).
  const created = await prisma.$transaction(async (tx) => {
    const previous = await tx.generatedMenuOption.findMany({ where: { occasionId: id } });
    await tx.generatedMenuOptionItem.deleteMany({
      where: { generatedMenuOptionId: { in: previous.map((o) => o.id) } },
    });
    await tx.generatedMenuOption.deleteMany({ where: { occasionId: id } });

    const results = [];
    for (const option of options) {
      const row = await tx.generatedMenuOption.create({
        data: {
          occasionId: id,
          optionNumber: option.optionNumber,
          computedPricePerPerson: option.computedPricePerPerson + liveStationTotal,
          items: { create: option.items.map((item) => ({ menuItemId: item.id })) },
          ...(occasion.liveStations.length > 0
            ? { liveStations: { connect: occasion.liveStations.map((s) => ({ id: s.id })) } }
            : {}),
        },
        include: { items: { include: { menuItem: true } }, liveStations: true },
      });
      results.push(row);
    }
    return results;
  });

  return NextResponse.json({ options: created, warnings });
}
