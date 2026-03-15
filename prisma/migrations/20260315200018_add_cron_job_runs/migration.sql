/*
  Warnings:

  - You are about to drop the column `nfc_tag_id` on the `players` table. All the data in the column will be lost.
  - Changed the type of `paid_for` on the `payment_logs` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- DropIndex
DROP INDEX "players_nfc_tag_id_key";

-- AlterTable
ALTER TABLE "clubs" ADD COLUMN     "image_public_id" TEXT,
ADD COLUMN     "image_url" TEXT;

-- AlterTable
ALTER TABLE "payment_logs" DROP COLUMN "paid_for",
ADD COLUMN     "paid_for" TIMESTAMPTZ(6) NOT NULL;

-- AlterTable
ALTER TABLE "players" DROP COLUMN "nfc_tag_id",
ADD COLUMN     "image_public_id" TEXT,
ADD COLUMN     "image_url" TEXT;

-- CreateTable
CREATE TABLE "push_subscriptions" (
    "id" TEXT NOT NULL,
    "playerId" UUID NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userAgent" TEXT,
    "device" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player_notifications" (
    "id" TEXT NOT NULL,
    "playerId" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "url" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),

    CONSTRAINT "player_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cards" (
    "id" TEXT NOT NULL,
    "cardCode" TEXT NOT NULL,
    "playerId" UUID NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cron_job_runs" (
    "id" BIGSERIAL NOT NULL,
    "job_name" TEXT NOT NULL,
    "run_year" INTEGER NOT NULL,
    "run_month" INTEGER NOT NULL,
    "completed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cron_job_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "push_subscriptions_endpoint_key" ON "push_subscriptions"("endpoint");

-- CreateIndex
CREATE INDEX "push_subscriptions_playerId_isActive_idx" ON "push_subscriptions"("playerId", "isActive");

-- CreateIndex
CREATE INDEX "player_notifications_playerId_sentAt_idx" ON "player_notifications"("playerId", "sentAt");

-- CreateIndex
CREATE INDEX "player_notifications_playerId_readAt_idx" ON "player_notifications"("playerId", "readAt");

-- CreateIndex
CREATE UNIQUE INDEX "cards_cardCode_key" ON "cards"("cardCode");

-- CreateIndex
CREATE UNIQUE INDEX "cron_job_runs_job_name_run_year_run_month_key" ON "cron_job_runs"("job_name", "run_year", "run_month");

-- AddForeignKey
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_notifications" ADD CONSTRAINT "player_notifications_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cards" ADD CONSTRAINT "cards_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
