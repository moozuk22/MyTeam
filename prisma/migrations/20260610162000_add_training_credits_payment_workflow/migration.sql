ALTER TYPE "payment_workflow" ADD VALUE IF NOT EXISTS 'training_credits';

ALTER TABLE "players"
  ADD COLUMN IF NOT EXISTS "remaining_training_credits" INTEGER NOT NULL DEFAULT 0;
