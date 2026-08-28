"use client";

import { useState, useTransition } from "react";
import { getSuggestionAction, confirmAssignmentAction } from "@/lib/actions";
import type { AssignmentSuggestion } from "@/lib/kasten";

export function AssignmentPicker({ matchId }: { matchId: string }) {
  const [isPending, startTransition] = useTransition();
  const [suggestion, setSuggestion] = useState<AssignmentSuggestion | null>(null);
  // Map statt Set, damit ein Spieler mit mehreren wirklich offenen Kaesten
  // (z.B. 3 offen) gleich mehrere davon auf einmal diesem Spiel zuordnen
  // kann, statt nur einen pro Zuteilung - Wert ist die gewuenschte Anzahl.
  const [counts, setCounts] = useState<Map<string, number>>(new Map());
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  function loadSuggestion() {
    startTransition(async () => {
      const result = await getSuggestionAction(matchId);
      setSuggestion(result);
      setCounts(new Map(result.suggested.map((s) => [s.playerId, 1])));
    });
  }

  function toggle(playerId: string, attending: boolean) {
    if (!attending) return;
    setCounts((prev) => {
      const next = new Map(prev);
      if (next.has(playerId)) next.delete(playerId);
      else next.set(playerId, 1);
      return next;
    });
  }

  function setCount(playerId: string, count: number) {
    setCounts((prev) => {
      const next = new Map(prev);
      next.set(playerId, Math.max(1, Math.floor(count) || 1));
      return next;
    });
  }

  function confirm() {
    startTransition(async () => {
      await confirmAssignmentAction(matchId, Object.fromEntries(counts), reason);
      setConfirmed(true);
    });
  }

  const totalKaesten = Array.from(counts.values()).reduce((sum, n) => sum + n, 0);

  if (confirmed) {
    return (
      <p className="text-sm text-brand-dark font-medium">
        ✅ Zuteilung gespeichert. Seite neu laden, um sie oben zu sehen.
      </p>
    );
  }

  if (!suggestion) {
    return (
      <button type="button" onClick={loadSuggestion} disabled={isPending} className="btn btn-gold">
        🍺 Kasten Zuweisung
      </button>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        Vorausgewählt sind die anwesenden Spieler mit mindestens einem offenen Kasten, die am
        längsten keinen Kasten mehr gebracht haben ({suggestion.kastenPerMatch} Vorschläge). Ein
        Kasten kann nur Spielern zugeteilt werden, die für dieses Spiel zugesagt haben.
      </p>

      <div className="space-y-1.5">
        {suggestion.candidates.map((c) => (
          <label
            key={c.playerId}
            className={`flex items-center justify-between gap-3 px-3 py-2 rounded-lg border ${
              !c.attending ? "border-border opacity-40 cursor-not-allowed" : c.eligible ? "border-border" : "border-border opacity-50"
            } ${counts.has(c.playerId) ? "bg-brand-light border-brand" : "bg-white"}`}
          >
            <span className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={counts.has(c.playerId)}
                disabled={!c.attending}
                onChange={() => toggle(c.playerId, c.attending)}
                className="w-4 h-4"
              />
              <span className="font-medium">{c.name}</span>
              {c.pendingCount > 1 && (
                <span className="text-xs text-muted">({c.pendingCount} offen)</span>
              )}
            </span>
            <span className="flex items-center gap-2 text-xs text-muted text-right">
              {c.reasonBlocked ? (
                <span className="badge badge-gray">{c.reasonBlocked}</span>
              ) : (
                <span className="badge badge-green">
                  {c.daysSinceLast === null
                    ? "noch nie"
                    : c.daysSinceLast >= 0
                      ? `vor ${c.daysSinceLast} Tagen`
                      : "kürzlich zugeteilt"}
                </span>
              )}
              {counts.has(c.playerId) && c.pendingCount > 1 && (
                <input
                  type="number"
                  min={1}
                  value={counts.get(c.playerId)}
                  onChange={(e) => setCount(c.playerId, Number(e.target.value))}
                  title={`Anzahl Kästen, die ${c.name} zu diesem Spiel mitbringt`}
                  className="input w-14 py-0.5 px-1.5 text-center"
                />
              )}
            </span>
          </label>
        ))}
      </div>

      <div>
        <label className="text-sm font-medium text-muted block mb-1">
          Begründung (nur relevant, falls ein Spieler ohne bestehenden offenen Kasten
          ausgewählt wird und dadurch neu einen bekommt)
        </label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="input"
          rows={2}
        />
      </div>

      <button
        type="button"
        onClick={confirm}
        disabled={isPending || counts.size === 0}
        className="btn btn-primary"
      >
        Zuteilung bestätigen ({totalKaesten} {totalKaesten === 1 ? "Kasten" : "Kästen"} für{" "}
        {counts.size} Spieler)
      </button>
    </div>
  );
}
