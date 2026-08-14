"use client";

import { useRef, useState, useTransition } from "react";
import { importAttendanceCsvAction } from "@/lib/actions";

export function AttendanceCsvImport({ matchId }: { matchId: string }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [ok, setOk] = useState<boolean | null>(null);

  function handleChange() {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    startTransition(async () => {
      setMessage(null);
      const result = await importAttendanceCsvAction(matchId, formData);
      setOk(result.ok);
      setMessage(result.message);
      if (fileRef.current) fileRef.current.value = "";
    });
  }

  return (
    <div className="flex flex-col items-end gap-1.5 max-w-xs">
      <label className="text-xs font-medium text-muted">
        Zusagen-CSV importieren (Spielerplus-Export)
      </label>
      <input
        ref={fileRef}
        type="file"
        accept=".csv"
        disabled={isPending}
        onChange={handleChange}
        className="text-xs"
      />
      {message && (
        <p className={`text-xs text-right ${ok ? "text-brand-dark" : "text-danger"}`}>{message}</p>
      )}
    </div>
  );
}
