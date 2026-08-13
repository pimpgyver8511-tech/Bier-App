import { prisma } from "@/lib/db";

const MS_PER_DAY = 1000 * 60 * 60 * 24;

export type PlayerCandidate = {
  playerId: string;
  name: string;
  attending: boolean;
  lastAssignmentDate: Date | null;
  daysSinceLast: number | null;
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
 * haben (Cooldown seit dem letzten Kasten ist abgelaufen) und schlaegt die
 * kastenPerMatch Spieler vor, die am laengsten keinen Kasten mehr mitgebracht haben.
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

  // letzte (fruehere) Kasten-Zuweisung je Spieler, unabhaengig vom aktuellen Spiel
  const lastAssignments = await prisma.kastenAssignment.findMany({
    where: { playerId: { in: players.map((p) => p.id) }, matchId: { not: matchId } },
    include: { match: true },
    orderBy: { match: { date: "desc" } },
  });
  const lastAssignmentByPlayer = new Map<string, Date>();
  for (const a of lastAssignments) {
    if (!lastAssignmentByPlayer.has(a.playerId)) {
      lastAssignmentByPlayer.set(a.playerId, a.match.date);
    }
  }

  const cooldownMs = settings.cooldownWeeks * 7 * MS_PER_DAY;

  const candidates: PlayerCandidate[] = players.map((p) => {
    const attendance = attendanceByPlayer.get(p.id);
    const attending = attendance?.status === "ZUSAGE";
    const lastDate = lastAssignmentByPlayer.get(p.id) ?? null;
    const daysSinceLast = lastDate
      ? Math.floor((match.date.getTime() - lastDate.getTime()) / MS_PER_DAY)
      : null;
    const cooldownOk = !lastDate || match.date.getTime() - lastDate.getTime() >= cooldownMs;

    let reasonBlocked: string | null = null;
    if (!attending) reasonBlocked = "Nicht anwesend";
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
      cooldownOk,
      eligible: attending && cooldownOk,
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
  lastAssignmentDate: Date | null;
  daysSinceLast: number | null;
  open: boolean; // Cooldown abgelaufen -> "hat einen Kasten offen" / ist an der Reihe
  cooldownRemainingDays: number | null;
};

/**
 * Uebersicht je Spieler unabhaengig von einem konkreten Spiel: wie oft schon
 * mitgebracht, wann zuletzt, und ob der Cooldown-Zeitraum aktuell abgelaufen
 * ist (= Spieler ist grundsaetzlich wieder "dran", sofern er beim naechsten
 * Spiel anwesend ist).
 */
export async function buildPlayerOverview(): Promise<PlayerOverviewEntry[]> {
  const [settings, players, assignments] = await Promise.all([
    getSettings(),
    prisma.player.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.kastenAssignment.findMany({ include: { match: true } }),
  ]);

  const now = new Date();
  const cooldownMs = settings.cooldownWeeks * 7 * MS_PER_DAY;

  const byPlayer = new Map<string, { count: number; last: Date | null }>();
  for (const p of players) byPlayer.set(p.id, { count: 0, last: null });

  for (const a of assignments) {
    const entry = byPlayer.get(a.playerId);
    if (!entry) continue;
    entry.count += 1;
    if (!entry.last || a.match.date.getTime() > entry.last.getTime()) {
      entry.last = a.match.date;
    }
  }

  return players
    .map((p) => {
      const info = byPlayer.get(p.id)!;
      const daysSinceLast = info.last
        ? Math.floor((now.getTime() - info.last.getTime()) / MS_PER_DAY)
        : null;
      const cooldownRemainingMs = info.last
        ? cooldownMs - (now.getTime() - info.last.getTime())
        : 0;
      const open = !info.last || cooldownRemainingMs <= 0;

      return {
        playerId: p.id,
        name: p.name,
        totalKasten: info.count,
        lastAssignmentDate: info.last,
        daysSinceLast,
        open,
        cooldownRemainingDays: open ? null : Math.ceil(cooldownRemainingMs / MS_PER_DAY),
      };
    })
    .sort((a, b) => {
      if (a.lastAssignmentDate === null && b.lastAssignmentDate === null)
        return a.name.localeCompare(b.name);
      if (a.lastAssignmentDate === null) return -1;
      if (b.lastAssignmentDate === null) return 1;
      return a.lastAssignmentDate.getTime() - b.lastAssignmentDate.getTime();
    });
}
