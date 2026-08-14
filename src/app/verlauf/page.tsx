import { prisma } from "@/lib/db";

function formatDate(d: Date) {
  return d.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default async function VerlaufPage() {
  const assignments = await prisma.kastenAssignment.findMany({
    include: { player: true, match: true },
  });

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
  const groups = Array.from(byPlayer.values()).sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Kasten-Verlauf</h1>
        <p className="text-muted text-sm mt-1">
          Wer hat wann und warum einen Kasten mitgebracht.
        </p>
      </div>

      <div className="space-y-4">
        {groups.map((g) => (
          <div key={g.name} className="card p-4">
            <h2 className="font-bold mb-2">
              {g.name} <span className="text-muted font-normal text-sm">({g.entries.length}×)</span>
            </h2>
            <div>
              {g.entries.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center gap-3 py-1.5 border-b border-border last:border-0"
                >
                  <span className="text-xs text-muted whitespace-nowrap w-24 shrink-0">
                    {a.match
                      ? formatDate(a.match.date)
                      : a.fulfilled
                        ? formatDate(a.fulfilledAt ?? a.createdAt)
                        : "kein Spieltag"}
                  </span>
                  <span className="text-sm flex-1">{a.reason || "—"}</span>
                  {a.fulfilled ? (
                    <span className="badge badge-green shrink-0">✅ erledigt</span>
                  ) : (
                    <span className="badge badge-gold shrink-0">🍺 ausstehend</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
        {groups.length === 0 && (
          <p className="text-muted text-center py-6">Noch keine Einträge vorhanden.</p>
        )}
      </div>
    </div>
  );
}
