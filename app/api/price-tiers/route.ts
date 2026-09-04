import { NextResponse } from "next/server";
import { listPriceTiers } from "@/src/server/services/priceTierService";

export async function GET() {
  const priceTiers = await listPriceTiers();
  return NextResponse.json(priceTiers);
}
