import { prisma } from "@/lib/db";
import { buildPlayerOverview } from "@/lib/kasten";
import Link from "next/link";

function formatDate(d: Date) {
  return d.toLocaleDateString("de-DE", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatTime(d: Date) {
  return d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
}

export default async function HomePage() {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [nextMatch, overview] = await Promise.all([
    prisma.match.findFirst({
      where: { date: { gte: startOfToday } },
      orderBy: { date: "asc" },
      include: {
        attendances: { include: { player: true } },
        assignments: { include: { player: true } },
      },
    }),
    buildPlayerOverview(),
  ]);

  const zusagen = nextMatch?.attendances.filter((a) => a.status === "ZUSAGE") ?? [];

  return (
    <div className="space-y-8">
      <section className="card overflow-hidden">
        <div className="bg-brand-dark text-white px-5 sm:px-6 py-4">
          <h1 className="text-lg sm:text-xl font-bold flex items-center gap-2">
            🍺 Nächstes Spiel
          </h1>
        </div>
        <div className="p-5 sm:p-6">
          {nextMatch ? (
            <div className="space-y-4">
              <div>
                <p className="text-xl font-semibold">
                  {formatDate(nextMatch.date)}, {formatTime(nextMatch.date)} Uhr
                </p>
                <p className="text-muted text-sm mt-1">
                  {nextMatch.opponent ? `gegen ${nextMatch.opponent}` : "Gegner noch offen"}
                  {nextMatch.location ? ` · ${nextMatch.location}` : ""}
                  {" · "}
                  {nextMatch.isHome ? "Heimspiel" : "Auswärtsspiel"}
                </p>
              </div>

              <div className="flex flex-wrap gap-2 items-center text-sm text-muted">
                <span className="badge badge-green">{zusagen.length} Zusagen</span>
              </div>

              <div>
                <p className="text-sm font-semibold text-muted mb-2">Bringt den Kasten mit</p>
                {nextMatch.assignments.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {nextMatch.assignments.map((a) => (
                      <span key={a.id} className="badge badge-gold text-sm px-3 py-1">
                        🍻 {a.player.name}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted italic">
                    Noch nicht festgelegt.
                  </p>
                )}
              </div>
            </div>
          ) : (
            <p className="text-muted">
              Aktuell ist kein anstehendes Spiel eingetragen.
            </p>
          )}
        </div>
      </section>

      <section className="card">
        <div className="px-5 sm:px-6 py-4 border-b border-border flex items-center justify-between">
          <h2 className="text-lg font-bold">Kasten-Warteschlange</h2>
          <Link href="/verlauf" className="text-sm text-brand font-semibold hover:underline">
            Verlauf ansehen →
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted border-b border-border">
                <th className="px-5 sm:px-6 py-2.5 font-medium">Spieler</th>
                <th className="px-3 py-2.5 font-medium">Letzter/nächster Kasten</th>
                <th className="px-3 py-2.5 font-medium">Insgesamt</th>
                <th className="px-3 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {overview.map((p) => (
                <tr key={p.playerId} className="border-b border-border last:border-0">
                  <td className="px-5 sm:px-6 py-3 font-medium">{p.name}</td>
                  <td className="px-3 py-3 text-muted">
                    {p.lastAssignmentDate
                      ? p.daysSinceLast !== null && p.daysSinceLast >= 0
                        ? `${formatDate(p.lastAssignmentDate)} (vor ${p.daysSinceLast} Tagen)`
                        : `${formatDate(p.lastAssignmentDate)} (anstehend)`
                      : "noch nie"}
                  </td>
                  <td className="px-3 py-3 text-muted">{p.totalKasten}×</td>
                  <td className="px-3 py-3">
                    {p.open ? (
                      <span className="badge badge-green">🍺 hat einen offen</span>
                    ) : (
                      <span className="badge badge-gray">
                        ⏳ noch {p.cooldownRemainingDays} Tage Pause
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {overview.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-5 sm:px-6 py-6 text-center text-muted">
                    Noch keine Spieler angelegt.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
