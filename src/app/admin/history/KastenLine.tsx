"use client";

import { useState, useTransition } from "react";
import {
  toggleAssignmentFulfilledAction,
  updateAssignmentReasonAction,
  deleteAssignmentAction,
} from "@/lib/actions";

export function KastenLine({
  id,
  dateLabel,
  reason: initialReason,
  fulfilled: initialFulfilled,
}: {
  id: string;
  dateLabel: string;
  reason: string;
  fulfilled: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [reason, setReason] = useState(initialReason);
  const [fulfilled, setFulfilled] = useState(initialFulfilled);
  const [removed, setRemoved] = useState(false);

  if (removed) return null;

  return (
    <div className="flex items-center gap-2 py-1.5 border-b border-border last:border-0">
      <span className="text-xs text-muted whitespace-nowrap w-28 shrink-0">{dateLabel}</span>
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
        className="input text-sm flex-1"
        disabled={isPending}
      />
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
        className={`badge shrink-0 ${fulfilled ? "badge-green" : "badge-gold"}`}
      >
        {fulfilled ? "✅ erledigt" : "🍺 ausstehend"}
      </button>
      <button
        type="button"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            await deleteAssignmentAction(id);
            setRemoved(true);
          })
        }
        className="text-muted hover:text-danger text-sm px-1 shrink-0"
        aria-label="Löschen"
        title="Löschen"
      >
        ✕
      </button>
    </div>
  );
}
