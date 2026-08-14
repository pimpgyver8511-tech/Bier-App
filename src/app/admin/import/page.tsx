import { isAdmin } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { ImportWorkbench, type ImportRowData } from "./ImportWorkbench";
import { DbSetupButton } from "@/components/DbSetupButton";

export default async function ImportPage() {
  if (!(await isAdmin())) redirect("/admin");

  let rows: ImportRowData[] = [];
  let players: { id: string; name: string }[] = [];
  let dbReady = true;
  try {
    const [rawRows, rawPlayers] = await Promise.all([
      prisma.kastenImportRow.findMany({ orderBy: [{ source: "asc" }, { resolvedDate: "asc" }] }),
      prisma.player.findMany({ orderBy: { name: "asc" } }),
    ]);
    players = rawPlayers;
    rows = rawRows.map((r) => ({
      id: r.id,
      source: r.source,
      rawDate: r.rawDate,
      nickname: r.nickname,
      reason: r.reason ?? "",
      count: r.count,
      suggestedPlayerId: r.suggestedPlayerId,
    }));
  } catch {
    dbReady = false;
  }

  if (!dbReady) {
    return (
      <div className="card p-5 sm:p-6 space-y-3">
        <h1 className="font-bold text-lg">⚠️ Datenbank-Update nötig</h1>
        <p className="text-sm text-muted">
          Für die Import-Werkstatt fehlt noch eine neue Tabelle (bzw. eine
          Schema-Änderung). Einmal klicken, danach lädt diese Seite normal.
        </p>
        <DbSetupButton />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Kasten-Historie importieren</h1>
        <p className="text-muted text-sm mt-1">
          Alte, handisch gepflegte Kasten-Einträge prüfen: Spieler zuordnen, Text
          korrigieren, dann übernehmen oder ignorieren. Details/Hintergrund siehe{" "}
          <code className="bg-brand-light px-1 rounded">docs/kasten-historie-import.md</code>{" "}
          im Repo.
        </p>
      </div>

      <ImportWorkbench
        key={`${rows.length}-${rows[0]?.id ?? "empty"}`}
        initialRows={rows}
        players={players}
      />
    </div>
  );
}
