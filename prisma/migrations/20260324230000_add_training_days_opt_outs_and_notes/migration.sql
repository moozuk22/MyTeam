ALTER TABLE "clubs"
ADD COLUMN "training_weekdays" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
ADD COLUMN "training_window_days" INTEGER NOT NULL DEFAULT 30;

CREATE TABLE "training_opt_outs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "player_id" UUID NOT NULL,
    "training_date" DATE NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "training_opt_outs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "training_notes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "club_id" UUID NOT NULL,
    "training_date" DATE NOT NULL,
    "note" TEXT,
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "training_notes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "training_opt_outs_player_id_training_date_key"
ON "training_opt_outs"("player_id", "training_date");

CREATE INDEX "training_opt_outs_training_date_idx"
ON "training_opt_outs"("training_date");

CREATE UNIQUE INDEX "training_notes_club_id_training_date_key"
ON "training_notes"("club_id", "training_date");

CREATE INDEX "training_notes_training_date_idx"
ON "training_notes"("training_date");

ALTER TABLE "training_opt_outs"
ADD CONSTRAINT "training_opt_outs_player_id_fkey"
FOREIGN KEY ("player_id") REFERENCES "players"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "training_notes"
ADD CONSTRAINT "training_notes_club_id_fkey"
FOREIGN KEY ("club_id") REFERENCES "clubs"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
