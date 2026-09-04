import { NextResponse } from "next/server";
import { deleteOccasion, getOccasionWithDetails } from "@/src/server/services/occasionService";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const occasion = await getOccasionWithDetails(id);
  if (!occasion) return NextResponse.json({ error: "Occasion not found" }, { status: 404 });
  return NextResponse.json(occasion);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await deleteOccasion(id);
  return NextResponse.json({ ok: true });
}
