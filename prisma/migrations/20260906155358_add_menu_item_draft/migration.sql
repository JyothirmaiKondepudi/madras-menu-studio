-- CreateTable: staging table for the ETL pipeline's `stage` subcommand —
-- unreviewed extracted dishes land here first, never directly in menu_items.
-- See MenuItemDraft's schema.prisma comment for the full review-flow context.
CREATE TABLE "menu_item_drafts" (
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
    "tax_category_id" TEXT,
    "confidence" TEXT,
    "source_docs" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "review_status" TEXT NOT NULL DEFAULT 'pending',
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "menu_item_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "menu_item_drafts_name_key" ON "menu_item_drafts"("name");

-- AddForeignKey
ALTER TABLE "menu_item_drafts" ADD CONSTRAINT "menu_item_drafts_tax_category_id_fkey" FOREIGN KEY ("tax_category_id") REFERENCES "tax_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
