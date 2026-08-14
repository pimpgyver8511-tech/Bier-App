-- CreateEnum
CREATE TYPE "ImportSource" AS ENUM ('SEITE3', 'OFFEN', 'GUTHABEN');

-- AlterTable
ALTER TABLE "KastenAssignment" ALTER COLUMN "matchId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "KastenImportRow" (
    "id" TEXT NOT NULL,
    "source" "ImportSource" NOT NULL,
    "rawDate" TEXT,
    "resolvedDate" TIMESTAMP(3),
    "nickname" TEXT NOT NULL,
    "reason" TEXT,
    "count" INTEGER NOT NULL DEFAULT 1,
    "suggestedPlayerId" TEXT,
    "playerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KastenImportRow_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "KastenImportRow" ADD CONSTRAINT "KastenImportRow_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;
