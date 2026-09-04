import { NextResponse } from "next/server";
import { createEvent, listEvents } from "@/src/server/services/eventService";

export async function GET() {
  const events = await listEvents();
  return NextResponse.json(events);
}

export async function POST(request: Request) {
  const body = await request.json();
  const event = await createEvent({
    clientName: body.clientName,
    eventName: body.eventName,
    guestCount: body.guestCount ? Number(body.guestCount) : null,
    venue: body.venue || null,
    tradition: body.tradition || null,
    startDate: new Date(body.startDate),
    endDate: new Date(body.endDate),
  });
  return NextResponse.json(event, { status: 201 });
}
