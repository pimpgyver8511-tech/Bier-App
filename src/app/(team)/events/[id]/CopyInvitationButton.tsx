"use client";

import { useState } from "react";

/** Kopiert die Einladung inkl. Link zur Event-Seite, z. B. fuer die WhatsApp-Gruppe. */
export function CopyInvitationButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="btn btn-outline text-sm"
      onClick={async () => {
        const full = `${text}\n\n👉 ${window.location.href}`;
        try {
          await navigator.clipboard.writeText(full);
          setCopied(true);
          setTimeout(() => setCopied(false), 2500);
        } catch {
          window.prompt("Text kopieren:", full);
        }
      }}
    >
      {copied ? "✅ Kopiert" : "📋 Einladung + Link kopieren (WhatsApp)"}
    </button>
  );
}
