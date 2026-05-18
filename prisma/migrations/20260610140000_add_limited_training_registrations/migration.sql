CREATE TABLE IF NOT EXISTS "limited_training_registrations" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "event_id" UUID NOT NULL,
  "player_id" UUID NOT NULL,
  "registered_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "limited_training_registrations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "limited_training_registrations_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "limited_training_events"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "limited_training_registrations_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "limited_training_registrations_event_id_player_id_key"
ON "limited_training_registrations"("event_id", "player_id");

CREATE INDEX IF NOT EXISTS "limited_training_registrations_event_id_registered_at_idx"
ON "limited_training_registrations"("event_id", "registered_at");

CREATE INDEX IF NOT EXISTS "limited_training_registrations_player_id_idx"
ON "limited_training_registrations"("player_id");
