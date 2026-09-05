import { listDistinctCuisineTags } from "@/src/server/services/menuItemService";
import NewEventForm from "./NewEventForm";

// Same reason as app/events/page.tsx: this Server Component queries the
// database directly, so without forcing dynamic rendering Next.js tries to
// prerender it at build time — which needs a working DATABASE_URL during
// the build itself, not just at request time. That's fine locally (.env is
// present) but breaks on Vercel's build step.
export const dynamic = "force-dynamic";

// A Server Component wrapper so the cuisine-tags picklist can be fed real
// data (same split already used for the event-detail page) — the actual
// form stays a client component since it owns form state and does the
// POST itself.
export default async function NewEventPage() {
  const availableCuisineTags = await listDistinctCuisineTags();
  return <NewEventForm availableCuisineTags={availableCuisineTags} />;
}
