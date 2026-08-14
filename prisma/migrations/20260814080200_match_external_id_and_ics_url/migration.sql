-- AlterTable
ALTER TABLE "Match" ADD COLUMN "externalId" TEXT;

-- AlterTable
ALTER TABLE "SpielerplusConfig" RENAME COLUMN "teamUrl" TO "icsUrl";

-- CreateIndex
CREATE UNIQUE INDEX "Match_externalId_key" ON "Match"("externalId");
