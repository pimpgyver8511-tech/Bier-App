import Link from "next/link";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth";
import { buildOrderText, formatEventDate, getEventWithParticipants, summarizeOrder } from "@/lib/events";
import { OrderActions } from "./OrderActions";

export const metadata: Metadata = { title: "Bestellliste" };

/** Bestellliste fuers Restaurant - nur fuer den Admin. */
export default async function OrderPage({ params }: PageProps<"/events/[id]/bestellung">) {
  if (!(await isAdmin())) redirect("/admin");
  const { id } = await params;
  const event = await getEventWithParticipants(id);
  if (!event) notFound();
  const { totals, missing } = summarizeOrder(event.participants);

  return (
    <div className="space-y-5">
      <div className="print:hidden">
        <Link href={`/events/${event.id}`} className="text-sm text-muted hover:text-foreground">
          ← Zurück zum Event
        </Link>
      </div>
      <div>
        <h1 className="text-2xl font-bold">Essensbestellung {event.title}</h1>
        <p className="text-muted text-sm mt-1">
          {formatEventDate(event.date)} Uhr{event.location ? ` · ${event.location}` : ""} · {event.participants.length}{" "}
          Personen
        </p>
      </div>

      <OrderActions text={buildOrderText(event, event.participants)} />
      {missing.length > 0 && (
        <p className="text-sm text-danger print:hidden">
          ⚠️ Noch {missing.length} ohne Essenswahl: {missing.join(", ")}
        </p>
      )}

      <section className="card overflow-hidden">
        <h2 className="px-4 sm:px-6 py-3 border-b border-border font-bold">Zusammenfassung</h2>
        <table className="w-full text-sm">
          <tbody>
            {totals.map((t) => (
              <tr key={t.dish} className="border-b border-border last:border-0">
                <td className="px-4 sm:px-6 py-2 w-16 font-bold">{t.count}×</td>
                <td className="px-2 py-2">{t.dish}</td>
              </tr>
            ))}
            {missing.length > 0 && (
              <tr>
                <td className="px-4 sm:px-6 py-2 font-bold">{missing.length}×</td>
                <td className="px-2 py-2 text-muted">noch offen</td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="card overflow-hidden">
        <h2 className="px-4 sm:px-6 py-3 border-b border-border font-bold">Pro Person</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted border-b border-border">
              <th className="px-4 sm:px-6 py-2 font-medium">#</th>
              <th className="px-2 py-2 font-medium">Name</th>
              <th className="px-2 sm:pr-6 py-2 font-medium">Gericht</th>
            </tr>
          </thead>
          <tbody>
            {event.participants.map((p, i) => (
              <tr key={p.id} className="border-b border-border last:border-0 align-top">
                <td className="px-4 sm:px-6 py-2 text-muted">{i + 1}</td>
                <td className="px-2 py-2 font-medium">{p.name}</td>
                <td className="px-2 sm:pr-6 py-2">
                  {p.dish ?? <span className="text-danger">noch offen</span>}
                  {p.note && <span className="block text-xs font-medium text-gold-dark">✏️ {p.note}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
