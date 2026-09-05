-- AlterTable
ALTER TABLE "occasions" ADD COLUMN "dietary_preferences" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
