-- Idempotent: fixes DBs where the color migration did not apply (e.g. blocked migrate runs)
-- while _prisma_migrations may still be inconsistent. Safe if the column already exists (PG11+).
ALTER TABLE "club_custom_training_groups" ADD COLUMN IF NOT EXISTS "color" TEXT;
