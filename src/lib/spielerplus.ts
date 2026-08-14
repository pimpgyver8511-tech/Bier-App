import ical, { type CalendarResponse, type VEvent } from "node-ical";
import { prisma } from "@/lib/db";

export type IcsSyncResult = {
  ok: boolean;
  message: string;
  created: number;
  updated: number;
};

function textValue(v: string | { val: string } | undefined): string | null {
  if (v === undefined) return null;
  return typeof v === "string" ? v : v.val;
}

/**
 * Spielerplus bietet keine offizielle API und ein Login+Scraping-Sync
 * (Playwright/Chromium) laesst sich auf Vercel nicht betreiben (kein
 * Chromium zur Laufzeit, siehe README). Der ".ics-Kalender abonnieren"-Link
 * aus den Spielerplus-Einstellungen ist dagegen ein einfacher, oeffentlicher
 * HTTP-Abruf ohne Login/Browser und funktioniert deshalb problemlos in einer
 * Vercel-Funktion. Er liefert Datum/Ort/Gegner der Spiele, aber keine
 * Anwesenheits-/Zusagen-Daten der einzelnen Spieler (die sind personenbezogen
 * und stehen nicht im Kalender-Export) - Anwesenheit bleibt daher weiterhin
 * manuell zu pflegen.
 */
export async function syncMatchScheduleFromIcs(): Promise<IcsSyncResult> {
  const config = await prisma.spielerplusConfig.findUnique({ where: { id: 1 } });
  const icsUrl = config?.icsUrl;
  if (!icsUrl) {
    return { ok: false, message: "Keine Kalender-URL hinterlegt.", created: 0, updated: 0 };
  }

  const fail = async (message: string) => {
    await prisma.spielerplusConfig.upsert({
      where: { id: 1 },
      update: { lastSyncAt: new Date(), lastSyncOk: false, lastSyncMsg: message },
      create: { id: 1, icsUrl, lastSyncAt: new Date(), lastSyncOk: false, lastSyncMsg: message },
    });
    return { ok: false, message, created: 0, updated: 0 };
  };

  let rawText: string;
  try {
    const res = await fetch(icsUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    rawText = await res.text();
  } catch (err) {
    return fail(
      "Kalender konnte nicht geladen werden: " +
        (err instanceof Error ? err.message : String(err))
    );
  }

  const teamNameMatch = rawText.match(/X-WR-CALDESC:Spielplan für (.+)/);
  const ourTeamName = teamNameMatch?.[1]?.trim();
  if (!ourTeamName) {
    return fail(
      "Der eigene Teamname konnte nicht aus dem Kalender gelesen werden (Format unerwartet)."
    );
  }

  let events: CalendarResponse;
  try {
    events = ical.sync.parseICS(rawText);
  } catch (err) {
    return fail(
      "Kalender konnte nicht gelesen werden: " +
        (err instanceof Error ? err.message : String(err))
    );
  }

  const activePlayers = await prisma.player.findMany({ where: { active: true } });

  let created = 0;
  let updated = 0;

  for (const raw of Object.values(events)) {
    if (!raw || raw.type !== "VEVENT") continue;
    const event = raw as VEvent;
    const uid = event.uid ?? "";
    if (!uid.startsWith("game.")) continue;

    const summary = textValue(event.summary) ?? "";
    const summaryMatch = summary.match(/^Spiel:\s*(.+?)\s+-\s+(.+)$/);
    if (!summaryMatch) continue;
    const [, teamA, teamB] = summaryMatch;
    const isHome = teamA.trim() === ourTeamName;
    const isAway = teamB.trim() === ourTeamName;
    if (!isHome && !isAway) continue;

    const opponent = (isHome ? teamB : teamA).trim();
    const date = event.start as Date;
    const location = textValue(event.location);

    const existing = await prisma.match.findUnique({ where: { externalId: uid } });
    if (existing) {
      const changed =
        existing.date.getTime() !== date.getTime() ||
        existing.opponent !== opponent ||
        existing.isHome !== isHome ||
        existing.location !== location;
      if (changed) {
        await prisma.match.update({
          where: { id: existing.id },
          data: { date, opponent, isHome, location },
        });
        updated++;
      }
    } else {
      const match = await prisma.match.create({
        data: { externalId: uid, date, opponent, isHome, location },
      });
      await prisma.attendance.createMany({
        data: activePlayers.map((p) => ({ matchId: match.id, playerId: p.id })),
      });
      created++;
    }
  }

  const message = `${created} neue(s), ${updated} aktualisierte(s) Spiel(e) übernommen.`;
  await prisma.spielerplusConfig.update({
    where: { id: 1 },
    data: { lastSyncAt: new Date(), lastSyncOk: true, lastSyncMsg: message },
  });
  return { ok: true, message, created, updated };
}
