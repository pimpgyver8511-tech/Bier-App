import { isAdmin } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { createMatchAction, deleteMatchAction } from "@/lib/actions";
import Link from "next/link";

function formatDateTime(d: Date) {
  return d.toLocaleString("de-DE", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function MatchesPage() {
  if (!(await isAdmin())) redirect("/admin");

  const matches = await prisma.match.findMany({
    orderBy: { date: "desc" },
    include: {
      _count: { select: { assignments: true } },
      attendances: true,
    },
  });

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
          <p className="text-muted text-center py-6">Noch keine Spiele angelegt.</p>
        )}
      </div>
    </div>
  );
}
