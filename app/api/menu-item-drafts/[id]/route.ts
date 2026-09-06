import { NextResponse } from "next/server";
import { updateDraftReview } from "@/src/server/services/menuItemDraftService";

const VALID_STATUSES = ["approved", "rejected", "edited"];

// One PATCH covers all three card actions (Approve / Reject / Save edit) —
// `reviewStatus` picks which; `edited` additionally carries whatever fields
// the customer corrected. No zod anywhere in this app (confirmed) — same
// inline-coercion validation style as app/api/events/route.ts.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();

  if (!VALID_STATUSES.includes(body.reviewStatus)) {
    return NextResponse.json(
      { error: `reviewStatus must be one of: ${VALID_STATUSES.join(", ")}` },
      { status: 400 }
    );
  }

  const edits =
    body.reviewStatus === "edited"
      ? {
          name: body.name,
          course: body.course,
          vegNonveg: body.vegNonveg,
          cuisineTags: Array.isArray(body.cuisineTags) ? body.cuisineTags : undefined,
          priceWeight: body.priceWeight,
          isStaple: typeof body.isStaple === "boolean" ? body.isStaple : undefined,
          allergens: Array.isArray(body.allergens) ? body.allergens : undefined,
          dietaryFlags: Array.isArray(body.dietaryFlags) ? body.dietaryFlags : undefined,
          religionSuitability: Array.isArray(body.religionSuitability) ? body.religionSuitability : undefined,
          occasionSuitability: Array.isArray(body.occasionSuitability) ? body.occasionSuitability : undefined,
          spiceLevel: body.spiceLevel || null,
          prepMethod: body.prepMethod || null,
        }
      : undefined;

  const draft = await updateDraftReview(id, body.reviewStatus, edits);
  return NextResponse.json(draft);
}
