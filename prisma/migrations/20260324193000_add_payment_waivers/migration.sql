CREATE TABLE "payment_waivers" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "player_id" UUID NOT NULL,
  "waived_for" TIMESTAMPTZ(6) NOT NULL,
  "reason" TEXT,
  "created_by" TEXT NOT NULL DEFAULT 'admin',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "payment_waivers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "payment_waivers_player_id_waived_for_key"
ON "payment_waivers"("player_id", "waived_for");

CREATE INDEX "payment_waivers_player_id_idx"
ON "payment_waivers"("player_id");

ALTER TABLE "payment_waivers"
  ADD CONSTRAINT "payment_waivers_player_id_fkey"
  FOREIGN KEY ("player_id") REFERENCES "players"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
