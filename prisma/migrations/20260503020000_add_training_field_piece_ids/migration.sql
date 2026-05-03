-- Add training_field_piece_ids array column and migrate data from training_field_piece_id

ALTER TABLE "clubs" ADD COLUMN "training_field_piece_ids" UUID[] NOT NULL DEFAULT '{}';
UPDATE "clubs" SET "training_field_piece_ids" = ARRAY["training_field_piece_id"] WHERE "training_field_piece_id" IS NOT NULL;
ALTER TABLE "clubs" DROP COLUMN "training_field_piece_id";

ALTER TABLE "club_training_group_schedules" ADD COLUMN "training_field_piece_ids" UUID[] NOT NULL DEFAULT '{}';
UPDATE "club_training_group_schedules" SET "training_field_piece_ids" = ARRAY["training_field_piece_id"] WHERE "training_field_piece_id" IS NOT NULL;
ALTER TABLE "club_training_group_schedules" DROP COLUMN "training_field_piece_id";

ALTER TABLE "club_training_schedule_groups" ADD COLUMN "training_field_piece_ids" UUID[] NOT NULL DEFAULT '{}';
UPDATE "club_training_schedule_groups" SET "training_field_piece_ids" = ARRAY["training_field_piece_id"] WHERE "training_field_piece_id" IS NOT NULL;
ALTER TABLE "club_training_schedule_groups" DROP COLUMN "training_field_piece_id";

ALTER TABLE "club_custom_training_groups" ADD COLUMN "training_field_piece_ids" UUID[] NOT NULL DEFAULT '{}';
UPDATE "club_custom_training_groups" SET "training_field_piece_ids" = ARRAY["training_field_piece_id"] WHERE "training_field_piece_id" IS NOT NULL;
ALTER TABLE "club_custom_training_groups" DROP COLUMN "training_field_piece_id";

ALTER TABLE "coach_groups" ADD COLUMN "training_field_piece_ids" UUID[] NOT NULL DEFAULT '{}';
UPDATE "coach_groups" SET "training_field_piece_ids" = ARRAY["training_field_piece_id"] WHERE "training_field_piece_id" IS NOT NULL;
ALTER TABLE "coach_groups" DROP COLUMN "training_field_piece_id";
