"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { syncBeerDealsAction } from "@/lib/actions";

export function BeerDealsSyncButton() {
  const router = useRouter();
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
            const result = await syncBeerDealsAction();
            setOk(result.ok);
            setMessage(result.message);
            router.refresh();
          })
        }
        className="btn btn-outline text-xs px-2.5 py-1"
      >
        {isPending ? "Aktualisiere…" : "🔄 Jetzt aktualisieren"}
      </button>
      {message && (
        <p className={`text-xs ${ok ? "text-brand-dark" : "text-danger"}`}>{message}</p>
      )}
    </div>
  );
}
