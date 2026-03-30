ALTER TABLE "clubs"
ADD COLUMN "training_date_times" JSONB NOT NULL DEFAULT '{}'::JSONB;

ALTER TABLE "club_training_group_schedules"
ADD COLUMN "training_date_times" JSONB NOT NULL DEFAULT '{}'::JSONB;

ALTER TABLE "club_training_schedule_groups"
ADD COLUMN "training_date_times" JSONB NOT NULL DEFAULT '{}'::JSONB;
