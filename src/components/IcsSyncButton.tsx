"use client";

import { useState, useTransition } from "react";
import { syncMatchScheduleAction } from "@/lib/actions";

export function IcsSyncButton() {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [ok, setOk] = useState<boolean | null>(null);

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            setMessage(null);
            const result = await syncMatchScheduleAction();
            setOk(result.ok);
            setMessage(result.message);
          })
        }
        className="btn btn-outline text-sm"
      >
        {isPending ? "Synchronisiere…" : "🔄 Spielplan jetzt synchronisieren"}
      </button>
      {message && (
        <p className={`text-sm ${ok ? "text-brand-dark" : "text-danger"}`}>{message}</p>
      )}
    </div>
  );
}
