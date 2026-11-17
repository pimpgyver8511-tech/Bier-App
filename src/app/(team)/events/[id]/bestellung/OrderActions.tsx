"use client";

import { useState } from "react";

export function OrderActions({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-wrap gap-2 print:hidden">
      <button
        type="button"
        className="btn btn-primary"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2500);
          } catch {
            window.prompt("Text kopieren:", text);
          }
        }}
      >
        {copied ? "✅ Kopiert" : "📋 Als Text kopieren (E-Mail/WhatsApp)"}
      </button>
      <button type="button" className="btn btn-outline" onClick={() => window.print()}>
        🖨️ Drucken / als PDF speichern
      </button>
    </div>
  );
}
