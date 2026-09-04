import { prisma } from "../../lib/prisma";
import { slugifyTag } from "../../lib/slugify";

export async function createCuisineProfile(
  eventId: string,
  data: { name: string; cuisineTags: string[] }
) {
  // Defense in depth: the UI now sources tags from a picklist of real
  // MenuItem.cuisineTags values, so they arrive already normalized — but
  // normalizing again here means any future caller (a script, a different
  // form) can't reintroduce the "south indian" vs "south_indian" mismatch
  // that silently broke cuisine matching before (see slugify.ts).
  const cuisineTags = Array.from(
    new Set(data.cuisineTags.map(slugifyTag).filter(Boolean))
  );
  return prisma.cuisineProfile.create({
    data: { eventId, name: data.name, cuisineTags },
  });
}
