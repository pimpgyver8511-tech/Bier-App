"use client";

import { useState, useTransition } from "react";
import { addManualKastenAction } from "@/lib/actions";

type Player = { id: string; name: string };

export function AddKastenForNewPlayer({ players }: { players: Player[] }) {
  const [playerId, setPlayerId] = useState("");
  const [reason, setReason] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit() {
    if (!playerId) {
      setError("Bitte einen Spieler auswählen.");
      return;
    }
    setError(null);
    startTransition(async () => {
      await addManualKastenAction(playerId, reason);
      setPlayerId("");
      setReason("");
    });
  }

  return (
    <div className="card p-4 space-y-2">
      <p className="text-sm font-semibold">Kasten für (noch) unbekannten Spieler hinzufügen</p>
      <div className="flex flex-wrap gap-2">
        <select
          className="input flex-1 min-w-[180px]"
          value={playerId}
          onChange={(e) => setPlayerId(e.target.value)}
          disabled={isPending}
        >
          <option value="">— Spieler auswählen —</option>
          {players.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <input
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Begründung (optional)"
          className="input flex-1 min-w-[180px]"
          disabled={isPending}
        />
        <button
          type="button"
          onClick={submit}
          disabled={isPending}
          className="btn btn-primary text-sm"
        >
          Hinzufügen
        </button>
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
