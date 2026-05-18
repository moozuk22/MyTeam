CREATE TABLE "limited_training_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "club_id" UUID NOT NULL,
  "scope_key" TEXT NOT NULL,
  "scope_id" UUID,
  "team_group" INTEGER,
  "training_date" DATE NOT NULL,
  "max_spots" INTEGER NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "limited_training_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "limited_training_events_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "clubs"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "limited_training_events_club_id_scope_key_training_date_key"
ON "limited_training_events"("club_id", "scope_key", "training_date");

CREATE INDEX "limited_training_events_club_id_idx"
ON "limited_training_events"("club_id");

CREATE INDEX "limited_training_events_training_date_idx"
ON "limited_training_events"("training_date");

CREATE TABLE "limited_training_registrations" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "event_id" UUID NOT NULL,
  "player_id" UUID NOT NULL,
  "registered_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "limited_training_registrations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "limited_training_registrations_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "limited_training_events"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "limited_training_registrations_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "limited_training_registrations_event_id_player_id_key"
ON "limited_training_registrations"("event_id", "player_id");

CREATE INDEX "limited_training_registrations_event_id_registered_at_idx"
ON "limited_training_registrations"("event_id", "registered_at");

CREATE INDEX "limited_training_registrations_player_id_idx"
ON "limited_training_registrations"("player_id");
