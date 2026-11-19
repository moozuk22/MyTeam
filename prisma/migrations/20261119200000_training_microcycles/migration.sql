CREATE TABLE "training_microcycles" (
 "id" UUID NOT NULL DEFAULT gen_random_uuid(),
 "club_id" UUID NOT NULL REFERENCES "clubs"("id") ON DELETE CASCADE,
 "group_key" TEXT NOT NULL,
 "group_name" TEXT NOT NULL,
 "week" TEXT NOT NULL,
 "content" JSONB NOT NULL,
 "revision" INTEGER NOT NULL DEFAULT 1,
 PRIMARY KEY ("id"),
 UNIQUE ("club_id", "group_key", "week")
);
