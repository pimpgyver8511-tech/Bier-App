"use client";

import { useRef, useState, useTransition } from "react";
import { importIcsFileAction } from "@/lib/actions";

/**
 * Spielerplus blockt den automatischen Kalender-Abruf vom Server (Cloudflare,
 * HTTP 403). Im eigenen Browser klappt der Download weiterhin - die Datei
 * wird dann hier hochgeladen und genauso verarbeitet wie der Abruf per URL.
 */
export function IcsFileUpload({ icsUrl }: { icsUrl: string | null }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [ok, setOk] = useState<boolean | null>(null);

  function upload(file: File) {
    const formData = new FormData();
    formData.append("file", file);
    startTransition(async () => {
      setMessage(null);
      const result = await importIcsFileAction(formData);
      setOk(result.ok);
      setMessage(result.message);
      if (fileRef.current) fileRef.current.value = "";
    });
  }

  return (
    <div className="rounded-xl border border-border bg-background p-4 space-y-3 max-w-lg">
      <p className="text-sm font-semibold">Kalender-Datei hochladen (falls der Abruf mit HTTP 403 scheitert)</p>
      <ol className="text-sm text-muted list-decimal pl-5 space-y-1">
        <li>
          {icsUrl ? (
            <a href={icsUrl} target="_blank" rel="noopener noreferrer" className="underline text-foreground">
              Kalender-Datei herunterladen
            </a>
          ) : (
            "Den Spielerplus-Kalender-Link im Browser öffnen"
          )}{" "}
          – am besten am Computer, die Datei landet in „Downloads“.
        </li>
        <li>Die heruntergeladene .ics-Datei hier auswählen.</li>
      </ol>
      <button
        type="button"
        disabled={isPending}
        onClick={() => fileRef.current?.click()}
        className="btn btn-outline text-sm"
      >
        {isPending ? "Verarbeite…" : "📅 .ics-Datei auswählen"}
      </button>
      <input
        ref={fileRef}
        type="file"
        accept=".ics,text/calendar"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) upload(file);
        }}
      />
      {message && <p className={`text-sm ${ok ? "text-brand-dark" : "text-danger"}`}>{message}</p>}
    </div>
  );
}
