import Link from "next/link";
import { listDrafts, countDraftsByStatus } from "@/src/server/services/menuItemDraftService";
import { formatSlug } from "@/src/lib/formatSlug";
import ReviewCard from "./ReviewCard";

// Server component reading Prisma directly (same split as
// app/events/[id]/page.tsx) — ReviewCard is the client component that owns
// the actual approve/reject/edit interaction.
//
// "9x9 / 16x16 grid" is implemented as page size (81 / 256 cards per page),
// not a literally fixed-column CSS grid — the existing .card-grid layout
// (app/globals.css) is a responsive auto-fill grid, so a rigid N-column
// force would break on narrower screens. Flag if a hard column count is
// actually wanted instead.
const STATUSES = ["pending", "approved", "edited", "rejected", "all"];

export default async function ReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string; size?: string }>;
}) {
  const sp = await searchParams;
  const status = STATUSES.includes(sp.status ?? "") ? (sp.status as string) : "pending";
  const pageSize = sp.size === "256" ? 256 : 81;
  const page = Math.max(1, Number(sp.page) || 1);

  const [{ items, total }, counts] = await Promise.all([
    listDrafts({ status, page, pageSize }),
    countDraftsByStatus(),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function pageLink(overrides: { status?: string; page?: number; size?: number }) {
    const params = new URLSearchParams({
      status: overrides.status ?? status,
      page: String(overrides.page ?? page),
      size: String(overrides.size ?? pageSize),
    });
    return `/review?${params.toString()}`;
  }

  return (
    <div className="page">
      <h1>Menu Item Review</h1>
      <p className="meta-line">
        Today&apos;s freshly-extracted dishes, staged for review before they go live.
        Approve, reject, or edit each one — nothing here reaches the real menu catalog
        until it&apos;s reviewed and promoted.
      </p>

      <div className="chip-row">
        {STATUSES.map((s) => (
          <Link
            key={s}
            href={pageLink({ status: s, page: 1 })}
            className="chip"
            aria-pressed={status === s}
          >
            {formatSlug(s)} ({s === "all" ? Object.values(counts).reduce((a, b) => a + b, 0) : counts[s] ?? 0})
          </Link>
        ))}
        <Link
          href={pageLink({ size: pageSize === 81 ? 256 : 81 })}
          className="chip"
        >
          {pageSize === 81 ? "Show 16×16 (256/page)" : "Show 9×9 (81/page)"}
        </Link>
      </div>

      {items.length === 0 && <p className="meta-line">Nothing here right now.</p>}

      <div className="card-grid">
        {items.map((item) => (
          <ReviewCard
            key={item.id}
            item={{
              id: item.id,
              name: item.name,
              course: item.course,
              vegNonveg: item.vegNonveg,
              cuisineTags: item.cuisineTags,
              priceWeight: item.priceWeight,
              isStaple: item.isStaple,
              allergens: item.allergens,
              dietaryFlags: item.dietaryFlags,
              religionSuitability: item.religionSuitability,
              occasionSuitability: item.occasionSuitability,
              spiceLevel: item.spiceLevel,
              prepMethod: item.prepMethod,
              confidence: item.confidence,
              reviewStatus: item.reviewStatus,
            }}
          />
        ))}
      </div>

      {totalPages > 1 && (
        <div className="chip-row">
          {page > 1 && <Link className="chip" href={pageLink({ page: page - 1 })}>← Prev</Link>}
          <span className="meta-line">Page {page} of {totalPages} ({total} total)</span>
          {page < totalPages && <Link className="chip" href={pageLink({ page: page + 1 })}>Next →</Link>}
        </div>
      )}
    </div>
  );
}
