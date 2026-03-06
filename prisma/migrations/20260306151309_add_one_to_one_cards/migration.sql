/*
  Warnings:

  - You are about to drop the `admins` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "admins";

-- CreateTable
CREATE TABLE "cards" (
    "id" TEXT NOT NULL,
    "cardCode" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cards_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cards_cardCode_key" ON "cards"("cardCode");

-- CreateIndex
CREATE UNIQUE INDEX "cards_memberId_key" ON "cards"("memberId");

-- AddForeignKey
ALTER TABLE "cards" ADD CONSTRAINT "cards_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
