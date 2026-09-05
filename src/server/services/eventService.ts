import { prisma } from "../../lib/prisma";

export async function listEvents() {
  return prisma.event.findMany({ orderBy: { createdAt: "desc" } });
}

export async function createEvent(data: {
  clientName: string;
  eventName: string;
  guestCount?: number | null;
  venue?: string | null;
  tradition?: string | null;
  startDate: Date;
  endDate: Date;
  defaultCuisineTags?: string[];
}) {
  return prisma.event.create({ data });
}

// Includes everything an event detail page needs in one query: its
// occasions in generation order (sequenceOrder matters — that's the order
// the no-repeat ledger fills in). No longer includes cuisineProfiles —
// the hero label now reads defaultCuisineTags directly (a plain scalar
// on Event itself, always present, no include needed).
export async function getEventWithDetails(id: string) {
  return prisma.event.findUnique({
    where: { id },
    include: {
      occasions: { orderBy: { sequenceOrder: "asc" } },
    },
  });
}

// No cascade configured in the schema, so children have to go first, in FK
// order: option items -> options -> occasions -> cuisine profiles -> event.
export async function deleteEvent(id: string) {
  await prisma.$transaction(async (tx) => {
    const occasions = await tx.occasion.findMany({ where: { eventId: id }, select: { id: true } });
    const occasionIds = occasions.map((o) => o.id);
    const options = await tx.generatedMenuOption.findMany({
      where: { occasionId: { in: occasionIds } },
      select: { id: true },
    });
    await tx.generatedMenuOptionItem.deleteMany({
      where: { generatedMenuOptionId: { in: options.map((o) => o.id) } },
    });
    await tx.generatedMenuOption.deleteMany({ where: { occasionId: { in: occasionIds } } });
    await tx.occasion.deleteMany({ where: { eventId: id } });
    await tx.cuisineProfile.deleteMany({ where: { eventId: id } });
    await tx.event.delete({ where: { id } });
  });
}
