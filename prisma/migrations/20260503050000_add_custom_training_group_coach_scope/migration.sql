ALTER TABLE "club_custom_training_groups" ADD COLUMN "coach_group_id" UUID;

ALTER TABLE "club_custom_training_groups"
ADD CONSTRAINT "club_custom_training_groups_coach_group_id_fkey"
FOREIGN KEY ("coach_group_id") REFERENCES "coach_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "club_custom_training_groups_club_id_coach_group_id_idx"
ON "club_custom_training_groups"("club_id", "coach_group_id");
