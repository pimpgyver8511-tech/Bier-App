import { isAdmin } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { createPlayerAction, togglePlayerActiveAction, deletePlayerAction } from "@/lib/actions";

export default async function PlayersPage() {
  if (!(await isAdmin())) redirect("/admin");

  const players = await prisma.player.findMany({
    orderBy: [{ active: "desc" }, { name: "asc" }],
    include: { _count: { select: { assignments: true } } },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Spieler verwalten</h1>
        <p className="text-muted text-sm mt-1">Der Kader für Anwesenheit und Kasten-Zuteilung.</p>
      </div>

      <form action={createPlayerAction} className="card p-4 flex gap-2">
        <input
          type="text"
          name="name"
          placeholder="Name des Spielers"
          className="input"
          required
        />
        <button type="submit" className="btn btn-primary whitespace-nowrap">
          + Hinzufügen
        </button>
      </form>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted border-b border-border">
              <th className="px-5 sm:px-6 py-2.5 font-medium">Name</th>
              <th className="px-3 py-2.5 font-medium">Kästen bisher</th>
              <th className="px-3 py-2.5 font-medium">Status</th>
              <th className="px-3 py-2.5 font-medium text-right">Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {players.map((p) => (
              <tr key={p.id} className="border-b border-border last:border-0">
                <td className="px-5 sm:px-6 py-3 font-medium">{p.name}</td>
                <td className="px-3 py-3 text-muted">{p._count.assignments}×</td>
                <td className="px-3 py-3">
                  {p.active ? (
                    <span className="badge badge-green">aktiv</span>
                  ) : (
                    <span className="badge badge-gray">inaktiv</span>
                  )}
                </td>
                <td className="px-3 py-3">
                  <div className="flex justify-end gap-2">
                    <form
                      action={async () => {
                        "use server";
                        await togglePlayerActiveAction(p.id, !p.active);
                      }}
                    >
                      <button type="submit" className="btn btn-outline text-xs px-2.5 py-1">
                        {p.active ? "Deaktivieren" : "Aktivieren"}
                      </button>
                    </form>
                    <form
                      action={async () => {
                        "use server";
                        await deletePlayerAction(p.id);
                      }}
                    >
                      <button type="submit" className="btn btn-danger text-xs px-2.5 py-1">
                        Löschen
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
            {players.length === 0 && (
              <tr>
                <td colSpan={4} className="px-5 sm:px-6 py-6 text-center text-muted">
                  Noch keine Spieler angelegt.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
