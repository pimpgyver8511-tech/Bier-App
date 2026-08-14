import { prisma } from "@/lib/db";
import { buildPlayerOverview } from "@/lib/kasten";
import { isAdmin } from "@/lib/auth";
import Link from "next/link";
import { PlayerQueueTable, type QueueRow } from "@/components/PlayerQueueTable";

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

  const [nextMatch, overview, admin] = await Promise.all([
    prisma.match.findFirst({
      where: { date: { gte: startOfToday } },
      orderBy: { date: "asc" },
      include: {
        attendances: { include: { player: true } },
        assignments: { include: { player: true } },
      },
    }),
    buildPlayerOverview(),
    isAdmin(),
  ]);

  const zusagen = nextMatch?.attendances.filter((a) => a.status === "ZUSAGE") ?? [];

  const queueRows: QueueRow[] = overview.map((p) => ({
    playerId: p.playerId,
    name: p.name,
    lastLabel: p.lastFulfilledDate
      ? p.daysSinceLast !== null && p.daysSinceLast >= 0
        ? `${formatDate(p.lastFulfilledDate)} (vor ${p.daysSinceLast} Tagen)`
        : `${formatDate(p.lastFulfilledDate)} (anstehend)`
      : "noch nie",
    totalKasten: p.totalKasten,
    pendingCount: p.pendingCount,
    pendingReasons: p.pendingReasons,
    open: p.open,
    cooldownRemainingDays: p.cooldownRemainingDays,
  }));

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
            <div className="space-y-3">
              <p className="text-muted">
                Aktuell ist kein anstehendes Spiel eingetragen.
              </p>
              {admin && (
                <Link href="/admin/matches" className="btn btn-gold text-sm">
                  🍺 Spiel anlegen & Kasten-Verantwortliche festlegen →
                </Link>
              )}
            </div>
          )}
        </div>
      </section>

      <section className="card">
        <div className="px-5 sm:px-6 py-4 border-b border-border flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-lg font-bold">Kasten-Warteschlange</h2>
            <p className="text-xs text-muted mt-0.5">
              Aktueller Stand: wer hat gerade einen Kasten offen.
            </p>
          </div>
          <Link href="/verlauf" className="text-sm text-brand font-semibold hover:underline whitespace-nowrap">
            Volle Historie ansehen →
          </Link>
        </div>
        <PlayerQueueTable rows={queueRows} />
      </section>
    </div>
  );
}
