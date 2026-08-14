import { isAdmin } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { HistoryRow } from "./HistoryRow";

function formatDate(d: Date) {
  return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default async function AdminHistoryPage() {
  if (!(await isAdmin())) redirect("/admin");

  const assignments = await prisma.kastenAssignment.findMany({
    include: { player: true, match: true },
  });
  assignments.sort((a, b) => {
    const dateA = a.match?.date ?? a.fulfilledAt ?? a.createdAt;
    const dateB = b.match?.date ?? b.fulfilledAt ?? b.createdAt;
    return dateB.getTime() - dateA.getTime();
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Kasten-Historie</h1>
        <p className="text-muted text-sm mt-1">
          Begründungen pflegen und markieren, wenn ein Kasten tatsächlich mitgebracht wurde.
        </p>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted border-b border-border">
              <th className="px-5 sm:px-6 py-2.5 font-medium">Datum</th>
              <th className="px-3 py-2.5 font-medium">Spieler</th>
              <th className="px-3 py-2.5 font-medium">Begründung</th>
              <th className="px-3 py-2.5 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {assignments.map((a) => (
              <HistoryRow
                key={a.id}
                id={a.id}
                playerName={a.player.name}
                matchDate={
                  a.match
                    ? formatDate(a.match.date)
                    : a.fulfilled
                      ? formatDate(a.fulfilledAt ?? a.createdAt)
                      : "kein Spieltag"
                }
                reason={a.reason ?? ""}
                fulfilled={a.fulfilled}
              />
            ))}
            {assignments.length === 0 && (
              <tr>
                <td colSpan={4} className="px-5 sm:px-6 py-6 text-center text-muted">
                  Noch keine Einträge.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
