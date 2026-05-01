DO $$ BEGIN
  CREATE TYPE "billing_status" AS ENUM ('demo', 'active');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "clubs"
  ADD COLUMN IF NOT EXISTS "billing_status" "billing_status" NOT NULL DEFAULT 'demo',
  ADD COLUMN IF NOT EXISTS "first_billing_month" TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "billing_activated_at" TIMESTAMPTZ(6);

ALTER TABLE "players"
  ADD COLUMN IF NOT EXISTS "first_billing_month" TIMESTAMPTZ(6);
