import { prisma } from "@/lib/db";
import { buildPlayerOverview } from "@/lib/kasten";
import { isAdmin } from "@/lib/auth";
import { startOfBerlinDay } from "@/lib/timezone";
import Image from "next/image";
import { PlayerQueueTable, type QueueRow } from "@/components/PlayerQueueTable";
import { NextEventCard } from "@/components/NextEventCard";
import Link from "next/link";
import { formatEventDate } from "@/lib/events";

function formatDate(d: Date) {
  return d.toLocaleDateString("de-DE", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Europe/Berlin",
  });
}

export default async function HomePage() {
  const startOfToday = startOfBerlinDay();

  const eventInclude = {
    attendances: { include: { player: true } },
    // "Bringt den Kasten mit" zeigt nur wer noch offen ist - bereits
    // erledigte Zuweisungen (z.B. per erledigt-Schalter in der Kasten-
    // Historie vorab bestaetigt) sollen hier nicht mehr auftauchen.
    assignments: { where: { fulfilled: false }, include: { player: true } },
  } as const;

  const [nextMatch, nextTraining, overview, admin, nextTeamEvent] = await Promise.all([
    prisma.match.findFirst({
      where: { date: { gte: startOfToday }, type: "SPIEL" },
      orderBy: { date: "asc" },
      include: eventInclude,
    }),
    prisma.match.findFirst({
      where: { date: { gte: startOfToday }, type: "TRAINING" },
      orderBy: { date: "asc" },
      include: eventInclude,
    }),
    buildPlayerOverview(),
    isAdmin(),
    // .catch: Tabelle evtl. noch nicht eingerichtet (Admin > Einstellungen)
    prisma.teamEvent
      .findFirst({
        where: { date: { gte: startOfToday } },
        orderBy: { date: "asc" },
        include: { participants: { select: { dish: true } } },
      })
      .catch(() => null),
  ]);

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
    <div className="space-y-8">
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

      <NextEventCard
        title="🍺 Nächstes Spiel"
        match={nextMatch}
        admin={admin}
        emptyMessage="Aktuell ist kein anstehendes Spiel eingetragen."
        createHref="/admin/matches"
        createLabel="🍺 Spiel anlegen & Kasten-Verantwortliche festlegen →"
      />

      <NextEventCard
        title="🏋️ Nächstes Training"
        match={nextTraining}
        admin={admin}
        emptyMessage="Aktuell ist kein anstehendes Training eingetragen."
        createHref="/admin/matches"
        createLabel="🏋️ Training anlegen & Kasten-Verantwortliche festlegen →"
      />

      {nextTeamEvent && (
        <section className="card">
          <div className="px-5 sm:px-6 py-4 flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h2 className="text-lg font-bold">🎉 Nächstes Event: {nextTeamEvent.title}</h2>
              <p className="text-sm text-muted mt-0.5">
                {formatEventDate(nextTeamEvent.date)} Uhr
                {nextTeamEvent.location ? ` · ${nextTeamEvent.location}` : ""}
              </p>
              {nextTeamEvent.mealOrder && (
                <p className="text-sm mt-1">
                  🍽️ {nextTeamEvent.participants.filter((p) => p.dish).length} von{" "}
                  {nextTeamEvent.participants.length} haben ihr Essen gewählt
                </p>
              )}
            </div>
            <Link href={`/events/${nextTeamEvent.id}`} className="btn btn-primary">
              {nextTeamEvent.mealOrder && !nextTeamEvent.orderLocked ? "🍽️ Essen wählen →" : "Details →"}
            </Link>
          </div>
        </section>
      )}

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
