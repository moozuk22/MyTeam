CREATE TABLE "training_sessions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "club_id" UUID NOT NULL,
  "scope_type" TEXT NOT NULL,
  "scope_key" TEXT NOT NULL,
  "scope_id" UUID,
  "team_group" INTEGER,
  "team_groups" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
  "training_date" DATE NOT NULL,
  "training_time" TEXT,
  "training_duration_minutes" INTEGER NOT NULL DEFAULT 60,
  "training_field_id" UUID,
  "training_field_piece_ids" UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
  "status" TEXT NOT NULL DEFAULT 'scheduled',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "training_sessions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "training_sessions_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "clubs"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "training_sessions_club_id_scope_key_training_date_key"
ON "training_sessions"("club_id", "scope_key", "training_date");

CREATE INDEX "training_sessions_club_id_training_date_idx"
ON "training_sessions"("club_id", "training_date");

CREATE INDEX "training_sessions_club_id_scope_key_training_date_idx"
ON "training_sessions"("club_id", "scope_key", "training_date");
