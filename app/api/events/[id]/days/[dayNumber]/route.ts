import { NextResponse } from "next/server";
import { deleteOccasionsForDay } from "@/src/server/services/occasionService";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; dayNumber: string }> }
) {
  const { id, dayNumber } = await params;
  await deleteOccasionsForDay(id, Number(dayNumber));
  return NextResponse.json({ ok: true });
}
