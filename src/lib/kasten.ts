import { prisma } from "@/lib/db";

const MS_PER_DAY = 1000 * 60 * 60 * 24;

export type PlayerCandidate = {
  playerId: string;
  name: string;
  attending: boolean;
  lastAssignmentDate: Date | null;
  daysSinceLast: number | null;
  pendingCount: number;
  eligible: boolean;
  reasonBlocked: string | null;
};

export type AssignmentSuggestion = {
  matchId: string;
  kastenPerMatch: number;
  candidates: PlayerCandidate[];
  suggested: PlayerCandidate[];
};

async function getSettings() {
  const settings = await prisma.settings.findUnique({ where: { id: 1 } });
  return (
    settings ??
    (await prisma.settings.create({
      data: { id: 1, cooldownWeeks: 6, kastenPerMatch: 2 },
    }))
  );
}

/**
 * Ermittelt fuer ein Spiel, welche anwesenden Spieler aktuell noch mindestens
 * einen wirklich offenen (unerfuellten und keinem kuenftigen Spiel
 * zugeordneten) Kasten haben - also eine Strafe abzubauen haben - und
 * schlaegt die kastenPerMatch Spieler vor, die am laengsten keinen Kasten
 * mehr gebracht haben. Kaesten werden bei diesem Verein ausschliesslich als
 * Strafe vergeben (z.B. etwas vergessen), nicht turnusmaessig - wer nichts
 * offen hat, kommt daher grundsaetzlich nicht als Vorschlag infrage.
 */
export async function buildAssignmentSuggestion(
  matchId: string
): Promise<AssignmentSuggestion> {
  const [settings, match, players] = await Promise.all([
    getSettings(),
    prisma.match.findUniqueOrThrow({ where: { id: matchId } }),
    prisma.player.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);

  const attendances = await prisma.attendance.findMany({
    where: { matchId },
  });
  const attendanceByPlayer = new Map(attendances.map((a) => [a.playerId, a]));

  const now = new Date();

  // Alle frueheren Zuweisungen je Spieler (ausser einer evtl. schon am
  // aktuellen Spiel haengenden). Erfuellte zaehlen fuers "zuletzt gebracht"-
  // Datum. Unerfuellte zaehlen nur dann als wirklich offene Schuld, wenn sie
  // noch keinem kuenftigen Spiel zugeordnet sind (sonst sind sie schon fuer
  // ein anderes Spiel eingeplant, siehe buildPlayerOverview).
  const allAssignments = await prisma.kastenAssignment.findMany({
    where: { playerId: { in: players.map((p) => p.id) } },
    include: { match: true },
  });
  const relevant = allAssignments.filter((a) => a.matchId !== matchId);

  const lastFulfilledByPlayer = new Map<string, Date>();
  const pendingCountByPlayer = new Map<string, number>();
  for (const a of relevant) {
    if (a.fulfilled) {
      const effectiveDate = a.match?.date ?? a.fulfilledAt ?? a.createdAt;
      const current = lastFulfilledByPlayer.get(a.playerId);
      if (!current || effectiveDate.getTime() > current.getTime()) {
        lastFulfilledByPlayer.set(a.playerId, effectiveDate);
      }
    } else if (!a.match || a.match.date.getTime() <= now.getTime()) {
      pendingCountByPlayer.set(a.playerId, (pendingCountByPlayer.get(a.playerId) ?? 0) + 1);
    }
  }

  const candidates: PlayerCandidate[] = players.map((p) => {
    const attendance = attendanceByPlayer.get(p.id);
    const attending = attendance?.status === "ZUSAGE";
    const lastDate = lastFulfilledByPlayer.get(p.id) ?? null;
    const pendingCount = pendingCountByPlayer.get(p.id) ?? 0;
    const daysSinceLast = lastDate
      ? Math.floor((match.date.getTime() - lastDate.getTime()) / MS_PER_DAY)
      : null;

    let reasonBlocked: string | null = null;
    if (!attending) reasonBlocked = "Nicht anwesend";
    else if (pendingCount === 0) reasonBlocked = "Kein Kasten offen";

    return {
      playerId: p.id,
      name: p.name,
      attending,
      lastAssignmentDate: lastDate,
      daysSinceLast,
      pendingCount,
      eligible: attending && pendingCount > 0,
      reasonBlocked,
    };
  });

  const eligible = candidates.filter((c) => c.eligible);
  // Wer am laengsten keinen Kasten mehr gebracht hat (nie = ganz vorne), soll
  // seinen offenen Kasten als erstes abbauen.
  eligible.sort((a, b) => {
    if (a.lastAssignmentDate === null && b.lastAssignmentDate === null) {
      return a.name.localeCompare(b.name);
    }
    if (a.lastAssignmentDate === null) return -1;
    if (b.lastAssignmentDate === null) return 1;
    return a.lastAssignmentDate.getTime() - b.lastAssignmentDate.getTime();
  });

  const suggested = eligible.slice(0, settings.kastenPerMatch);

  return {
    matchId,
    kastenPerMatch: settings.kastenPerMatch,
    candidates,
    suggested,
  };
}

export type PlayerOverviewEntry = {
  playerId: string;
  name: string;
  totalKasten: number;
  pendingCount: number;
  pendingReasons: string[];
  scheduledCount: number;
  nextScheduledLabel: string | null; // z.B. "bringt am 17.08."
  lastFulfilledDate: Date | null;
  daysSinceLast: number | null;
  open: boolean; // hat ausstehende Kaesten ODER Cooldown seit letztem erfuellten ist abgelaufen
  cooldownRemainingDays: number | null;
};

function formatShortDate(d: Date): string {
  return d.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Europe/Berlin",
  });
}

/**
 * Uebersicht je Spieler unabhaengig von einem konkreten Spiel: wie oft schon
 * (tatsaechlich erfuellt) mitgebracht, wie viele Kaesten aktuell noch wirklich
 * offen sind (kein Spieltag oder Spieltag liegt in der Vergangenheit - also
 * ein ungeklaerter Alt-Fall), wie viele bereits fuer ein kommendes Spiel
 * eingeplant sind (schon jemandem zugeteilt, aber noch nicht geliefert -
 * zaehlt bewusst NICHT als "ausstehend", weil schon geklaert ist, wer ihn
 * mitbringt und wann), und ob der Cooldown seit dem letzten erfuellten
 * Kasten abgelaufen ist. "insgesamt" zaehlt alle Zuweisungen (erfuellt +
 * ausstehend + eingeplant), damit die Uebersicht 1:1 dem entspricht, was im
 * Admin-Bereich gepflegt ist.
 */
export async function buildPlayerOverview(): Promise<PlayerOverviewEntry[]> {
  const [settings, players, assignments] = await Promise.all([
    getSettings(),
    prisma.player.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.kastenAssignment.findMany({ include: { match: true } }),
  ]);

  const now = new Date();
  const cooldownMs = settings.cooldownWeeks * 7 * MS_PER_DAY;

  const byPlayer = new Map<
    string,
    {
      total: number;
      pending: number;
      pendingReasons: string[];
      scheduled: Date[];
      lastFulfilled: Date | null;
    }
  >();
  for (const p of players)
    byPlayer.set(p.id, { total: 0, pending: 0, pendingReasons: [], scheduled: [], lastFulfilled: null });

  for (const a of assignments) {
    const entry = byPlayer.get(a.playerId);
    if (!entry) continue;
    entry.total += 1;
    if (a.fulfilled) {
      const effectiveDate = a.match?.date ?? a.fulfilledAt ?? a.createdAt;
      if (!entry.lastFulfilled || effectiveDate.getTime() > entry.lastFulfilled.getTime()) {
        entry.lastFulfilled = effectiveDate;
      }
    } else if (a.match && a.match.date.getTime() > now.getTime()) {
      entry.scheduled.push(a.match.date);
    } else {
      entry.pending += 1;
      entry.pendingReasons.push(a.reason || "Kein Grund angegeben");
    }
  }

  return players
    .map((p) => {
      const info = byPlayer.get(p.id)!;
      const daysSinceLast = info.lastFulfilled
        ? Math.floor((now.getTime() - info.lastFulfilled.getTime()) / MS_PER_DAY)
        : null;
      const cooldownRemainingMs = info.lastFulfilled
        ? cooldownMs - (now.getTime() - info.lastFulfilled.getTime())
        : 0;
      const cooldownOk = !info.lastFulfilled || cooldownRemainingMs <= 0;
      info.scheduled.sort((a, b) => a.getTime() - b.getTime());

      return {
        playerId: p.id,
        name: p.name,
        totalKasten: info.total,
        pendingCount: info.pending,
        pendingReasons: info.pendingReasons,
        scheduledCount: info.scheduled.length,
        nextScheduledLabel:
          info.scheduled.length > 0 ? `bringt am ${formatShortDate(info.scheduled[0])}` : null,
        lastFulfilledDate: info.lastFulfilled,
        daysSinceLast,
        open: info.pending > 0 || cooldownOk,
        cooldownRemainingDays: cooldownOk ? null : Math.ceil(cooldownRemainingMs / MS_PER_DAY),
      };
    })
    .sort((a, b) => {
      const firstNameA = a.name.split(" ")[0];
      const firstNameB = b.name.split(" ")[0];
      return firstNameA.localeCompare(firstNameB, "de");
    });
}
