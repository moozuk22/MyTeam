ALTER TABLE "admin_notifications"
  ADD COLUMN IF NOT EXISTS "coach_group_id" UUID;

ALTER TABLE "admin_notifications"
  ADD CONSTRAINT "admin_notifications_coach_group_id_fkey"
  FOREIGN KEY ("coach_group_id") REFERENCES "coach_groups"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "admin_notifications_club_id_coach_group_id_read_at_idx"
  ON "admin_notifications"("club_id", "coach_group_id", "read_at");
