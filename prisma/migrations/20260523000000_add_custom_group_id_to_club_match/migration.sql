-- AlterTable
ALTER TABLE "club_matches" ADD COLUMN "custom_group_id" UUID;

-- CreateIndex
CREATE INDEX "club_matches_custom_group_id_idx" ON "club_matches"("custom_group_id");

-- AddForeignKey
ALTER TABLE "club_matches" ADD CONSTRAINT "club_matches_custom_group_id_fkey" FOREIGN KEY ("custom_group_id") REFERENCES "club_custom_training_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;
