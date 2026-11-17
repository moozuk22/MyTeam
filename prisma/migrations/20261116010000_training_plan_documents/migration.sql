CREATE TABLE "training_plan_documents" (
    "id" UUID NOT NULL,
    "club_id" UUID NOT NULL,
    "owner_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "training_plan_documents_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "training_plan_documents_club_id_fkey"
        FOREIGN KEY ("club_id") REFERENCES "clubs"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "training_plan_documents_owner_updated_idx"
    ON "training_plan_documents"("club_id", "owner_id", "updated_at", "id");
