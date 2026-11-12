"use client";

import { useState, useTransition } from "react";
import { addManualKastenAction } from "@/lib/actions";

export function AddKastenForm({ playerId }: { playerId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [isPending, startTransition] = useTransition();

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-brand font-semibold text-sm hover:underline shrink-0"
        title="Kasten hinzufügen"
      >
        + Kasten
      </button>
    );
  }

  function submit() {
    startTransition(async () => {
      await addManualKastenAction(playerId, reason);
      setReason("");
      setOpen(false);
    });
  }

  return (
    <div className="flex items-center gap-1.5">
      <input
        type="text"
        autoFocus
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
          if (e.key === "Escape") setOpen(false);
        }}
        placeholder="Begründung (optional)"
        className="input text-sm w-48"
        disabled={isPending}
      />
      <button
        type="button"
        onClick={submit}
        disabled={isPending}
        className="btn btn-primary text-xs px-2.5 py-1"
      >
        Hinzufügen
      </button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        disabled={isPending}
        className="text-muted text-sm px-1"
      >
        ✕
      </button>
    </div>
  );
}
