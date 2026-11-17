import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/auth";
import { formatEventDate, getEventWithParticipants, summarizeOrder } from "@/lib/events";
import { fetchMenu, menuChoices } from "@/lib/menu";
import {
  addEventParticipantAction,
  deleteEventAction,
  removeEventParticipantAction,
  updateEventMealSettingsAction,
} from "@/lib/event-actions";
import { MealChoiceRow } from "./MealChoiceRow";
import { EventCsvImport } from "./EventCsvImport";

export const metadata: Metadata = { title: "Event" };

// Vorschlag fuer die Weihnachtsfeier (vom Admin gewuenscht); bei anderen
// Events bleibt das Feld leer.
const DEFAULT_XMAS_MENU_URL = "https://bibabo.de/speisekarte";

export default async function EventPage({ params }: PageProps<"/events/[id]">) {
  const { id } = await params;
  const [event, admin] = await Promise.all([getEventWithParticipants(id).catch(() => null), isAdmin()]);
  if (!event) notFound();

  const menu = event.mealOrder && event.menuUrl ? await fetchMenu(event.menuUrl) : null;
  const choices = menu ? menuChoices(menu) : [];
  const { totals, missing } = summarizeOrder(event.participants);
  const chosen = event.participants.length - missing.length;
  const canEdit = event.mealOrder && (!event.orderLocked || admin);

  const players = admin
    ? await prisma.player.findMany({ where: { active: true }, orderBy: { name: "asc" } })
    : [];
  const participantPlayerIds = new Set(event.participants.map((p) => p.playerId));
  const addablePlayers = players.filter((p) => !participantPlayerIds.has(p.id));

  return (
    <div className="space-y-6">
      <div>
        <Link href="/events" className="text-sm text-muted hover:text-foreground">
          ← Alle Events
        </Link>
        <h1 className="text-2xl font-bold mt-1">🎉 {event.title}</h1>
        <p className="text-muted text-sm mt-1">
          {formatEventDate(event.date)} Uhr{event.location ? ` · ${event.location}` : ""}
        </p>
      </div>

      <section className="card overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b border-border">
          <h2 className="text-lg font-bold">
            {event.mealOrder ? "🍽️ Essensbestellung" : "👥 Teilnehmer"} ({event.participants.length})
          </h2>
          {event.mealOrder && event.participants.length > 0 && (
            <>
              <p className="text-sm text-muted mt-0.5">
                {event.orderLocked
                  ? "Die Bestellung ist abgeschlossen – Änderungen bitte direkt beim Admin melden."
                  : `${chosen} von ${event.participants.length} haben ihr Essen gewählt. Such deinen Namen und tippe auf „Essen wählen“.`}
              </p>
              <div className="h-2 rounded-full bg-brand-light mt-2 overflow-hidden">
                <div
                  className="h-full bg-brand transition-all"
                  style={{ width: `${Math.round((chosen / event.participants.length) * 100)}%` }}
                />
              </div>
            </>
          )}
          {event.mealOrder && event.menuUrl && !menu && (
            <p className="text-xs text-danger mt-2">
              Die Speisekarte konnte gerade nicht geladen werden – bitte das Gericht selbst eintragen oder{" "}
              <a href={event.menuUrl} target="_blank" rel="noopener noreferrer" className="underline">
                hier nachschauen
              </a>
              .
            </p>
          )}
        </div>

        {event.participants.length === 0 ? (
          <p className="px-4 sm:px-6 py-6 text-sm text-muted">
            Noch keine Teilnehmer eingetragen
            {admin ? " – unten die Spielerplus-Teilnehmerliste importieren oder Spieler hinzufügen." : "."}
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {event.participants.map((p) => (
              <MealChoiceRow
                key={`${p.id}-${p.dish ?? ""}-${p.note ?? ""}`}
                participant={p}
                choices={choices}
                editable={canEdit}
                removeButton={
                  admin ? (
                    <form key={p.id} action={removeEventParticipantAction.bind(null, p.id)}>
                      <button
                        type="submit"
                        title={`${p.name} entfernen`}
                        className="btn btn-danger text-sm py-1.5 px-2.5"
                      >
                        ✕
                      </button>
                    </form>
                  ) : null
                }
              />
            ))}
          </ul>
        )}

        {event.mealOrder && totals.length > 0 && (
          <div className="px-4 sm:px-6 py-3 border-t border-border bg-surface text-sm">
            <p className="font-semibold mb-1">Bisher bestellt</p>
            <p className="text-muted">
              {totals.map((t) => `${t.count}× ${t.dish}`).join(" · ")}
            </p>
          </div>
        )}
      </section>

      {admin && (
        <section className="card border-2 border-gold">
          <div className="px-4 sm:px-6 py-3 border-b border-border">
            <h2 className="font-bold">🔧 Admin</h2>
          </div>
          <div className="px-4 sm:px-6 py-4 space-y-6">
            {event.mealOrder && (
              <div className="space-y-2">
                <p className="text-sm font-semibold">Bestellung exportieren</p>
                <div className="flex flex-wrap gap-2">
                  <Link href={`/events/${event.id}/bestellung`} className="btn btn-primary">
                    📋 Bestellliste ansehen, kopieren, drucken
                  </Link>
                  <a href={`/events/${event.id}/export`} className="btn btn-outline">
                    ⬇️ Excel-Datei (CSV)
                  </a>
                </div>
                {missing.length > 0 && (
                  <p className="text-xs text-muted">Noch offen: {missing.join(", ")}</p>
                )}
              </div>
            )}

            <form action={updateEventMealSettingsAction.bind(null, event.id)} className="space-y-3">
              <p className="text-sm font-semibold">Essensbestellung</p>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="mealOrder" defaultChecked={event.mealOrder} className="w-4 h-4" />
                Essensbestellung für dieses Event aktivieren
              </label>
              <label className="block">
                <span className="text-xs font-medium text-muted block mb-1">Link zur Speisekarte</span>
                <input
                  name="menuUrl"
                  type="url"
                  className="input"
                  defaultValue={
                    event.menuUrl ?? (/weihnacht/i.test(event.title) ? DEFAULT_XMAS_MENU_URL : "")
                  }
                  placeholder="https://…"
                />
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="orderLocked" defaultChecked={event.orderLocked} className="w-4 h-4" />
                Bestellung abschließen (Spieler können nichts mehr ändern, du schon)
              </label>
              <button type="submit" className="btn btn-gold">
                Speichern
              </button>
            </form>

            <div className="grid sm:grid-cols-2 gap-6">
              <div className="space-y-3">
                <p className="text-sm font-semibold">Teilnehmer hinzufügen</p>
                <form action={addEventParticipantAction.bind(null, event.id)} className="flex gap-2">
                  <select name="playerId" className="input" required defaultValue="">
                    <option value="" disabled>
                      Spieler wählen…
                    </option>
                    {addablePlayers.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <button type="submit" className="btn btn-primary shrink-0">
                    Hinzufügen
                  </button>
                </form>
                <form action={addEventParticipantAction.bind(null, event.id)} className="flex gap-2">
                  <input name="name" className="input" placeholder="Gast / anderer Name" required maxLength={80} />
                  <button type="submit" className="btn btn-outline shrink-0">
                    Hinzufügen
                  </button>
                </form>
              </div>
              <EventCsvImport eventId={event.id} />
            </div>

            {!event.externalId && (
              <form action={deleteEventAction.bind(null, event.id)}>
                <button type="submit" className="btn btn-danger text-sm">
                  Event löschen
                </button>
              </form>
            )}
          </div>
        </section>
      )}

      {menu && (
        <section className="card overflow-hidden">
          <div className="px-4 sm:px-6 py-4 border-b border-border flex items-center justify-between gap-3 flex-wrap">
            <h2 className="text-lg font-bold">📖 Speisekarte</h2>
            <a
              href={event.menuUrl ?? "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-muted underline"
            >
              Original-Karte öffnen ↗
            </a>
          </div>
          <div className="divide-y divide-border">
            {menu.map((section, i) => (
              <details key={section.title} open={i === 0}>
                <summary className="px-4 sm:px-6 py-3 font-semibold cursor-pointer">
                  {section.title} <span className="text-muted font-normal">({section.items.length})</span>
                </summary>
                <ul className="px-4 sm:px-6 pb-4 space-y-2.5">
                  {section.items.map((item) => (
                    <li key={item.name} className="flex items-start justify-between gap-3 text-sm">
                      <div className="min-w-0">
                        <p className="font-medium">{item.name}</p>
                        {item.description && <p className="text-xs text-muted">{item.description}</p>}
                        {item.allergens && <p className="text-[11px] text-muted/80">Allergene: {item.allergens}</p>}
                      </div>
                      {item.priceLabel && (
                        <span
                          className={`whitespace-nowrap ${item.price !== null ? "font-semibold text-brand-dark" : "text-xs text-muted"}`}
                        >
                          {item.priceLabel}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </details>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
