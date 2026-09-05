import { listDistinctCuisineTags } from "@/src/server/services/menuItemService";
import NewEventForm from "./NewEventForm";

// A Server Component wrapper so the cuisine-tags picklist can be fed real
// data (same split already used for the event-detail page) — the actual
// form stays a client component since it owns form state and does the
// POST itself.
export default async function NewEventPage() {
  const availableCuisineTags = await listDistinctCuisineTags();
  return <NewEventForm availableCuisineTags={availableCuisineTags} />;
}
