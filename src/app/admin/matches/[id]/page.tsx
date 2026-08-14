import { isAdmin } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { AttendanceRow } from "./AttendanceRow";
import { AttendanceCsvImport } from "./AttendanceCsvImport";
import { AssignmentPicker } from "./AssignmentPicker";
import { deleteAssignmentAction } from "@/lib/actions";

function formatDateTime(d: Date) {
  return d.toLocaleString("de-DE", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Berlin",
  });
}

export default async function MatchDetailPage({
  params,
}: PageProps<"/admin/matches/[id]">) {
  if (!(await isAdmin())) redirect("/admin");
  const { id } = await params;

  const match = await prisma.match.findUnique({
    where: { id },
    include: {
      attendances: { include: { player: true }, orderBy: { player: { name: "asc" } } },
      assignments: { include: { player: true } },
    },
  });
  if (!match) notFound();

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted">
          <Link href="/admin/matches" className="hover:underline">
            ← Alle Spiele
          </Link>
        </p>
        <h1 className="text-2xl font-bold mt-1">{formatDateTime(match.date)}</h1>
        <p className="text-muted text-sm mt-1">
          {match.opponent ? `gegen ${match.opponent}` : "Gegner offen"}
          {match.location ? ` · ${match.location}` : ""} · {match.isHome ? "Heimspiel" : "Auswärtsspiel"}
        </p>
      </div>

      <section className="card">
        <div className="px-5 sm:px-6 py-4 border-b border-border flex items-start justify-between gap-4 flex-wrap">
          <h2 className="text-lg font-bold">Anwesenheit</h2>
          <AttendanceCsvImport matchId={match.id} />
        </div>
        <table className="w-full text-sm">
          <tbody>
            {match.attendances.map((a) => (
              <AttendanceRow
                key={a.id}
                matchId={match.id}
                playerId={a.playerId}
                playerName={a.player.name}
                status={a.status}
                source={a.source}
              />
            ))}
            {match.attendances.length === 0 && (
              <tr>
                <td className="px-5 sm:px-6 py-6 text-center text-muted">
                  Keine aktiven Spieler vorhanden.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="card p-5 sm:p-6 space-y-4">
        <h2 className="text-lg font-bold">Kasten-Zuteilung</h2>

        {match.assignments.length > 0 ? (
          <div className="space-y-2">
            {match.assignments.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg border border-border bg-brand-light"
              >
                <div>
                  <p className="font-semibold">🍻 {a.player.name}</p>
                  {a.reason && <p className="text-sm text-muted">{a.reason}</p>}
                </div>
                <form
                  action={async () => {
                    "use server";
                    await deleteAssignmentAction(a.id);
                  }}
                >
                  <button type="submit" className="btn btn-danger text-xs px-2.5 py-1">
                    Entfernen
                  </button>
                </form>
              </div>
            ))}
          </div>
        ) : (
          <AssignmentPicker matchId={match.id} />
        )}
      </section>
    </div>
  );
}
