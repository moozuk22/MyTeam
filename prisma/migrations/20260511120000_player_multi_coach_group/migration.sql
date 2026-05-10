-- CreateTable: implicit many-to-many join table for CoachGroup <-> Player
CREATE TABLE "_PlayerCoachGroups" (
    "A" UUID NOT NULL,
    "B" UUID NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_PlayerCoachGroups_AB_unique" ON "_PlayerCoachGroups"("A", "B");
CREATE INDEX "_PlayerCoachGroups_B_index" ON "_PlayerCoachGroups"("B");

-- AddForeignKey
ALTER TABLE "_PlayerCoachGroups" ADD CONSTRAINT "_PlayerCoachGroups_A_fkey" FOREIGN KEY ("A") REFERENCES "coach_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_PlayerCoachGroups" ADD CONSTRAINT "_PlayerCoachGroups_B_fkey" FOREIGN KEY ("B") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Migrate existing single coach_group_id assignments into the join table
INSERT INTO "_PlayerCoachGroups" ("A", "B")
SELECT "coach_group_id", "id" FROM "players" WHERE "coach_group_id" IS NOT NULL;

-- DropForeignKey
ALTER TABLE "players" DROP CONSTRAINT "players_coach_group_id_fkey";

-- AlterTable: remove the old single-value column
ALTER TABLE "players" DROP COLUMN "coach_group_id";
