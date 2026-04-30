CREATE TABLE "coach_groups" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "club_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "coach_groups_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "coach_groups_club_id_idx" ON "coach_groups"("club_id");

ALTER TABLE "coach_groups"
  ADD CONSTRAINT "coach_groups_club_id_fkey"
  FOREIGN KEY ("club_id") REFERENCES "clubs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "players"
  ADD COLUMN "coach_group_id" UUID;

ALTER TABLE "players"
  ADD CONSTRAINT "players_coach_group_id_fkey"
  FOREIGN KEY ("coach_group_id") REFERENCES "coach_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "admin_push_subscriptions"
  ADD COLUMN "coach_group_id" UUID;

ALTER TABLE "admin_push_subscriptions"
  ADD CONSTRAINT "admin_push_subscriptions_coach_group_id_fkey"
  FOREIGN KEY ("coach_group_id") REFERENCES "coach_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "admin_push_subscriptions_club_id_coach_group_id_is_active_idx"
  ON "admin_push_subscriptions"("club_id", "coach_group_id", "is_active");
