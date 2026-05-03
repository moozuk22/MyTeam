ALTER TABLE "clubs" ADD COLUMN "training_field_selections" JSONB;
ALTER TABLE "club_training_group_schedules" ADD COLUMN "training_field_selections" JSONB;
ALTER TABLE "club_training_schedule_groups" ADD COLUMN "training_field_selections" JSONB;
ALTER TABLE "club_custom_training_groups" ADD COLUMN "training_field_selections" JSONB;
ALTER TABLE "coach_groups" ADD COLUMN "training_field_selections" JSONB;
