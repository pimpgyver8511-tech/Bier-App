import { isAdmin } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { createMatchAction, deleteMatchAction } from "@/lib/actions";
import { startOfBerlinDay } from "@/lib/timezone";
import Link from "next/link";

function formatDateTime(d: Date) {
  return d.toLocaleString("de-DE", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Berlin",
  });
}

export default async function MatchesPage() {
  if (!(await isAdmin())) redirect("/admin");

  const startOfToday = startOfBerlinDay();

  const [matches, players] = await Promise.all([
    prisma.match.findMany({
      where: { date: { gte: startOfToday } },
      orderBy: { date: "asc" },
      include: {
        _count: { select: { assignments: true } },
        attendances: true,
      },
    }),
    prisma.player.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Spiele</h1>
        <p className="text-muted text-sm mt-1">
          Spieltag anlegen, danach Anwesenheit pflegen und Kasten zuteilen.
        </p>
      </div>

      <form action={createMatchAction} className="card p-4 grid sm:grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium text-muted block mb-1">Datum &amp; Uhrzeit</label>
          <input type="datetime-local" name="date" className="input" required />
        </div>
        <div>
          <label className="text-sm font-medium text-muted block mb-1">Gegner</label>
          <input type="text" name="opponent" className="input" placeholder="z. B. SV Musterhausen" />
        </div>
        <div>
          <label className="text-sm font-medium text-muted block mb-1">Ort</label>
          <input type="text" name="location" className="input" placeholder="Sportplatz ..." />
        </div>
        <div className="flex items-center gap-2 pt-6">
          <input type="checkbox" name="isHome" id="isHome" defaultChecked className="w-4 h-4" />
          <label htmlFor="isHome" className="text-sm">Heimspiel</label>
        </div>

        <div className="sm:col-span-2 border-t border-border pt-3 mt-1">
          <label className="text-sm font-medium text-muted block mb-2">
            Bringt den Kasten mit (optional, mehrere möglich)
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-1.5 max-h-48 overflow-y-auto pr-1">
            {players.map((p) => (
              <label key={p.id} className="flex items-center gap-1.5 text-sm">
                <input type="checkbox" name="kastenPlayers" value={p.id} className="w-4 h-4" />
                {p.name}
              </label>
            ))}
          </div>
        </div>
        <div className="sm:col-span-2">
          <label className="text-sm font-medium text-muted block mb-1">
            Begründung (optional, für alle ausgewählten oben)
          </label>
          <input
            type="text"
            name="kastenReason"
            className="input"
            placeholder="z. B. Geburtstag, verlorene Wette …"
          />
        </div>

        <div className="sm:col-span-2">
          <button type="submit" className="btn btn-primary">+ Spiel anlegen</button>
        </div>
      </form>

      <div className="space-y-3">
        {matches.map((m) => {
          const zusagen = m.attendances.filter((a) => a.status === "ZUSAGE").length;
          return (
            <div key={m.id} className="card p-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-semibold">{formatDateTime(m.date)}</p>
                <p className="text-sm text-muted">
                  {m.opponent ? `gegen ${m.opponent}` : "Gegner offen"}
                  {m.location ? ` · ${m.location}` : ""} · {m.isHome ? "Heim" : "Auswärts"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="badge badge-green">{zusagen} Zusagen</span>
                <span className="badge badge-gold">{m._count.assignments} Kasten</span>
                <Link href={`/admin/matches/${m.id}`} className="btn btn-outline text-sm">
                  Öffnen
                </Link>
                <form
                  action={async () => {
                    "use server";
                    await deleteMatchAction(m.id);
                  }}
                >
                  <button type="submit" className="btn btn-danger text-sm">Löschen</button>
                </form>
              </div>
            </div>
          );
        })}
        {matches.length === 0 && (
          <p className="text-muted text-center py-6">Keine anstehenden Spiele.</p>
        )}
      </div>
    </div>
  );
}
