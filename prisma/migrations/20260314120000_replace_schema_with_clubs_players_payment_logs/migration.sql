CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DROP TABLE IF EXISTS "member_notifications" CASCADE;
DROP TABLE IF EXISTS "push_subscriptions" CASCADE;
DROP TABLE IF EXISTS "member_question_answers" CASCADE;
DROP TABLE IF EXISTS "questions" CASCADE;
DROP TABLE IF EXISTS "cards" CASCADE;
DROP TABLE IF EXISTS "members" CASCADE;
DROP TABLE IF EXISTS "payment_logs" CASCADE;
DROP TABLE IF EXISTS "players" CASCADE;
DROP TABLE IF EXISTS "clubs" CASCADE;
DROP TYPE IF EXISTS "player_status" CASCADE;

CREATE TYPE "player_status" AS ENUM ('paid', 'warning', 'overdue');

CREATE TABLE "clubs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "emblem_url" TEXT,
  CONSTRAINT "clubs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "clubs_slug_key" ON "clubs"("slug");

CREATE TABLE "players" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "club_id" UUID NOT NULL,
  "full_name" TEXT NOT NULL,
  "nfc_tag_id" TEXT NOT NULL,
  "status" "player_status" NOT NULL DEFAULT 'paid',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "jersey_number" TEXT,
  "birth_date" DATE,
  "team_group" INTEGER,
  "last_payment_date" TIMESTAMPTZ,
  "avatar_url" TEXT,
  CONSTRAINT "players_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "players_nfc_tag_id_key" ON "players"("nfc_tag_id");
CREATE INDEX "players_club_id_idx" ON "players"("club_id");

ALTER TABLE "players"
  ADD CONSTRAINT "players_club_id_fkey"
  FOREIGN KEY ("club_id")
  REFERENCES "clubs"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

CREATE TABLE "payment_logs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "player_id" UUID NOT NULL,
  "paid_for" TEXT NOT NULL,
  "paid_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "recorded_by" TEXT NOT NULL DEFAULT 'admin',
  CONSTRAINT "payment_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "payment_logs_player_id_idx" ON "payment_logs"("player_id");

ALTER TABLE "payment_logs"
  ADD CONSTRAINT "payment_logs_player_id_fkey"
  FOREIGN KEY ("player_id")
  REFERENCES "players"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION "set_players_updated_at"()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updated_at" = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "players_set_updated_at"
BEFORE UPDATE ON "players"
FOR EACH ROW
EXECUTE FUNCTION "set_players_updated_at"();
