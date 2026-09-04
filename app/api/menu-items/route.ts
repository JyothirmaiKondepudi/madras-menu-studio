import { NextResponse } from "next/server";
import { listMenuItems } from "../../../src/server/services/menuItemService";

// File-based routing: this file living at app/api/menu-items/route.ts is
// what makes it respond to GET/POST at /api/menu-items — there's no
// decorator or route registration step like @GetMapping/@app.route.
export async function GET() {
  const menuItems = await listMenuItems();
  return NextResponse.json(menuItems);
}
