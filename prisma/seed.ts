// One-time (re-runnable) script to load prisma/seed-data/*.json into
// Postgres via Prisma Client. Run with:
//   npx prisma db seed
// (wired up via the "prisma.seed" entry in package.json)
//
// This is separate from menu_etl_pipeline.py's `load` stage — that script
// inserts via raw SQL/psycopg2 independent of the app. This script does the
// same job through Prisma Client instead, which is what actually matters
// here: the app's own types (and the no-repeat/pricing logic later) all go
// through Prisma, so seeding through it too keeps one source of truth for
// how these tables get written.

import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";

const prisma = new PrismaClient();

// __dirname isn't available under "type": "module" — build paths from this
// file's own URL instead.
const seedDataUrl = new URL("./seed-data/", import.meta.url);

function loadJson<T>(filename: string): T {
  const fileUrl = new URL(filename, seedDataUrl);
  return JSON.parse(readFileSync(fileUrl, "utf-8")) as T;
}

// Same placeholder rates as menu_etl_pipeline.py's DEFAULT_TAX_CATEGORIES —
// replace with real state/county figures before this feeds real quotes.
const DEFAULT_TAX_CATEGORIES = [
  { name: "prepared_food", jurisdiction: "FL", ratePercent: 7.0 },
  { name: "alcohol", jurisdiction: "FL", ratePercent: 7.0 },
  { name: "equipment_rental", jurisdiction: "FL", ratePercent: 7.0 },
  { name: "service_labor", jurisdiction: "FL", ratePercent: 0.0 },
];

type MenuItemSeed = {
  name: string;
  course: string;
  veg_nonveg: string;
  cuisine_tags?: string[];
  price_weight: string;
  is_staple?: boolean;
  allergens?: string[];
  dietary_flags?: string[];
  religion_suitability?: string[];
  occasion_suitability?: string[];
  spice_level?: string | null;
  prep_method?: string | null;
  tax_category?: string;
  confidence?: string | null;
  example_sources?: string[];
};

type PriceTierSeed = {
  name: string;
  occasion_type: string;
  service_style: string;
  base_per_person: number;
};

type LiveStationSeed = {
  name: string;
  region: string;
  veg_nonveg: string;
  price_per_person: number;
  equipment_needed?: string[];
};

async function main() {
  // Tax categories first — menu items reference them by name (upsert so
  // re-running this script doesn't error on the unique `name` constraint).
  for (const tc of DEFAULT_TAX_CATEGORIES) {
    await prisma.taxCategory.upsert({
      where: { name: tc.name },
      update: {},
      create: tc,
    });
  }
  const taxCategories = await prisma.taxCategory.findMany();
  const taxCategoryIdByName = new Map(taxCategories.map((t) => [t.name, t.id]));

  // Price tiers and live stations have no unique constraint to upsert on,
  // so guard against duplicating rows if this script gets run twice.
  const priceTiers = loadJson<PriceTierSeed[]>("price_tiers_seed.json");
  if ((await prisma.priceTier.count()) === 0) {
    await prisma.priceTier.createMany({
      data: priceTiers.map((pt) => ({
        name: pt.name,
        occasionType: pt.occasion_type,
        serviceStyle: pt.service_style,
        basePerPerson: pt.base_per_person,
      })),
    });
  }

  const liveStations = loadJson<LiveStationSeed[]>("live_stations_seed.json");
  if ((await prisma.liveStation.count()) === 0) {
    await prisma.liveStation.createMany({
      data: liveStations.map((ls) => ({
        name: ls.name,
        region: ls.region,
        vegNonveg: ls.veg_nonveg,
        pricePerPerson: ls.price_per_person,
        equipmentNeeded: ls.equipment_needed ?? [],
      })),
    });
  }

  const menuItems = loadJson<MenuItemSeed[]>("menu_items_seed.json");
  for (const mi of menuItems) {
    await prisma.menuItem.upsert({
      where: { name: mi.name },
      update: {},
      create: {
        name: mi.name,
        course: mi.course,
        vegNonveg: mi.veg_nonveg,
        cuisineTags: mi.cuisine_tags ?? [],
        priceWeight: mi.price_weight,
        isStaple: mi.is_staple ?? false,
        allergens: mi.allergens ?? [],
        dietaryFlags: mi.dietary_flags ?? [],
        religionSuitability: mi.religion_suitability ?? [],
        occasionSuitability: mi.occasion_suitability ?? [],
        spiceLevel: mi.spice_level ?? null,
        prepMethod: mi.prep_method ?? null,
        taxCategoryId: mi.tax_category ? taxCategoryIdByName.get(mi.tax_category) : null,
        confidence: mi.confidence ?? null,
        sourceDocs: mi.example_sources ?? [],
        active: true,
      },
    });
  }

  console.log(
    `Seeded ${DEFAULT_TAX_CATEGORIES.length} tax categories, ${priceTiers.length} price tiers, ` +
      `${liveStations.length} live stations, ${menuItems.length} menu items.`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
