import { NextResponse } from "next/server";
import { deleteEvent, getEventWithDetails } from "@/src/server/services/eventService";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const event = await getEventWithDetails(id);
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });
  return NextResponse.json(event);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await deleteEvent(id);
  return NextResponse.json({ ok: true });
}
