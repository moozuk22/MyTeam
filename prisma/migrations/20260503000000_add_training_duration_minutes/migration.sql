ALTER TABLE "clubs"
ADD COLUMN "training_duration_minutes" INTEGER NOT NULL DEFAULT 60;

ALTER TABLE "club_training_group_schedules"
ADD COLUMN "training_duration_minutes" INTEGER NOT NULL DEFAULT 60;

ALTER TABLE "club_training_schedule_groups"
ADD COLUMN "training_duration_minutes" INTEGER NOT NULL DEFAULT 60;

ALTER TABLE "club_custom_training_groups"
ADD COLUMN "training_duration_minutes" INTEGER NOT NULL DEFAULT 60;

ALTER TABLE "coach_groups"
ADD COLUMN "training_duration_minutes" INTEGER NOT NULL DEFAULT 60;
