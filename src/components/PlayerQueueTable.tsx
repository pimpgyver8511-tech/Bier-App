"use client";

import { useState, useMemo } from "react";

export type QueueRow = {
  playerId: string;
  name: string;
  lastLabel: string;
  totalKasten: number;
  open: boolean;
  cooldownRemainingDays: number | null;
};

export function PlayerQueueTable({ rows }: { rows: QueueRow[] }) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((r) => r.name.toLowerCase().includes(term));
  }, [rows, search]);

  return (
    <div>
      <div className="px-5 sm:px-6 py-3 border-b border-border">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="🔍 Spieler suchen…"
          className="input max-w-xs"
        />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted border-b border-border">
              <th className="px-5 sm:px-6 py-2.5 font-medium">Spieler</th>
              <th className="px-3 py-2.5 font-medium">Letzter/nächster Kasten</th>
              <th className="px-3 py-2.5 font-medium">Insgesamt</th>
              <th className="px-3 py-2.5 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.playerId} className="border-b border-border last:border-0">
                <td className="px-5 sm:px-6 py-3 font-medium">{p.name}</td>
                <td className="px-3 py-3 text-muted">{p.lastLabel}</td>
                <td className="px-3 py-3 text-muted">{p.totalKasten}×</td>
                <td className="px-3 py-3">
                  {p.open ? (
                    <span className="badge badge-green">🍺 hat einen offen</span>
                  ) : (
                    <span className="badge badge-gray">
                      ⏳ noch {p.cooldownRemainingDays} Tage Pause
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={4} className="px-5 sm:px-6 py-6 text-center text-muted">
                  {rows.length === 0 ? "Noch keine Spieler angelegt." : "Kein Spieler gefunden."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
