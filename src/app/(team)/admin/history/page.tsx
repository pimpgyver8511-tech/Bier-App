import { isAdmin } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { fulfillPastMatchAssignments } from "@/lib/kasten";
import { HistoryFilter } from "./HistoryFilter";
import { AddKastenForNewPlayer } from "./AddKastenForNewPlayer";

function toIsoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

async function loadHistoryData() {
  await fulfillPastMatchAssignments();
  return Promise.all([
    prisma.player.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.kastenAssignment.findMany({ include: { player: true, match: true } }),
  ]);
}

export default async function AdminHistoryPage() {
  if (!(await isAdmin())) redirect("/admin");

  let data: Awaited<ReturnType<typeof loadHistoryData>> | null = null;
  try {
    data = await loadHistoryData();
  } catch {
    data = null;
  }

  if (!data) {
    return (
      <div className="card p-5 sm:p-6 space-y-2">
        <h1 className="font-bold text-lg">⚠️ Datenbank noch nicht eingerichtet</h1>
        <p className="text-sm text-muted">Bitte zuerst unter Einstellungen einrichten.</p>
      </div>
    );
  }
  const [players, assignments] = data;

  const byPlayer = new Map<string, { name: string; entries: typeof assignments }>();
  for (const a of assignments) {
    const entry = byPlayer.get(a.playerId) ?? { name: a.player.name, entries: [] };
    entry.entries.push(a);
    byPlayer.set(a.playerId, entry);
  }
  for (const group of byPlayer.values()) {
    group.entries.sort((a, b) => {
      const dateA = a.match?.date ?? a.fulfilledAt ?? a.createdAt;
      const dateB = b.match?.date ?? b.fulfilledAt ?? b.createdAt;
      return dateB.getTime() - dateA.getTime();
    });
  }
  const groups = Array.from(byPlayer.entries())
    .map(([playerId, g]) => ({
      playerId,
      name: g.name,
      totalCount: g.entries.length,
      entries: g.entries.map((a) => ({
        id: a.id,
        matchDateIso: a.match ? toIsoDate(a.match.date) : null,
        reason: a.reason ?? "",
        fulfilled: a.fulfilled,
      })),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Kasten-Historie</h1>
        <p className="text-muted text-sm mt-1">
          Begründungen pflegen und markieren, wenn ein Kasten tatsächlich mitgebracht wurde.
        </p>
      </div>

      <AddKastenForNewPlayer players={players} />

      {groups.length === 0 ? (
        <p className="text-muted text-center py-6">Noch keine Einträge.</p>
      ) : (
        <HistoryFilter groups={groups} />
      )}
    </div>
  );
}
