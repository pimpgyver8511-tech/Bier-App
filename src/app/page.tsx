import { Big_Shoulders } from "next/font/google";
import { prisma } from "@/lib/db";
import { buildPlayerOverview } from "@/lib/kasten";
import { isAdmin, isDesignPreviewEnabled } from "@/lib/auth";
import { startOfBerlinDay } from "@/lib/timezone";
import Link from "next/link";
import Image from "next/image";
import { PlayerQueueTable, type QueueRow } from "@/components/PlayerQueueTable";
import { AssignmentPicker } from "@/components/AssignmentPicker";
import { DesignPreviewToggle } from "@/components/DesignPreviewToggle";
import { deleteAssignmentAction } from "@/lib/actions";

// Nur fuer die "Kabine"-Optik-Vorschau (siehe DesignPreviewToggle) - wird
// nur dann tatsaechlich geladen/verwendet, wenn die Variable-Klasse unten
// angewendet wird (admin + Vorschau aktiv), fuer alle anderen Nutzer ohne
// jede Auswirkung.
const bigShoulders = Big_Shoulders({
  subsets: ["latin"],
  weight: ["700", "800"],
  variable: "--font-big-shoulders",
});

function formatDate(d: Date) {
  return d.toLocaleDateString("de-DE", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Europe/Berlin",
  });
}

function formatTime(d: Date) {
  return d.toLocaleTimeString("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Berlin",
  });
}

export default async function HomePage() {
  const startOfToday = startOfBerlinDay();

  const [nextMatch, overview, admin, designPreview] = await Promise.all([
    prisma.match.findFirst({
      where: { date: { gte: startOfToday } },
      orderBy: { date: "asc" },
      include: {
        attendances: { include: { player: true } },
        // "Bringt den Kasten mit" zeigt nur wer noch offen ist - bereits
        // erledigte Zuweisungen (z.B. per erledigt-Schalter in der Kasten-
        // Historie vorab bestaetigt) sollen hier nicht mehr auftauchen.
        assignments: { where: { fulfilled: false }, include: { player: true } },
      },
    }),
    buildPlayerOverview(),
    isAdmin(),
    isDesignPreviewEnabled(),
  ]);
  // Zusaetzlich an isAdmin() geknuepft (nicht nur ans Cookie), damit die
  // neue Optik unter keinen Umstaenden fuer normale Nutzer greift - siehe
  // setDesignPreview() in lib/auth.ts.
  const kabinePreview = admin && designPreview;

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
    pendingEntries: p.pendingEntries,
    scheduledCount: p.scheduledCount,
    nextScheduledLabel: p.nextScheduledLabel,
    open: p.open,
    cooldownRemainingDays: p.cooldownRemainingDays,
  }));

  return (
    <div
      data-theme={kabinePreview ? "kabine" : undefined}
      className={`space-y-8 ${kabinePreview ? bigShoulders.variable : ""}`}
    >
      {admin && (
        <div className="flex justify-end">
          <DesignPreviewToggle enabled={kabinePreview} />
        </div>
      )}

      <section className="card overflow-hidden relative">
        <div className="relative aspect-[2.1/1]">
          <Image
            src="/bierbeauftragter-v3.jpg"
            alt="Der Bierbeauftragte"
            fill
            priority
            className="object-cover"
            style={{ objectPosition: "50% 3%" }}
            sizes="(max-width: 640px) 100vw, 768px"
          />
        </div>
      </section>

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
                      <div
                        key={a.id}
                        className="flex items-start gap-2 rounded-xl bg-[var(--highlight-bg)] pl-3 pr-2 py-1.5"
                      >
                        <div>
                          <p className="text-sm font-semibold text-gold-dark">🍻 {a.player.name}</p>
                          {a.reason && (
                            <p className="text-xs text-muted mt-0.5">{a.reason}</p>
                          )}
                        </div>
                        {admin && (
                          <form
                            action={async () => {
                              "use server";
                              await deleteAssignmentAction(a.id);
                            }}
                          >
                            <button
                              type="submit"
                              className="text-gold-dark/60 hover:text-danger text-sm leading-none px-0.5"
                              aria-label={`Zuteilung für ${a.player.name} entfernen`}
                              title="Entfernen"
                            >
                              ✕
                            </button>
                          </form>
                        )}
                      </div>
                    ))}
                  </div>
                ) : admin ? (
                  <AssignmentPicker matchId={nextMatch.id} />
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
        <div className="px-5 sm:px-6 py-4 border-b border-border">
          <h2 className="text-lg font-bold">Kasten-Überblick</h2>
          <p className="text-xs text-muted mt-0.5">
            Aktueller Stand: wer hat gerade einen Kasten offen.
          </p>
        </div>
        <PlayerQueueTable rows={queueRows} admin={admin} />
      </section>
    </div>
  );
}
