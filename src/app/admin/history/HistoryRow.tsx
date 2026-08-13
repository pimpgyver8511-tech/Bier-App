"use client";

import { useState, useTransition } from "react";
import { toggleAssignmentFulfilledAction, updateAssignmentReasonAction } from "@/lib/actions";

export function HistoryRow({
  id,
  playerName,
  matchDate,
  reason: initialReason,
  fulfilled: initialFulfilled,
}: {
  id: string;
  playerName: string;
  matchDate: string;
  reason: string;
  fulfilled: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [reason, setReason] = useState(initialReason);
  const [fulfilled, setFulfilled] = useState(initialFulfilled);

  return (
    <tr className="border-b border-border last:border-0 align-top">
      <td className="px-5 sm:px-6 py-3 whitespace-nowrap">{matchDate}</td>
      <td className="px-3 py-3 font-medium whitespace-nowrap">{playerName}</td>
      <td className="px-3 py-3">
        <input
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          onBlur={() =>
            startTransition(() => {
              updateAssignmentReasonAction(id, reason);
            })
          }
          placeholder="Begründung eintragen…"
          className="input text-sm"
          disabled={isPending}
        />
      </td>
      <td className="px-3 py-3">
        <button
          type="button"
          disabled={isPending}
          onClick={() =>
            startTransition(() => {
              const next = !fulfilled;
              setFulfilled(next);
              toggleAssignmentFulfilledAction(id, next);
            })
          }
          className={`badge ${fulfilled ? "badge-green" : "badge-gold"}`}
        >
          {fulfilled ? "✅ erledigt" : "🍺 ausstehend"}
        </button>
      </td>
    </tr>
  );
}
