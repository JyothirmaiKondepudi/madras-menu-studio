import { prisma } from "../../lib/prisma";

export async function createOccasion(
  eventId: string,
  data: {
    dayNumber: number;
    sequenceOrder: number;
    occasionType: string;
    guestCount?: number | null;
    serviceType?: string | null;
    cuisineProfileId?: string | null;
    priceTierId?: string | null;
  }
) {
  return prisma.occasion.create({ data: { eventId, ...data } });
}

// No cascade configured in the schema — children (option items, then
// options) go first, same pattern as the generate route's own delete step.
export async function deleteOccasion(id: string) {
  await prisma.$transaction(async (tx) => {
    const options = await tx.generatedMenuOption.findMany({ where: { occasionId: id }, select: { id: true } });
    await tx.generatedMenuOptionItem.deleteMany({
      where: { generatedMenuOptionId: { in: options.map((o) => o.id) } },
    });
    await tx.generatedMenuOption.deleteMany({ where: { occasionId: id } });
    await tx.occasion.delete({ where: { id } });
  });
}

// Deletes every occasion on one day of an event — used by "delete this
// day." Does not renumber later days down to close the gap; a day with
// nothing on it just reads as empty, same as one that was never filled in.
export async function deleteOccasionsForDay(eventId: string, dayNumber: number) {
  await prisma.$transaction(async (tx) => {
    const occasions = await tx.occasion.findMany({ where: { eventId, dayNumber }, select: { id: true } });
    const occasionIds = occasions.map((o) => o.id);
    const options = await tx.generatedMenuOption.findMany({
      where: { occasionId: { in: occasionIds } },
      select: { id: true },
    });
    await tx.generatedMenuOptionItem.deleteMany({
      where: { generatedMenuOptionId: { in: options.map((o) => o.id) } },
    });
    await tx.generatedMenuOption.deleteMany({ where: { occasionId: { in: occasionIds } } });
    await tx.occasion.deleteMany({ where: { id: { in: occasionIds } } });
  });
}

// Everything the occasion detail/generation page needs: the parent event
// (for its tradition, used by religion-suitability filtering), the cuisine
// profile and price tier it's configured with, and any already-generated
// options with their items and full dish records.
export async function getOccasionWithDetails(id: string) {
  return prisma.occasion.findUnique({
    where: { id },
    include: {
      event: true,
      cuisineProfile: true,
      priceTier: true,
      generatedOptions: {
        orderBy: { optionNumber: "asc" },
        include: { items: { include: { menuItem: true } } },
      },
    },
  });
}
