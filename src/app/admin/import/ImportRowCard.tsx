"use client";

import { useState, useTransition } from "react";
import { confirmImportRowAction, ignoreImportRowAction } from "@/lib/actions";

type Player = { id: string; name: string };

export function ImportRowCard({
  id,
  dateLabel,
  nickname,
  reason: initialReason,
  count: initialCount,
  suggestedPlayerId,
  players,
  onDone,
}: {
  id: string;
  dateLabel: string | null;
  nickname: string;
  reason: string;
  count: number;
  suggestedPlayerId: string | null;
  players: Player[];
  onDone: (id: string) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [playerId, setPlayerId] = useState(suggestedPlayerId ?? "");
  // Jede Zeile = ein eigener Kasten mit eigener Begruendung. Anzahl der
  // nicht-leeren Zeilen bestimmt, wie viele KastenAssignment-Eintraege
  // entstehen - so lassen sich zusammengeschriebene Mehrfach-Kaesten
  // (z.B. "X Kasten, Y Kasten, Z Kasten") sauber auf mehrere Zeilen
  // aufteilen statt sie mit einer gemeinsamen Begruendung zu buendeln.
  const [reasonLines, setReasonLines] = useState<string[]>(
    initialCount > 1
      ? Array.from({ length: initialCount }, (_, i) => (i === 0 ? initialReason : ""))
      : [initialReason]
  );
  const [error, setError] = useState<string | null>(null);

  const resolved = Boolean(suggestedPlayerId);
  const filledCount = reasonLines.filter((r) => r.trim()).length || 1;

  function updateLine(index: number, value: string) {
    setReasonLines((prev) => prev.map((r, i) => (i === index ? value : r)));
  }

  function addLine() {
    setReasonLines((prev) => [...prev, ""]);
  }

  function removeLine(index: number) {
    setReasonLines((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
  }

  function splitByCommas() {
    const merged = reasonLines.join(", ");
    const parts = merged
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
    setReasonLines(parts.length > 0 ? parts : [""]);
  }

  function confirm() {
    if (!playerId) {
      setError("Bitte einen Spieler auswählen.");
      return;
    }
    setError(null);
    startTransition(async () => {
      await confirmImportRowAction(id, playerId, reasonLines);
      onDone(id);
    });
  }

  function ignore() {
    startTransition(async () => {
      await ignoreImportRowAction(id);
      onDone(id);
    });
  }

  return (
    <div
      className={`card p-4 space-y-3 ${resolved ? "border-brand" : "border-gold"}`}
    >
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          {dateLabel && <span className="badge badge-gray">{dateLabel}</span>}
          <span className="font-semibold">„{nickname}&rdquo;</span>
        </div>
        {!resolved && <span className="badge badge-gold">❓ ungeklärt</span>}
      </div>

      <div>
        <label className="text-xs font-medium text-muted block mb-1">Spieler</label>
        <select
          className="input"
          value={playerId}
          onChange={(e) => setPlayerId(e.target.value)}
          disabled={isPending}
        >
          <option value="">— auswählen —</option>
          {players.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs font-medium text-muted">
            Begründung(en) – 1 Zeile = 1 Kasten ({filledCount}×)
          </label>
          {reasonLines.length === 1 && reasonLines[0].includes(",") && (
            <button
              type="button"
              onClick={splitByCommas}
              disabled={isPending}
              className="text-xs text-brand font-semibold hover:underline"
            >
              bei Kommas aufteilen
            </button>
          )}
        </div>
        <div className="space-y-1.5">
          {reasonLines.map((line, i) => (
            <div key={i} className="flex gap-1.5">
              <input
                type="text"
                className="input"
                value={line}
                placeholder={`Begründung Kasten ${i + 1} (optional)`}
                onChange={(e) => updateLine(i, e.target.value)}
                disabled={isPending}
              />
              {reasonLines.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeLine(i)}
                  disabled={isPending}
                  className="btn btn-outline text-xs px-2.5"
                  aria-label="Zeile entfernen"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addLine}
          disabled={isPending}
          className="text-xs text-brand font-semibold hover:underline mt-1.5"
        >
          + weiteren Kasten hinzufügen
        </button>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={confirm}
          disabled={isPending}
          className="btn btn-primary text-sm"
        >
          Übernehmen ({filledCount}×)
        </button>
        <button
          type="button"
          onClick={ignore}
          disabled={isPending}
          className="btn btn-outline text-sm"
        >
          Ignorieren
        </button>
      </div>
    </div>
  );
}
