"use client";

import { useState } from "react";
import { ImportRowCard } from "./ImportRowCard";
import { LoadImportButton } from "./LoadImportButton";

type Player = { id: string; name: string };

export type ImportRowData = {
  id: string;
  source: "SEITE3" | "OFFEN" | "GUTHABEN";
  rawDate: string | null;
  nickname: string;
  reason: string;
  count: number;
  suggestedPlayerId: string | null;
};

const SOURCE_LABELS: Record<ImportRowData["source"], string> = {
  SEITE3: "Saison 2026 (mit Datum)",
  OFFEN: "Noch offene Kästen (ohne Datum)",
  GUTHABEN: "Guthaben (schon im Voraus gebracht)",
};

export function ImportWorkbench({
  initialRows,
  players,
}: {
  initialRows: ImportRowData[];
  players: Player[];
}) {
  const [rows, setRows] = useState(initialRows);

  function handleDone(id: string) {
    setRows((prev) => prev.filter((r) => r.id !== id));
  }

  if (rows.length === 0) {
    return (
      <div className="card p-5 sm:p-6 space-y-3">
        <p className="text-sm text-muted">
          Keine offenen Import-Zeilen mehr (entweder alles übernommen/ignoriert, oder
          noch nicht geladen).
        </p>
        <LoadImportButton />
      </div>
    );
  }

  const groups: ImportRowData["source"][] = ["GUTHABEN", "OFFEN", "SEITE3"];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="text-sm text-muted">{rows.length} Zeilen noch zu prüfen.</p>
        <LoadImportButton label="Rohdaten neu laden (ersetzt aktuelle Liste)" />
      </div>

      {groups.map((source) => {
        const groupRows = rows.filter((r) => r.source === source);
        if (groupRows.length === 0) return null;
        return (
          <section key={source} className="space-y-3">
            <h2 className="font-bold text-lg">{SOURCE_LABELS[source]}</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              {groupRows.map((row) => (
                <ImportRowCard
                  key={row.id}
                  id={row.id}
                  dateLabel={row.rawDate}
                  nickname={row.nickname}
                  reason={row.reason}
                  count={row.count}
                  suggestedPlayerId={row.suggestedPlayerId}
                  players={players}
                  onDone={handleDone}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
