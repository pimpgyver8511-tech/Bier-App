"use client";

import { useState, useTransition } from "react";
import { getSuggestionAction, confirmAssignmentAction } from "@/lib/actions";
import type { AssignmentSuggestion } from "@/lib/kasten";

export function AssignmentPicker({ matchId }: { matchId: string }) {
  const [isPending, startTransition] = useTransition();
  const [suggestion, setSuggestion] = useState<AssignmentSuggestion | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  function loadSuggestion() {
    startTransition(async () => {
      const result = await getSuggestionAction(matchId);
      setSuggestion(result);
      setSelected(new Set(result.suggested.map((s) => s.playerId)));
    });
  }

  function toggle(playerId: string, attending: boolean) {
    if (!attending) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(playerId)) next.delete(playerId);
      else next.add(playerId);
      return next;
    });
  }

  function confirm() {
    startTransition(async () => {
      await confirmAssignmentAction(matchId, Array.from(selected), reason);
      setConfirmed(true);
    });
  }

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
        Cooldown: {suggestion.cooldownWeeks} Wochen · {suggestion.kastenPerMatch} Kästen pro Spiel.
        Vorausgewählt sind die anwesenden Spieler, die am längsten keinen Kasten mehr hatten. Ein
        Kasten kann nur Spielern zugeteilt werden, die für dieses Spiel zugesagt haben.
      </p>

      <div className="space-y-1.5">
        {suggestion.candidates.map((c) => (
          <label
            key={c.playerId}
            className={`flex items-center justify-between gap-3 px-3 py-2 rounded-lg border ${
              !c.attending ? "border-border opacity-40 cursor-not-allowed" : c.eligible ? "border-border" : "border-border opacity-50"
            } ${selected.has(c.playerId) ? "bg-brand-light border-brand" : "bg-white"}`}
          >
            <span className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={selected.has(c.playerId)}
                disabled={!c.attending}
                onChange={() => toggle(c.playerId, c.attending)}
                className="w-4 h-4"
              />
              <span className="font-medium">{c.name}</span>
            </span>
            <span className="text-xs text-muted text-right">
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
            </span>
          </label>
        ))}
      </div>

      <div>
        <label className="text-sm font-medium text-muted block mb-1">
          Begründung (optional, z. B. Geburtstag, verlorene Wette …)
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
        disabled={isPending || selected.size === 0}
        className="btn btn-primary"
      >
        Zuteilung bestätigen ({selected.size} ausgewählt)
      </button>
    </div>
  );
}
