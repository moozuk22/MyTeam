ALTER TABLE "training_plans"
    ADD COLUMN "created_by_coach_group_id" UUID,
    ADD COLUMN "creator_name" TEXT,
    ADD CONSTRAINT "training_plans_created_by_coach_group_id_fkey"
        FOREIGN KEY ("created_by_coach_group_id") REFERENCES "coach_groups"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "training_plans_created_by_coach_group_id_idx"
    ON "training_plans"("created_by_coach_group_id");
