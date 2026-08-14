import { prisma } from "@/lib/db";

const MS_PER_DAY = 1000 * 60 * 60 * 24;

export type PlayerCandidate = {
  playerId: string;
  name: string;
  attending: boolean;
  lastAssignmentDate: Date | null;
  daysSinceLast: number | null;
  pendingCount: number;
  cooldownOk: boolean;
  eligible: boolean;
  reasonBlocked: string | null;
};

export type AssignmentSuggestion = {
  matchId: string;
  cooldownWeeks: number;
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
 * Ermittelt fuer ein Spiel, welche anwesenden Spieler aktuell "einen Kasten offen"
 * haben (Cooldown seit dem letzten erfuellten Kasten ist abgelaufen UND es steht
 * kein anderer Kasten mehr aus) und schlaegt die kastenPerMatch Spieler vor, die
 * am laengsten keinen Kasten mehr gebracht haben.
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

  // Alle frueheren Zuweisungen je Spieler (ausser einer evtl. schon am
  // aktuellen Spiel haengenden). Erfuellte zaehlen fuers Cooldown-Datum,
  // unerfuellte (egal ob mit oder ohne Spieltag) zaehlen als "hat noch
  // einen offen" und blockieren eine weitere Zuteilung, unabhaengig vom
  // Cooldown.
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
    } else {
      pendingCountByPlayer.set(a.playerId, (pendingCountByPlayer.get(a.playerId) ?? 0) + 1);
    }
  }

  const cooldownMs = settings.cooldownWeeks * 7 * MS_PER_DAY;

  const candidates: PlayerCandidate[] = players.map((p) => {
    const attendance = attendanceByPlayer.get(p.id);
    const attending = attendance?.status === "ZUSAGE";
    const lastDate = lastFulfilledByPlayer.get(p.id) ?? null;
    const pendingCount = pendingCountByPlayer.get(p.id) ?? 0;
    const daysSinceLast = lastDate
      ? Math.floor((match.date.getTime() - lastDate.getTime()) / MS_PER_DAY)
      : null;
    const cooldownOk = !lastDate || match.date.getTime() - lastDate.getTime() >= cooldownMs;

    let reasonBlocked: string | null = null;
    if (!attending) reasonBlocked = "Nicht anwesend";
    else if (pendingCount > 0)
      reasonBlocked = `Hat noch ${pendingCount} offene${pendingCount > 1 ? "" : "n"} Kasten`;
    else if (!cooldownOk)
      reasonBlocked = `Cooldown aktiv (noch ${Math.ceil(
        (cooldownMs - (match.date.getTime() - (lastDate as Date).getTime())) / MS_PER_DAY
      )} Tage)`;

    return {
      playerId: p.id,
      name: p.name,
      attending,
      lastAssignmentDate: lastDate,
      daysSinceLast,
      pendingCount,
      cooldownOk,
      eligible: attending && cooldownOk && pendingCount === 0,
      reasonBlocked,
    };
  });

  const eligible = candidates.filter((c) => c.eligible);
  // Fairness: wer am laengsten keinen Kasten hatte (nie = ganz vorne), ist zuerst dran
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
    cooldownWeeks: settings.cooldownWeeks,
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
  lastFulfilledDate: Date | null;
  daysSinceLast: number | null;
  open: boolean; // hat ausstehende Kaesten ODER Cooldown seit letztem erfuellten ist abgelaufen
  cooldownRemainingDays: number | null;
};

/**
 * Uebersicht je Spieler unabhaengig von einem konkreten Spiel: wie oft schon
 * (tatsaechlich erfuellt) mitgebracht, wie viele Kaesten aktuell noch
 * ausstehen, und ob der Cooldown seit dem letzten erfuellten Kasten
 * abgelaufen ist. "insgesamt" zaehlt alle Zuweisungen (erfuellt + ausstehend),
 * damit die Uebersicht 1:1 dem entspricht, was im Admin-Bereich gepflegt ist.
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
    { total: number; pending: number; lastFulfilled: Date | null }
  >();
  for (const p of players) byPlayer.set(p.id, { total: 0, pending: 0, lastFulfilled: null });

  for (const a of assignments) {
    const entry = byPlayer.get(a.playerId);
    if (!entry) continue;
    entry.total += 1;
    if (a.fulfilled) {
      const effectiveDate = a.match?.date ?? a.fulfilledAt ?? a.createdAt;
      if (!entry.lastFulfilled || effectiveDate.getTime() > entry.lastFulfilled.getTime()) {
        entry.lastFulfilled = effectiveDate;
      }
    } else {
      entry.pending += 1;
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

      return {
        playerId: p.id,
        name: p.name,
        totalKasten: info.total,
        pendingCount: info.pending,
        lastFulfilledDate: info.lastFulfilled,
        daysSinceLast,
        open: info.pending > 0 || cooldownOk,
        cooldownRemainingDays: cooldownOk ? null : Math.ceil(cooldownRemainingMs / MS_PER_DAY),
      };
    })
    .sort((a, b) => {
      if ((a.pendingCount > 0) !== (b.pendingCount > 0)) return a.pendingCount > 0 ? -1 : 1;
      if (a.lastFulfilledDate === null && b.lastFulfilledDate === null)
        return a.name.localeCompare(b.name);
      if (a.lastFulfilledDate === null) return -1;
      if (b.lastFulfilledDate === null) return 1;
      return a.lastFulfilledDate.getTime() - b.lastFulfilledDate.getTime();
    });
}
