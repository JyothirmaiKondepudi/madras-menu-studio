import { prisma } from "../../lib/prisma";

// Plain function, mirroring menuItemService.listMenuItems() — stateless,
// no arguments needed yet. Feeds the Live Stations picklist in
// AddOccasionModal; the 9 seeded stations never had any UI to select them
// before this.
export async function listLiveStations() {
  return prisma.liveStation.findMany({
    orderBy: { name: "asc" },
  });
}
