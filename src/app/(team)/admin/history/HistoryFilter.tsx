"use client";

import { useState } from "react";
import { KastenLine } from "./KastenLine";
import { AddKastenForm } from "./AddKastenForm";

type Entry = {
  id: string;
  matchDateIso: string | null;
  reason: string;
  fulfilled: boolean;
};

type Group = {
  playerId: string;
  name: string;
  totalCount: number;
  entries: Entry[];
};

type Filter = "all" | "ausstehend" | "erledigt";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "Alle" },
  { value: "ausstehend", label: "🍺 Ausstehend" },
  { value: "erledigt", label: "✅ Erledigt" },
];

export function HistoryFilter({ groups }: { groups: Group[] }) {
  const [filter, setFilter] = useState<Filter>("all");

  const filteredGroups = groups
    .map((g) => ({
      ...g,
      entries: g.entries.filter((e) => {
        if (filter === "ausstehend") return !e.fulfilled;
        if (filter === "erledigt") return e.fulfilled;
        return true;
      }),
    }))
    .filter((g) => g.entries.length > 0);

  return (
    <div className="space-y-4">
      <div className="inline-flex rounded-lg border border-border overflow-hidden text-sm w-fit">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFilter(f.value)}
            className={`px-3 py-1.5 border-r last:border-r-0 border-border transition ${
              filter === f.value
                ? "bg-brand text-white"
                : "bg-white hover:bg-brand-light"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {filteredGroups.map((g) => (
        <div key={g.playerId} className="card p-4">
          <div className="flex items-center justify-between gap-2 mb-2">
            <h2 className="font-bold">
              {g.name} <span className="text-muted font-normal text-sm">({g.totalCount}×)</span>
            </h2>
            <AddKastenForm playerId={g.playerId} />
          </div>
          <div>
            {g.entries.map((a) => (
              <KastenLine
                key={a.id}
                id={a.id}
                matchDateIso={a.matchDateIso}
                reason={a.reason}
                fulfilled={a.fulfilled}
              />
            ))}
          </div>
        </div>
      ))}
      {filteredGroups.length === 0 && (
        <p className="text-muted text-center py-6">Keine Einträge für diesen Filter.</p>
      )}
    </div>
  );
}
