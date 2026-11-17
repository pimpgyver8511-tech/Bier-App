import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { attachDatabasePool } from "@vercel/functions";
import { Pool } from "pg";

declare global {
  var __prisma: PrismaClient | undefined;
}

/**
 * Bewusst kleiner Verbindungs-Pool: Auf Vercel laufen mehrere Funktions-
 * Instanzen parallel, und jede haelt ihren eigenen Pool. Mit dem pg-Standard
 * (bis zu 10 Verbindungen, 10 s Leerlauf) war das Verbindungslimit der
 * Datenbank-Rolle schnell erreicht ("too many connections", Code 53300).
 * attachDatabasePool sorgt dafuer, dass Vercel eine Instanz erst pausiert,
 * nachdem ungenutzte Verbindungen geschlossen sind. Ausserhalb von Vercel
 * (lokal) ist der Aufruf wirkungslos.
 */
function createPrismaClient() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 3,
    idleTimeoutMillis: 5_000,
    connectionTimeoutMillis: 15_000,
  });
  attachDatabasePool(pool);
  return new PrismaClient({ adapter: new PrismaPg(pool) });
}

// In jeder Umgebung wiederverwenden (auch Production), damit pro Instanz
// garantiert nur ein Pool existiert.
export const prisma = global.__prisma ?? createPrismaClient();
global.__prisma = prisma;

/** true, wenn ein DB-Fehler nur "zu viele Verbindungen" bedeutet (kein Schema-Problem). */
export function isConnectionLimitError(err: unknown): boolean {
  const text = err instanceof Error ? err.message : String(err);
  return /53300|too many connections|remaining connection slots/i.test(text);
}
