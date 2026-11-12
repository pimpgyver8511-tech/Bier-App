"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { loadImportRowsAction } from "@/lib/actions";

export function LoadImportButton({ label = "Rohdaten laden" }: { label?: string }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          await loadImportRowsAction();
          router.refresh();
        })
      }
      className="btn btn-primary text-sm"
    >
      {isPending ? "Lädt…" : label}
    </button>
  );
}
