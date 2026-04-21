-- CreateTable
CREATE TABLE "page_clicks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "clicked_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "page_clicks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "page_clicks_clicked_at_idx" ON "page_clicks"("clicked_at");
