"use client";

import { useState, useMemo } from "react";

export type QueueRow = {
  playerId: string;
  name: string;
  lastLabel: string;
  totalKasten: number;
  pendingCount: number;
  pendingReasons: string[];
  scheduledCount: number;
  nextScheduledLabel: string | null;
  open: boolean;
  cooldownRemainingDays: number | null;
};

export function PlayerQueueTable({ rows }: { rows: QueueRow[] }) {
  const [search, setSearch] = useState("");
  const [detailPlayerId, setDetailPlayerId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((r) => r.name.toLowerCase().includes(term));
  }, [rows, search]);

  const detailPlayer = rows.find((r) => r.playerId === detailPlayerId) ?? null;

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
              <th className="px-3 py-2.5 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.playerId} className="border-b border-border last:border-0">
                <td className="px-5 sm:px-6 py-3 font-medium">{p.name}</td>
                <td className="px-3 py-3 text-muted">{p.lastLabel}</td>
                <td className="px-3 py-3">
                  {p.pendingCount > 0 ? (
                    <button
                      type="button"
                      onClick={() => setDetailPlayerId(p.playerId)}
                      className="badge badge-gold border-0 font-sans cursor-pointer hover:brightness-95 transition underline decoration-dotted decoration-2 underline-offset-2"
                    >
                      🍺 {p.pendingCount}× ausstehend <span aria-hidden="true">ⓘ</span>
                    </button>
                  ) : p.nextScheduledLabel ? (
                    <span className="badge badge-blue">📅 {p.nextScheduledLabel}</span>
                  ) : p.open ? (
                    <span className="badge badge-green">✅ Keinen Kasten offen aktuell</span>
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
                <td colSpan={3} className="px-5 sm:px-6 py-6 text-center text-muted">
                  {rows.length === 0 ? "Noch keine Spieler angelegt." : "Kein Spieler gefunden."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {detailPlayer && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setDetailPlayerId(null)}
        >
          <div
            className="card w-full max-w-sm p-5 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-bold">{detailPlayer.name}</h3>
              <button
                type="button"
                onClick={() => setDetailPlayerId(null)}
                className="text-muted hover:text-foreground text-lg leading-none"
                aria-label="Schließen"
              >
                ✕
              </button>
            </div>
            <p className="text-sm text-muted">
              {detailPlayer.pendingCount}× ausstehend
            </p>
            <ul className="space-y-2">
              {detailPlayer.pendingReasons.map((reason, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span>🍺</span>
                  <span>{reason}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
