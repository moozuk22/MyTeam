-- CreateTable
CREATE TABLE "club_matches" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "club_id" UUID NOT NULL,
    "opponent" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "match_date" TEXT NOT NULL,
    "match_time" TEXT NOT NULL,
    "team_groups" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "club_matches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "club_matches_club_id_idx" ON "club_matches"("club_id");

-- CreateIndex
CREATE INDEX "club_matches_match_date_idx" ON "club_matches"("match_date");

-- AddForeignKey
ALTER TABLE "club_matches" ADD CONSTRAINT "club_matches_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "clubs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
