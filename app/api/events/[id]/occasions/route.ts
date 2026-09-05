import { NextResponse } from "next/server";
import { createOccasion } from "@/src/server/services/occasionService";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const occasion = await createOccasion(id, {
    dayNumber: Number(body.dayNumber),
    sequenceOrder: Number(body.sequenceOrder),
    occasionType: body.occasionType,
    guestCount: body.guestCount ? Number(body.guestCount) : null,
    serviceType: body.serviceType || null,
    cuisineProfileId: body.cuisineProfileId || null,
    cuisineTags: Array.isArray(body.cuisineTags) ? body.cuisineTags : [],
    priceTierId: body.priceTierId || null,
    minPricePerPerson: body.minPricePerPerson ? Number(body.minPricePerPerson) : null,
    maxPricePerPerson: body.maxPricePerPerson ? Number(body.maxPricePerPerson) : null,
    dietaryPreferences: Array.isArray(body.dietaryPreferences) ? body.dietaryPreferences : [],
    liveStationIds: Array.isArray(body.liveStationIds) ? body.liveStationIds : [],
  });
  return NextResponse.json(occasion, { status: 201 });
}
