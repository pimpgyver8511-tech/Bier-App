import { isAdmin } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import {
  createPlayerAction,
  bulkImportPlayersAction,
  togglePlayerActiveAction,
  deletePlayerAction,
} from "@/lib/actions";
import { PlayerNameEditor } from "./PlayerNameEditor";

export default async function PlayersPage() {
  if (!(await isAdmin())) redirect("/admin");

  let players: Awaited<ReturnType<typeof prisma.player.findMany>> = [];
  let counts = new Map<string, number>();
  let dbReady = true;
  try {
    const rows = await prisma.player.findMany({
      orderBy: [{ active: "desc" }, { name: "asc" }],
      include: { _count: { select: { assignments: true } } },
    });
    players = rows;
    counts = new Map(rows.map((p) => [p.id, p._count.assignments]));
  } catch {
    dbReady = false;
  }

  if (!dbReady) {
    return (
      <div className="card p-5 sm:p-6 space-y-2">
        <h1 className="font-bold text-lg">⚠️ Datenbank noch nicht eingerichtet</h1>
        <p className="text-sm text-muted">
          Bitte zuerst unter{" "}
          <Link href="/admin/settings" className="text-brand font-semibold hover:underline">
            Einstellungen
          </Link>{" "}
          einrichten.
        </p>
      </div>
    );
  }

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

      <details className="card p-4">
        <summary className="cursor-pointer font-semibold text-sm">
          Mehrere Spieler auf einmal einfügen
        </summary>
        <form action={bulkImportPlayersAction} className="mt-3 space-y-2">
          <textarea
            name="names"
            rows={8}
            placeholder={"Ein Name pro Zeile, z. B.\nMax Mustermann\nErik Schmidt\n..."}
            className="input"
          />
          <button type="submit" className="btn btn-primary text-sm">
            Alle importieren
          </button>
        </form>
      </details>

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
                <td className="px-5 sm:px-6 py-3 font-medium min-w-[10rem]">
                  <PlayerNameEditor playerId={p.id} name={p.name} />
                  {p.alias && (
                    <p className="text-xs text-muted mt-0.5">vorher: {p.alias}</p>
                  )}
                </td>
                <td className="px-3 py-3 text-muted">{counts.get(p.id) ?? 0}×</td>
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
