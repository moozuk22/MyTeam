-- Add coach-only persistent note per player (additive, no data loss)
ALTER TABLE "players" ADD COLUMN "coach_note" TEXT;

