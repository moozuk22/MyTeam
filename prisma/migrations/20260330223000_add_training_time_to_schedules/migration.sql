ALTER TABLE "clubs"
ADD COLUMN "training_time" TEXT;

ALTER TABLE "club_training_group_schedules"
ADD COLUMN "training_time" TEXT;

ALTER TABLE "club_training_schedule_groups"
ADD COLUMN "training_time" TEXT;
