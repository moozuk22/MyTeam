-- CreateTable
CREATE TABLE "training_plans" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "club_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "layout" JSONB NOT NULL,
    "created_by_user_id" UUID,
    "updated_by_user_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "training_plans_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "training_plans_club_id_idx" ON "training_plans"("club_id");

-- AddForeignKey
ALTER TABLE "training_plans" ADD CONSTRAINT "training_plans_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "clubs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
