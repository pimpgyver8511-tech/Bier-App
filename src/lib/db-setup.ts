import { prisma } from "@/lib/db";

// Einrichtung/Aktualisierung des Datenbankschemas zur Laufzeit (statt beim
// Vercel-Build), weil "prisma migrate deploy" waehrend des Builds die
// Datenbank nicht erreichen konnte, die App zur Laufzeit (Serverless
// Function) aber schon. Jede echte Prisma-Migration bekommt hier einen
// gleichnamigen Eintrag mit denselben SQL-Statements; bereits angewendete
// werden in der Tabelle "_manual_migrations" vermerkt und uebersprungen.
const MIGRATIONS: { name: string; statements: string[] }[] = [
  {
    name: "20260813125047_init",
    statements: [
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
    ],
  },
  {
    name: "20260814060637_kasten_import_and_nullable_match",
    statements: [
      `CREATE TYPE "ImportSource" AS ENUM ('SEITE3', 'OFFEN', 'GUTHABEN')`,
      `ALTER TABLE "KastenAssignment" ALTER COLUMN "matchId" DROP NOT NULL`,
      `CREATE TABLE "KastenImportRow" (
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
      )`,
      `ALTER TABLE "KastenImportRow" ADD CONSTRAINT "KastenImportRow_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE`,
    ],
  },
  {
    name: "20260814080200_match_external_id_and_ics_url",
    statements: [
      `ALTER TABLE "Match" ADD COLUMN "externalId" TEXT`,
      `ALTER TABLE "SpielerplusConfig" RENAME COLUMN "teamUrl" TO "icsUrl"`,
      `CREATE UNIQUE INDEX "Match_externalId_key" ON "Match"("externalId")`,
    ],
  },
];

export type DbSetupResult = {
  ok: boolean;
  message: string;
};

async function ensureMigrationsTable() {
  await prisma.$executeRawUnsafe(
    `CREATE TABLE IF NOT EXISTS "_manual_migrations" (
      "name" TEXT PRIMARY KEY,
      "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`
  );

  // Bestandsschutz: Wurde die App schon vor Einfuehrung dieser Tabelle
  // eingerichtet (Tabelle "Player" existiert bereits), die allererste
  // Migration nachtraeglich als angewendet vermerken, statt sie erneut
  // (und damit fehlschlagend) auszufuehren.
  const initName = MIGRATIONS[0].name;
  const alreadyTracked = await prisma.$queryRawUnsafe<{ exists: boolean }[]>(
    `SELECT EXISTS (SELECT 1 FROM "_manual_migrations" WHERE name = $1) as exists`,
    initName
  );
  if (!alreadyTracked[0]?.exists) {
    const playerTableExists = await prisma.$queryRawUnsafe<{ exists: boolean }[]>(
      `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Player') as exists`
    );
    if (playerTableExists[0]?.exists) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO "_manual_migrations" (name) VALUES ($1) ON CONFLICT DO NOTHING`,
        initName
      );
    }
  }
}

export async function applyPendingMigrations(): Promise<DbSetupResult> {
  try {
    await ensureMigrationsTable();

    const appliedRows = await prisma.$queryRawUnsafe<{ name: string }[]>(
      `SELECT name FROM "_manual_migrations"`
    );
    const applied = new Set(appliedRows.map((r) => r.name));

    let appliedCount = 0;
    for (const migration of MIGRATIONS) {
      if (applied.has(migration.name)) continue;
      for (const statement of migration.statements) {
        await prisma.$executeRawUnsafe(statement);
      }
      await prisma.$executeRawUnsafe(
        `INSERT INTO "_manual_migrations" (name) VALUES ($1) ON CONFLICT DO NOTHING`,
        migration.name
      );
      appliedCount++;
    }

    if (appliedCount === 0) {
      return { ok: true, message: "Datenbank ist bereits auf dem aktuellen Stand." };
    }
    return { ok: true, message: `${appliedCount} Migration(en) erfolgreich angewendet.` };
  } catch (err) {
    return {
      ok: false,
      message: "Fehler beim Einrichten: " + (err instanceof Error ? err.message : String(err)),
    };
  }
}
