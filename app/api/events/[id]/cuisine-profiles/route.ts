import { NextResponse } from "next/server";
import { createCuisineProfile } from "@/src/server/services/cuisineProfileService";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const profile = await createCuisineProfile(id, {
    name: body.name,
    cuisineTags: body.cuisineTags,
  });
  return NextResponse.json(profile, { status: 201 });
}
