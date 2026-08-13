import { prisma } from "@/lib/db";

// Einmalige Einrichtung des Datenbankschemas zur Laufzeit (statt beim Build),
// weil "prisma migrate deploy" waehrend des Vercel-Builds die Datenbank nicht
// erreichen konnte, die App zur Laufzeit (Serverless Function) aber schon.
// Entspricht 1:1 prisma/migrations/20260813125047_init/migration.sql.
const STATEMENTS: string[] = [
  `CREATE TYPE "AttendanceStatus" AS ENUM ('ZUSAGE', 'ABSAGE', 'UNKNOWN')`,
  `CREATE TYPE "AttendanceSource" AS ENUM ('MANUAL', 'SPIELERPLUS')`,
  `CREATE TABLE "Player" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE TABLE "Match" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "opponent" TEXT,
    "location" TEXT,
    "isHome" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Match_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE TABLE "Attendance" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "status" "AttendanceStatus" NOT NULL DEFAULT 'UNKNOWN',
    "source" "AttendanceSource" NOT NULL DEFAULT 'MANUAL',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Attendance_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE TABLE "KastenAssignment" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "reason" TEXT,
    "fulfilled" BOOLEAN NOT NULL DEFAULT false,
    "fulfilledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "KastenAssignment_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE TABLE "Settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "cooldownWeeks" INTEGER NOT NULL DEFAULT 6,
    "kastenPerMatch" INTEGER NOT NULL DEFAULT 2,
    CONSTRAINT "Settings_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE TABLE "SpielerplusConfig" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "teamUrl" TEXT,
    "lastSyncAt" TIMESTAMP(3),
    "lastSyncOk" BOOLEAN NOT NULL DEFAULT false,
    "lastSyncMsg" TEXT,
    CONSTRAINT "SpielerplusConfig_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE UNIQUE INDEX "Player_name_key" ON "Player"("name")`,
  `CREATE UNIQUE INDEX "Attendance_matchId_playerId_key" ON "Attendance"("matchId", "playerId")`,
  `ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
  `ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
  `ALTER TABLE "KastenAssignment" ADD CONSTRAINT "KastenAssignment_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
  `ALTER TABLE "KastenAssignment" ADD CONSTRAINT "KastenAssignment_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
];

export type DbSetupResult = {
  ok: boolean;
  message: string;
};

export async function applyInitialSchema(): Promise<DbSetupResult> {
  try {
    const existing = await prisma.$queryRawUnsafe<{ exists: boolean }[]>(
      `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Player') as exists`
    );
    if (existing[0]?.exists) {
      return { ok: true, message: "Datenbank ist bereits eingerichtet (Tabelle 'Player' existiert schon)." };
    }

    for (const statement of STATEMENTS) {
      await prisma.$executeRawUnsafe(statement);
    }

    return { ok: true, message: "Datenbankschema erfolgreich angelegt." };
  } catch (err) {
    return {
      ok: false,
      message: "Fehler beim Einrichten: " + (err instanceof Error ? err.message : String(err)),
    };
  }
}
