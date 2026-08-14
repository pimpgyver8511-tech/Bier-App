import { isAdmin } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { KastenLine } from "./KastenLine";
import { AddKastenForm } from "./AddKastenForm";
import { AddKastenForNewPlayer } from "./AddKastenForNewPlayer";

function toIsoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

async function loadHistoryData() {
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
    .map(([playerId, g]) => ({ playerId, ...g }))
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

      <div className="space-y-4">
        {groups.map((g) => (
          <div key={g.playerId} className="card p-4">
            <div className="flex items-center justify-between gap-2 mb-2">
              <h2 className="font-bold">
                {g.name} <span className="text-muted font-normal text-sm">({g.entries.length}×)</span>
              </h2>
              <AddKastenForm playerId={g.playerId} />
            </div>
            <div>
              {g.entries.map((a) => (
                <KastenLine
                  key={a.id}
                  id={a.id}
                  matchDateIso={a.match ? toIsoDate(a.match.date) : null}
                  reason={a.reason ?? ""}
                  fulfilled={a.fulfilled}
                />
              ))}
            </div>
          </div>
        ))}
        {groups.length === 0 && (
          <p className="text-muted text-center py-6">Noch keine Einträge.</p>
        )}
      </div>
    </div>
  );
}
