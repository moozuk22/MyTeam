-- AlterTable
ALTER TABLE "club_matches" ADD COLUMN "duration_minutes" INTEGER NOT NULL DEFAULT 90,
ADD COLUMN "is_home" BOOLEAN NOT NULL DEFAULT true;
