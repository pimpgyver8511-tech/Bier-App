import { prisma } from "@/lib/db";

export type SpielerplusSyncResult = {
  ok: boolean;
  message: string;
  matchedPlayers?: string[];
  unmatchedNames?: string[];
};

/**
 * Der automatische Spielerplus-Sync (Login + Scraping via Playwright/
 * Chromium) ist auf Vercel deaktiviert: Next.js bindet "playwright-core"
 * schon beim Build in die serverseitige Funktion ein, sobald das Paket
 * irgendwo im Code referenziert wird (auch bei dynamischem Import) - das
 * liess auf Vercel jede Seite mit "Cannot find module" abstuerzen, nicht
 * nur den Sync selbst. Playwright-core wurde deshalb komplett aus dem
 * Deployment entfernt (siehe package.json).
 *
 * Die Anwesenheitspflege funktioniert unabhaengig davon jederzeit manuell
 * im Admin-Bereich (Zusage/Absage/Offen je Spieler).
 */
export async function runSpielerplusSync(
  matchId: string
): Promise<SpielerplusSyncResult> {
  const config = await prisma.spielerplusConfig.findUnique({ where: { id: 1 } });
  const teamUrl = config?.teamUrl || process.env.SPIELERPLUS_TEAM_URL;
  const email = process.env.SPIELERPLUS_EMAIL;
  const password = process.env.SPIELERPLUS_PASSWORD;

  const result: SpielerplusSyncResult = {
    ok: false,
    message:
      (!email || !password || !teamUrl
        ? "Spielerplus-Sync ist nicht konfiguriert. "
        : "") +
      "Der automatische Sync ist in diesem Hosting (Vercel) aktuell nicht " +
      "verfuegbar, da dort kein Chromium-Browser laeuft. Anwesenheit bitte " +
      "manuell pflegen (Zusage/Absage/Offen je Spieler oben in der Liste).",
  };

  await prisma.spielerplusConfig.upsert({
    where: { id: 1 },
    update: { lastSyncAt: new Date(), lastSyncOk: false, lastSyncMsg: result.message },
    create: { id: 1, lastSyncAt: new Date(), lastSyncOk: false, lastSyncMsg: result.message },
  });

  void matchId;
  return result;
}
