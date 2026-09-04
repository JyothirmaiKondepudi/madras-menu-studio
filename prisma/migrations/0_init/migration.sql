-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'staff',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" TEXT NOT NULL,
    "created_by_user_id" TEXT,
    "client_name" TEXT NOT NULL,
    "event_name" TEXT NOT NULL,
    "tradition" TEXT,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cuisine_profiles" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cuisine_tags" TEXT[],

    CONSTRAINT "cuisine_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_tiers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "occasion_type" TEXT NOT NULL,
    "service_style" TEXT NOT NULL,
    "base_per_person" DECIMAL(8,2) NOT NULL,

    CONSTRAINT "price_tiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "occasions" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "cuisine_profile_id" TEXT,
    "price_tier_id" TEXT,
    "day_number" INTEGER NOT NULL,
    "sequence_order" INTEGER NOT NULL,
    "occasion_type" TEXT NOT NULL,
    "guest_count" INTEGER,
    "venue" TEXT,
    "service_type" TEXT,
    "service_time" TIMESTAMP(3),
    "atmosphere" TEXT,
    "veg_nonveg_ratio" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "occasions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "live_stations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "veg_nonveg" TEXT NOT NULL,
    "price_per_person" DECIMAL(8,2) NOT NULL,
    "equipment_needed" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "live_stations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "generated_menu_options" (
    "id" TEXT NOT NULL,
    "occasion_id" TEXT NOT NULL,
    "option_number" INTEGER NOT NULL,
    "computed_price_per_person" DECIMAL(8,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "generated_menu_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "generated_menu_option_items" (
    "id" TEXT NOT NULL,
    "generated_menu_option_id" TEXT NOT NULL,
    "menu_item_id" TEXT NOT NULL,
    "locked" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "generated_menu_option_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "jurisdiction" TEXT NOT NULL,
    "rate_percent" DECIMAL(5,3) NOT NULL,
    "effective_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tax_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "menu_items" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "course" TEXT NOT NULL,
    "veg_nonveg" TEXT NOT NULL,
    "cuisine_tags" TEXT[],
    "price_weight" TEXT NOT NULL,
    "is_staple" BOOLEAN NOT NULL DEFAULT false,
    "allergens" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "dietary_flags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "religion_suitability" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "occasion_suitability" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "spice_level" TEXT,
    "prep_method" TEXT,
    "portion_unit" TEXT,
    "cost_per_person" DECIMAL(8,2),
    "tax_category_id" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "confidence" TEXT,
    "source_docs" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "menu_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dish_references" (
    "id" TEXT NOT NULL,
    "menu_item_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "label" TEXT,
    "added_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dish_references_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_LiveStationToOccasion" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_LiveStationToOccasion_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "tax_categories_name_key" ON "tax_categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "menu_items_name_key" ON "menu_items"("name");

-- CreateIndex
CREATE INDEX "_LiveStationToOccasion_B_index" ON "_LiveStationToOccasion"("B");

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cuisine_profiles" ADD CONSTRAINT "cuisine_profiles_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "occasions" ADD CONSTRAINT "occasions_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "occasions" ADD CONSTRAINT "occasions_cuisine_profile_id_fkey" FOREIGN KEY ("cuisine_profile_id") REFERENCES "cuisine_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "occasions" ADD CONSTRAINT "occasions_price_tier_id_fkey" FOREIGN KEY ("price_tier_id") REFERENCES "price_tiers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generated_menu_options" ADD CONSTRAINT "generated_menu_options_occasion_id_fkey" FOREIGN KEY ("occasion_id") REFERENCES "occasions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generated_menu_option_items" ADD CONSTRAINT "generated_menu_option_items_generated_menu_option_id_fkey" FOREIGN KEY ("generated_menu_option_id") REFERENCES "generated_menu_options"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generated_menu_option_items" ADD CONSTRAINT "generated_menu_option_items_menu_item_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "menu_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_tax_category_id_fkey" FOREIGN KEY ("tax_category_id") REFERENCES "tax_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dish_references" ADD CONSTRAINT "dish_references_menu_item_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "menu_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dish_references" ADD CONSTRAINT "dish_references_added_by_user_id_fkey" FOREIGN KEY ("added_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_LiveStationToOccasion" ADD CONSTRAINT "_LiveStationToOccasion_A_fkey" FOREIGN KEY ("A") REFERENCES "live_stations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_LiveStationToOccasion" ADD CONSTRAINT "_LiveStationToOccasion_B_fkey" FOREIGN KEY ("B") REFERENCES "occasions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

