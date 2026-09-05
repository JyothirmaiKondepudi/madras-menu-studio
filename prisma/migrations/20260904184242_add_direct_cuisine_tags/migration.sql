-- AlterTable
ALTER TABLE "events" ADD COLUMN "default_cuisine_tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "occasions" ADD COLUMN "cuisine_tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Backfill: preserve existing occasions' cuisine restriction so generation
-- behavior doesn't silently change for data created before this migration.
UPDATE "occasions" o SET "cuisine_tags" = cp."cuisine_tags"
FROM "cuisine_profiles" cp
WHERE o."cuisine_profile_id" = cp."id";
