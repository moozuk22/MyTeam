CREATE TABLE "training_session_players" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "training_session_id" UUID NOT NULL,
  "player_id" UUID,
  "player_name" TEXT NOT NULL,
  "team_group" INTEGER,
  "present" BOOLEAN NOT NULL DEFAULT true,
  "reason_code" TEXT,
  "reason_text" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "training_session_players_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "training_session_players_training_session_id_fkey" FOREIGN KEY ("training_session_id") REFERENCES "training_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "training_session_players_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "training_session_players_training_session_id_player_id_key"
ON "training_session_players"("training_session_id", "player_id");

CREATE INDEX "training_session_players_player_id_idx"
ON "training_session_players"("player_id");

CREATE INDEX "training_session_players_training_session_id_idx"
ON "training_session_players"("training_session_id");
