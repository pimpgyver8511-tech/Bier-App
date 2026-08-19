"use client";

import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleAssignmentFulfilledAction } from "@/lib/actions";

export type QueueRow = {
  playerId: string;
  name: string;
  lastLabel: string;
  totalKasten: number;
  pendingCount: number;
  pendingEntries: { id: string; reason: string }[];
  scheduledCount: number;
  nextScheduledLabel: string | null;
  open: boolean;
  cooldownRemainingDays: number | null;
};

export function PlayerQueueTable({ rows, admin }: { rows: QueueRow[]; admin: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [detailPlayerId, setDetailPlayerId] = useState<string | null>(null);
  const [resolvedIds, setResolvedIds] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((r) => r.name.toLowerCase().includes(term));
  }, [rows, search]);

  const detailPlayer = rows.find((r) => r.playerId === detailPlayerId) ?? null;
  const remainingEntries =
    detailPlayer?.pendingEntries.filter((e) => !resolvedIds.has(e.id)) ?? [];

  function markFulfilled(assignmentId: string) {
    setResolvedIds((prev) => new Set(prev).add(assignmentId));
    startTransition(async () => {
      await toggleAssignmentFulfilledAction(assignmentId, true);
      router.refresh();
    });
  }

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
                  <div className="flex flex-wrap items-center gap-1.5">
                    {p.cooldownRemainingDays !== null && (
                      <span className="badge badge-gray">
                        ⏳ noch {p.cooldownRemainingDays} Tage Pause
                      </span>
                    )}
                    {p.nextScheduledLabel && (
                      <span className="badge badge-blue">📅 {p.nextScheduledLabel}</span>
                    )}
                    {p.pendingCount > 0 && (
                      <button
                        type="button"
                        onClick={() => setDetailPlayerId(p.playerId)}
                        className="badge badge-gold border-0 font-sans cursor-pointer hover:brightness-95 transition underline decoration-dotted decoration-2 underline-offset-2"
                      >
                        🍺 {p.pendingCount}× ausstehend <span aria-hidden="true">ⓘ</span>
                      </button>
                    )}
                    {p.pendingCount === 0 && !p.nextScheduledLabel && p.open && (
                      <span className="badge badge-green">✅ Keinen Kasten offen aktuell</span>
                    )}
                  </div>
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
            {remainingEntries.length === 0 ? (
              <p className="text-sm text-muted">Keine offenen Kästen mehr.</p>
            ) : (
              <>
                <p className="text-sm text-muted">{remainingEntries.length}× ausstehend</p>
                <ul className="space-y-2">
                  {remainingEntries.map((entry) => (
                    <li key={entry.id} className="flex items-start justify-between gap-2 text-sm">
                      <span className="flex items-start gap-2">
                        <span>🍺</span>
                        <span>{entry.reason}</span>
                      </span>
                      {admin && (
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => markFulfilled(entry.id)}
                          className="badge badge-green border-0 font-sans cursor-pointer hover:brightness-95 transition shrink-0"
                        >
                          ✅ erledigt
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
