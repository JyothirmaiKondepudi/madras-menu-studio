import { prisma } from "../../lib/prisma";

// Plain function, not a class — this is stateless: given no arguments (for
// now), return the active dish list. Nothing here needs to be "new"'d up.
export async function listMenuItems() {
  return prisma.menuItem.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
  });
}

// Feeds the CuisineProfile tag picklist in AddOccasionModal — real, valid
// tag values only, so a profile can't be created with a tag that doesn't
// actually exist on any dish (the free-text field this replaced allowed
// exactly that, silently). cuisineTags is a Postgres text[] column, so
// distinct-on-array-values isn't a single query Prisma can express —
// fetch the arrays and flatten/dedupe in JS instead (the item count is in
// the hundreds, not a real cost).
export async function listDistinctCuisineTags(): Promise<string[]> {
  const items = await prisma.menuItem.findMany({
    where: { active: true },
    select: { cuisineTags: true },
  });
  const tags = new Set<string>();
  for (const item of items) for (const tag of item.cuisineTags) tags.add(tag);
  return Array.from(tags).sort();
}
