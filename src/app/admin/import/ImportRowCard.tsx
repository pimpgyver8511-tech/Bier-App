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
  const [reason, setReason] = useState(initialReason);
  const [count, setCount] = useState(initialCount);
  const [error, setError] = useState<string | null>(null);

  const resolved = Boolean(suggestedPlayerId);

  function confirm() {
    if (!playerId) {
      setError("Bitte einen Spieler auswählen.");
      return;
    }
    setError(null);
    startTransition(async () => {
      await confirmImportRowAction(id, playerId, reason, count);
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

      <div className="grid sm:grid-cols-[1fr_auto] gap-3">
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
          <label className="text-xs font-medium text-muted block mb-1">Anzahl</label>
          <input
            type="number"
            min={1}
            max={10}
            className="input w-20"
            value={count}
            onChange={(e) => setCount(Number(e.target.value) || 1)}
            disabled={isPending}
          />
        </div>
      </div>

      <div>
        <label className="text-xs font-medium text-muted block mb-1">Begründung</label>
        <input
          type="text"
          className="input"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          disabled={isPending}
        />
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={confirm}
          disabled={isPending}
          className="btn btn-primary text-sm"
        >
          Übernehmen
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
