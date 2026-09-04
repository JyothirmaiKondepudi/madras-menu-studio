import { prisma } from "../../lib/prisma";

export async function listPriceTiers() {
  return prisma.priceTier.findMany({ orderBy: { basePerPerson: "asc" } });
}
