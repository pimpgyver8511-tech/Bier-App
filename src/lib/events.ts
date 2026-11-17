import { prisma } from "@/lib/db";
import { mapStatusValue, parseCsvLine, STATUS_COLUMNS } from "@/lib/spielerplus";

export function formatEventDate(d: Date): string {
  return d.toLocaleString("de-DE", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Berlin",
  });
}

export async function getEventWithParticipants(eventId: string) {
  return prisma.teamEvent.findUnique({
    where: { id: eventId },
    include: { participants: { orderBy: { name: "asc" } } },
  });
}

export type EventCsvImportResult = { ok: boolean; message: string };

/**
 * Teilnehmer-Import aus dem Spielerplus-Export ("Teilnehmer exportieren",
 * gleiches Format wie bei Spielen: Spalte "user_name", ggf. Status-Spalte).
 * Anders als bei Spielen werden auch Namen ohne passenden Spieler
 * uebernommen - zur Weihnachtsfeier kommen z.B. auch Trainer oder Ehemalige.
 * Ein erneuter Import ersetzt die Spielerplus-Teilnehmer; von Hand
 * hinzugefuegte bleiben. Wer nicht mehr in der Datei steht, fliegt raus -
 * die Meldung nennt dann auch eine schon eingetragene Essenswahl.
 */
export async function importEventParticipantsFromCsv(eventId: string, csvText: string): Promise<EventCsvImportResult> {
  const lines = csvText.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return { ok: false, message: "Keine Daten in der Datei gefunden." };
  const header = parseCsvLine(lines[0]);
  const nameIdx = header.indexOf("user_name");
  if (nameIdx === -1) return { ok: false, message: 'Spalte "user_name" nicht gefunden – unerwartetes Dateiformat.' };
  const statusIdx = header.findIndex((h) => STATUS_COLUMNS.includes(h.trim().toLowerCase()));

  const names = new Set<string>();
  for (const line of lines.slice(1)) {
    const fields = parseCsvLine(line);
    const name = fields[nameIdx]?.trim();
    if (!name) continue;
    if (statusIdx !== -1 && mapStatusValue(fields[statusIdx] ?? "") !== "ZUSAGE") continue;
    names.add(name);
  }
  if (names.size === 0) return { ok: false, message: "Keine Zusagen in der Datei gefunden." };

  const players = await prisma.player.findMany();
  const playerByName = new Map<string, { id: string; name: string }>();
  for (const p of players) {
    playerByName.set(p.name.trim().toLowerCase(), p);
    if (p.alias) playerByName.set(p.alias.trim().toLowerCase(), p);
  }

  const existing = await prisma.eventParticipant.findMany({ where: { eventId } });
  const keepIds = new Set<string>();
  let added = 0;
  let guests = 0;
  for (const rawName of names) {
    const player = playerByName.get(rawName.toLowerCase());
    const name = player?.name ?? rawName;
    if (!player) guests++;
    const match = existing.find((e) => (player && e.playerId === player.id) || e.name.toLowerCase() === name.toLowerCase());
    if (match) {
      keepIds.add(match.id);
      if (match.source !== "SPIELERPLUS" || (player && match.playerId !== player.id)) {
        await prisma.eventParticipant.update({
          where: { id: match.id },
          data: { source: "SPIELERPLUS", playerId: player?.id ?? match.playerId },
        });
      }
      continue;
    }
    const created = await prisma.eventParticipant.create({
      data: { eventId, name, playerId: player?.id ?? null, source: "SPIELERPLUS" },
    });
    keepIds.add(created.id);
    added++;
  }

  const removed = existing.filter((e) => e.source === "SPIELERPLUS" && !keepIds.has(e.id));
  if (removed.length) {
    await prisma.eventParticipant.deleteMany({ where: { id: { in: removed.map((r) => r.id) } } });
  }

  const message =
    `${names.size} Zusage(n) übernommen, davon ${added} neu.` +
    (guests ? ` ${guests} Name(n) ohne passenden Spieler als Gast eingetragen.` : "") +
    (removed.length
      ? ` Nicht mehr dabei und entfernt: ${removed
          .map((r) => (r.dish ? `${r.name} (hatte „${r.dish}“ gewählt)` : r.name))
          .join(", ")}.`
      : "");
  return { ok: true, message };
}

type OrderParticipant = { name: string; dish: string | null; note: string | null };

export function summarizeOrder(participants: OrderParticipant[]) {
  const counts = new Map<string, number>();
  for (const p of participants) {
    if (!p.dish) continue;
    for (const part of p.dish.split(" + ")) counts.set(part, (counts.get(part) ?? 0) + 1);
  }
  const totals = Array.from(counts, ([dish, count]) => ({ dish, count })).sort(
    (a, b) => b.count - a.count || a.dish.localeCompare(b.dish, "de")
  );
  const missing = participants.filter((p) => !p.dish).map((p) => p.name);
  return { totals, missing };
}

/** Bestellung als Text zum Kopieren in E-Mail/WhatsApp an das Restaurant. */
export function buildOrderText(
  event: { title: string; date: Date; restaurant?: string | null },
  participants: OrderParticipant[]
): string {
  const { totals, missing } = summarizeOrder(participants);
  const lines = [
    `Essensbestellung ${event.title} – ${formatEventDate(event.date)} Uhr`,
    ...(event.restaurant ? [`Restaurant: ${event.restaurant}`] : []),
    `${participants.length} Personen`,
    "",
    "Zusammenfassung:",
    ...totals.map((t) => `${t.count}× ${t.dish}`),
    ...(missing.length ? [`${missing.length}× noch offen`] : []),
    "",
    "Pro Person:",
    ...participants.map(
      (p, i) =>
        `${i + 1}. ${p.name}: ${p.dish ?? "– noch offen –"}` +
        (p.note ? ` – Sonderwunsch: ${p.note}` : "")
    ),
  ];
  return lines.join("\n");
}

function csvField(value: string): string {
  return /[";\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** CSV fuer Excel (Semikolon, UTF-8 mit BOM, damit Umlaute stimmen). */
export function buildOrderCsv(participants: OrderParticipant[]): string {
  const { totals } = summarizeOrder(participants);
  const rows = [
    ["Nr.", "Name", "Gericht", "Änderungen / Sonderwünsche"],
    ...participants.map((p, i) => [
      String(i + 1),
      p.name,
      p.dish ?? "noch offen",
      p.note ?? "",
    ]),
    [],
    ["", "Zusammenfassung", "Anzahl"],
    ...totals.map((t) => ["", t.dish, String(t.count)]),
  ];
  return "﻿" + rows.map((r) => r.map(csvField).join(";")).join("\r\n") + "\r\n";
}
