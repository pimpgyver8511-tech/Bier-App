import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/auth";
import { startOfBerlinDay } from "@/lib/timezone";
import { formatEventDate } from "@/lib/events";
import { createEventAction } from "@/lib/event-actions";

export const metadata: Metadata = { title: "Events" };

export default async function EventsPage() {
  const startOfToday = startOfBerlinDay();
  const [admin, events] = await Promise.all([
    isAdmin(),
    prisma.teamEvent
      .findMany({
        orderBy: { date: "asc" },
        include: { participants: { select: { dish: true } } },
      })
      .catch(() => null),
  ]);

  if (events === null) {
    return (
      <div className="card p-6 text-sm text-muted">
        Events sind noch nicht eingerichtet
        {admin ? " – bitte unter Admin › Einstellungen „Datenbank einrichten/aktualisieren“ klicken." : "."}
      </div>
    );
  }

  const upcoming = events.filter((e) => e.date >= startOfToday);
  const past = events.filter((e) => e.date < startOfToday).reverse();

  const renderEvent = (e: (typeof events)[number]) => {
    const chosen = e.participants.filter((p) => p.dish).length;
    return (
      <li key={e.id}>
        <Link
          href={`/events/${e.id}`}
          className="flex items-center justify-between gap-3 px-5 sm:px-6 py-4 hover:bg-brand-light transition"
        >
          <div className="min-w-0">
            <p className="font-semibold">{e.title}</p>
            <p className="text-sm text-muted">
              {formatEventDate(e.date)} Uhr{e.restaurant ? ` · 🍴 ${e.restaurant}` : e.location ? ` · ${e.location}` : ""}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <span className="badge badge-gray">{e.participants.length} Teilnehmer</span>
            {e.mealOrder && (
              <span className={`badge ${e.orderLocked ? "badge-green" : "badge-gold"}`}>
                🍽️ {e.orderLocked ? "bestellt" : `${chosen}/${e.participants.length} gewählt`}
              </span>
            )}
          </div>
        </Link>
      </li>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">🎉 Events</h1>
        <p className="text-muted text-sm mt-1">
          Mannschaftstermine abseits von Spiel und Training, z. B. die Weihnachtsfeier – inkl. Essensbestellung.
        </p>
      </div>

      <section className="card overflow-hidden">
        <h2 className="px-5 sm:px-6 py-3 border-b border-border font-bold">Anstehend</h2>
        {upcoming.length ? (
          <ul className="divide-y divide-border">{upcoming.map(renderEvent)}</ul>
        ) : (
          <p className="px-5 sm:px-6 py-6 text-sm text-muted">
            Kein anstehendes Event. Events werden automatisch aus dem Spielerplus-Kalender übernommen.
          </p>
        )}
      </section>

      {past.length > 0 && (
        <details className="card overflow-hidden">
          <summary className="px-5 sm:px-6 py-3 font-bold cursor-pointer">Vergangene Events ({past.length})</summary>
          <ul className="divide-y divide-border border-t border-border">{past.map(renderEvent)}</ul>
        </details>
      )}

      {admin && (
        <details className="card">
          <summary className="px-5 sm:px-6 py-3 font-bold cursor-pointer">➕ Event von Hand anlegen</summary>
          <form action={createEventAction} className="px-5 sm:px-6 pb-5 grid sm:grid-cols-3 gap-3">
            <p className="sm:col-span-3 text-xs text-muted">
              Nur nötig, falls das Event nicht im Spielerplus-Kalender steht (Abgleich unter Admin › Einstellungen).
            </p>
            <div>
              <label className="text-sm font-medium text-muted block mb-1">Titel</label>
              <input name="title" className="input" placeholder="Weihnachtsfeier" required />
            </div>
            <div>
              <label className="text-sm font-medium text-muted block mb-1">Datum &amp; Uhrzeit</label>
              <input type="datetime-local" name="date" className="input" required />
            </div>
            <div>
              <label className="text-sm font-medium text-muted block mb-1">Ort (optional)</label>
              <input name="location" className="input" placeholder="BiBaBo" />
            </div>
            <div className="sm:col-span-3">
              <button type="submit" className="btn btn-primary">Event anlegen</button>
            </div>
          </form>
        </details>
      )}
    </div>
  );
}
