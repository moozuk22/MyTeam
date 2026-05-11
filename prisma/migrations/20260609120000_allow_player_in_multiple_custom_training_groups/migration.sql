DROP INDEX IF EXISTS "club_custom_training_group_players_player_id_key";

CREATE INDEX IF NOT EXISTS "club_custom_training_group_players_player_id_idx"
ON "club_custom_training_group_players"("player_id");
