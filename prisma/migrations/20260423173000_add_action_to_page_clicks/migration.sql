-- Add missing action column expected by Prisma schema/model
ALTER TABLE "page_clicks"
ADD COLUMN IF NOT EXISTS "action" TEXT NOT NULL DEFAULT 'unknown';

-- Add index used by admin page click stats queries
CREATE INDEX IF NOT EXISTS "page_clicks_action_idx" ON "page_clicks"("action");
