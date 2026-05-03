CREATE TABLE "fields" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "club_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "fields_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "field_pieces" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "field_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "field_pieces_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "fields_club_id_idx" ON "fields"("club_id");
CREATE INDEX "field_pieces_field_id_idx" ON "field_pieces"("field_id");

ALTER TABLE "fields"
ADD CONSTRAINT "fields_club_id_fkey"
FOREIGN KEY ("club_id") REFERENCES "clubs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "field_pieces"
ADD CONSTRAINT "field_pieces_field_id_fkey"
FOREIGN KEY ("field_id") REFERENCES "fields"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "clubs"
ADD COLUMN "training_field_id" UUID,
ADD COLUMN "training_field_piece_id" UUID;

ALTER TABLE "club_training_group_schedules"
ADD COLUMN "training_field_id" UUID,
ADD COLUMN "training_field_piece_id" UUID;

ALTER TABLE "club_training_schedule_groups"
ADD COLUMN "training_field_id" UUID,
ADD COLUMN "training_field_piece_id" UUID;

ALTER TABLE "club_custom_training_groups"
ADD COLUMN "training_field_id" UUID,
ADD COLUMN "training_field_piece_id" UUID;

ALTER TABLE "coach_groups"
ADD COLUMN "training_field_id" UUID,
ADD COLUMN "training_field_piece_id" UUID;

CREATE INDEX "clubs_training_field_id_idx" ON "clubs"("training_field_id");
CREATE INDEX "clubs_training_field_piece_id_idx" ON "clubs"("training_field_piece_id");
CREATE INDEX "club_training_group_schedules_training_field_id_idx" ON "club_training_group_schedules"("training_field_id");
CREATE INDEX "club_training_group_schedules_training_field_piece_id_idx" ON "club_training_group_schedules"("training_field_piece_id");
CREATE INDEX "club_training_schedule_groups_training_field_id_idx" ON "club_training_schedule_groups"("training_field_id");
CREATE INDEX "club_training_schedule_groups_training_field_piece_id_idx" ON "club_training_schedule_groups"("training_field_piece_id");
CREATE INDEX "club_custom_training_groups_training_field_id_idx" ON "club_custom_training_groups"("training_field_id");
CREATE INDEX "club_custom_training_groups_training_field_piece_id_idx" ON "club_custom_training_groups"("training_field_piece_id");
CREATE INDEX "coach_groups_training_field_id_idx" ON "coach_groups"("training_field_id");
CREATE INDEX "coach_groups_training_field_piece_id_idx" ON "coach_groups"("training_field_piece_id");

ALTER TABLE "clubs"
ADD CONSTRAINT "clubs_training_field_id_fkey"
FOREIGN KEY ("training_field_id") REFERENCES "fields"("id") ON DELETE SET NULL ON UPDATE CASCADE,
ADD CONSTRAINT "clubs_training_field_piece_id_fkey"
FOREIGN KEY ("training_field_piece_id") REFERENCES "field_pieces"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "club_training_group_schedules"
ADD CONSTRAINT "club_training_group_schedules_training_field_id_fkey"
FOREIGN KEY ("training_field_id") REFERENCES "fields"("id") ON DELETE SET NULL ON UPDATE CASCADE,
ADD CONSTRAINT "club_training_group_schedules_training_field_piece_id_fkey"
FOREIGN KEY ("training_field_piece_id") REFERENCES "field_pieces"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "club_training_schedule_groups"
ADD CONSTRAINT "club_training_schedule_groups_training_field_id_fkey"
FOREIGN KEY ("training_field_id") REFERENCES "fields"("id") ON DELETE SET NULL ON UPDATE CASCADE,
ADD CONSTRAINT "club_training_schedule_groups_training_field_piece_id_fkey"
FOREIGN KEY ("training_field_piece_id") REFERENCES "field_pieces"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "club_custom_training_groups"
ADD CONSTRAINT "club_custom_training_groups_training_field_id_fkey"
FOREIGN KEY ("training_field_id") REFERENCES "fields"("id") ON DELETE SET NULL ON UPDATE CASCADE,
ADD CONSTRAINT "club_custom_training_groups_training_field_piece_id_fkey"
FOREIGN KEY ("training_field_piece_id") REFERENCES "field_pieces"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "coach_groups"
ADD CONSTRAINT "coach_groups_training_field_id_fkey"
FOREIGN KEY ("training_field_id") REFERENCES "fields"("id") ON DELETE SET NULL ON UPDATE CASCADE,
ADD CONSTRAINT "coach_groups_training_field_piece_id_fkey"
FOREIGN KEY ("training_field_piece_id") REFERENCES "field_pieces"("id") ON DELETE SET NULL ON UPDATE CASCADE;
