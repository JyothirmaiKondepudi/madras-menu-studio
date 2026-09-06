import { prisma } from "../../lib/prisma";

const DEFAULT_PAGE_SIZE = 81; // 9x9 — see app/review/page.tsx for the 16x16 (256) option

// Plain functions, same house style as menuItemService.ts/eventService.ts —
// no class, nothing "new"'d up.
export async function listDrafts({
  status = "pending",
  page = 1,
  pageSize = DEFAULT_PAGE_SIZE,
}: {
  status?: string;
  page?: number;
  pageSize?: number;
}) {
  const where = status === "all" ? {} : { reviewStatus: status };
  const [items, total] = await Promise.all([
    prisma.menuItemDraft.findMany({
      where,
      orderBy: { name: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.menuItemDraft.count({ where }),
  ]);
  return { items, total, page, pageSize };
}

export async function countDraftsByStatus() {
  const rows = await prisma.menuItemDraft.groupBy({
    by: ["reviewStatus"],
    _count: true,
  });
  const counts: Record<string, number> = {};
  for (const row of rows) counts[row.reviewStatus] = row._count;
  return counts;
}

// A dish's full editable field set — every dish attribute a card's edit
// mode can change. reviewStatus is handled by the caller (approve/reject
// are just this with a fixed status), never left implicit.
type DraftEdits = Partial<{
  name: string;
  course: string;
  vegNonveg: string;
  cuisineTags: string[];
  priceWeight: string;
  isStaple: boolean;
  allergens: string[];
  dietaryFlags: string[];
  religionSuitability: string[];
  occasionSuitability: string[];
  spiceLevel: string | null;
  prepMethod: string | null;
}>;

export async function updateDraftReview(
  id: string,
  reviewStatus: "approved" | "rejected" | "edited",
  edits?: DraftEdits
) {
  return prisma.menuItemDraft.update({
    where: { id },
    data: {
      ...edits,
      reviewStatus,
      reviewedAt: new Date(),
    },
  });
}
