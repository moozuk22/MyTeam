-- Add scope_key column to training_notes (defaults to 'club' for existing rows)
ALTER TABLE "training_notes" ADD COLUMN "scope_key" TEXT NOT NULL DEFAULT 'club';

-- Drop old unique index on (club_id, training_date) if it exists
DROP INDEX IF EXISTS "training_notes_club_id_training_date_key";

-- Add new unique constraint on (club_id, training_date, scope_key)
ALTER TABLE "training_notes" ADD CONSTRAINT "training_notes_club_id_training_date_scope_key_key" UNIQUE ("club_id", "training_date", "scope_key");
