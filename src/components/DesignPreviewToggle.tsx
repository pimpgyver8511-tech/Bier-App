"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setDesignPreviewAction } from "@/lib/actions";

/**
 * Nur fuer den Admin sichtbar (Aufrufer entscheidet, ob gerendert wird) -
 * schaltet die "Kabine"-Optik-Vorschau nur fuer die eigene Session per
 * Cookie an/aus, siehe setDesignPreview() in lib/auth.ts. Andere Nutzer
 * sehen davon nichts.
 */
export function DesignPreviewToggle({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          await setDesignPreviewAction(!enabled);
          router.refresh();
        })
      }
      className="btn btn-outline text-xs px-2.5 py-1"
      title="Nur für dich als Admin sichtbar – ändert nichts für andere Nutzer"
    >
      {enabled ? "🎨 Kabine-Vorschau: An" : "🎨 Kabine-Vorschau ausprobieren"}
    </button>
  );
}
