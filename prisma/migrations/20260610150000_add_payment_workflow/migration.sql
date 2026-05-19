DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_workflow') THEN
    CREATE TYPE "payment_workflow" AS ENUM ('calendar_month', 'rolling_30_days');
  END IF;
END $$;

ALTER TABLE "clubs"
ADD COLUMN IF NOT EXISTS "payment_workflow" "payment_workflow" NOT NULL DEFAULT 'calendar_month';
