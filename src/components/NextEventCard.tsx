import Link from "next/link";
import { AssignmentPicker } from "@/components/AssignmentPicker";
import { deleteAssignmentAction } from "@/lib/actions";

type NextEventMatch = {
  id: string;
  date: Date;
  type: "SPIEL" | "TRAINING";
  opponent: string | null;
  location: string | null;
  isHome: boolean;
  attendances: { status: string }[];
  assignments: { id: string; reason: string | null; player: { name: string } }[];
};

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

/**
 * Gemeinsame Darstellung fuer "Naechstes Spiel" und "Naechstes Training" auf
 * der Startseite - beide zeigen Datum/Zeit, Zusagen und die Kasten-Zuteilung
 * identisch an, unterscheiden sich nur in der Unterzeile (Gegner/Heim-
 * Auswaerts nur beim Spiel relevant) und den Texten fuer den Leerzustand.
 */
export function NextEventCard({
  title,
  match,
  admin,
  emptyMessage,
  createHref,
  createLabel,
}: {
  title: string;
  match: NextEventMatch | null;
  admin: boolean;
  emptyMessage: string;
  createHref: string;
  createLabel: string;
}) {
  const zusagen = match?.attendances.filter((a) => a.status === "ZUSAGE") ?? [];

  return (
    <section className="card overflow-hidden">
      <div className="bg-brand-dark text-white px-5 sm:px-6 py-4">
        <h1 className="text-lg sm:text-xl font-bold flex items-center gap-2">{title}</h1>
      </div>
      <div className="p-5 sm:p-6">
        {match ? (
          <div className="space-y-4">
            <div>
              <p className="text-xl font-semibold">
                {formatDate(match.date)}, {formatTime(match.date)} Uhr
              </p>
              <p className="text-muted text-sm mt-1">
                {match.type === "SPIEL" ? (
                  <>
                    {match.opponent ? `gegen ${match.opponent}` : "Gegner noch offen"}
                    {match.location ? ` · ${match.location}` : ""}
                    {" · "}
                    {match.isHome ? "Heimspiel" : "Auswärtsspiel"}
                  </>
                ) : (
                  match.location
                )}
              </p>
            </div>

            <div className="flex flex-wrap gap-2 items-center text-sm text-muted">
              <span className="badge badge-green">{zusagen.length} Zusagen</span>
            </div>

            <div>
              <p className="text-sm font-semibold text-muted mb-2">Bringt den Kasten mit</p>
              {match.assignments.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {match.assignments.map((a) => (
                    <div
                      key={a.id}
                      className="flex items-start gap-2 rounded-xl bg-[#fbeed2] pl-3 pr-2 py-1.5"
                    >
                      <div>
                        <p className="text-sm font-semibold text-gold-dark">🍻 {a.player.name}</p>
                        {a.reason && <p className="text-xs text-muted mt-0.5">{a.reason}</p>}
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
                <AssignmentPicker matchId={match.id} />
              ) : (
                <p className="text-sm text-muted italic">Noch nicht festgelegt.</p>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-muted">{emptyMessage}</p>
            {admin && (
              <Link href={createHref} className="btn btn-gold text-sm">
                {createLabel}
              </Link>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
