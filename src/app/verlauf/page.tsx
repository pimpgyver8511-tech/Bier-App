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
    orderBy: { match: { date: "desc" } },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Kasten-Verlauf</h1>
        <p className="text-muted text-sm mt-1">
          Wer hat wann und warum einen Kasten mitgebracht.
        </p>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted border-b border-border">
                <th className="px-5 sm:px-6 py-2.5 font-medium">Datum</th>
                <th className="px-3 py-2.5 font-medium">Spieler</th>
                <th className="px-3 py-2.5 font-medium">Begründung</th>
                <th className="px-3 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {assignments.map((a) => (
                <tr key={a.id} className="border-b border-border last:border-0 align-top">
                  <td className="px-5 sm:px-6 py-3 whitespace-nowrap">
                    {formatDate(a.match.date)}
                  </td>
                  <td className="px-3 py-3 font-medium whitespace-nowrap">{a.player.name}</td>
                  <td className="px-3 py-3 text-muted">{a.reason || "—"}</td>
                  <td className="px-3 py-3">
                    {a.fulfilled ? (
                      <span className="badge badge-green">✅ erledigt</span>
                    ) : (
                      <span className="badge badge-gold">🍺 ausstehend</span>
                    )}
                  </td>
                </tr>
              ))}
              {assignments.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-5 sm:px-6 py-6 text-center text-muted">
                    Noch keine Einträge vorhanden.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
