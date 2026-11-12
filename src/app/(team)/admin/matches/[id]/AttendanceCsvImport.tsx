"use client";

import { useRef, useState, useTransition } from "react";
import { importAttendanceCsvAction } from "@/lib/actions";

export function AttendanceCsvImport({ matchId }: { matchId: string }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [ok, setOk] = useState<boolean | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  function upload(file: File) {
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
    <div className="w-full sm:max-w-xs space-y-1.5">
      <p className="text-xs font-medium text-muted">Zusagen-CSV importieren (Spielerplus-Export)</p>
      <div
        role="button"
        tabIndex={0}
        onClick={() => fileRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") fileRef.current?.click();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragOver(false);
          const file = e.dataTransfer.files?.[0];
          if (file) upload(file);
        }}
        className={`flex flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed px-4 py-6 text-center cursor-pointer transition ${
          isDragOver ? "border-brand bg-brand-light" : "border-border hover:bg-brand-light"
        } ${isPending ? "opacity-60 pointer-events-none" : ""}`}
      >
        <span className="text-2xl">📄</span>
        <span className="text-sm font-medium">
          {isPending ? "Importiere…" : "CSV hierher ziehen oder tippen zum Auswählen"}
        </span>
        <input
          ref={fileRef}
          type="file"
          accept=".csv"
          disabled={isPending}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) upload(file);
          }}
          className="hidden"
        />
      </div>
      {message && (
        <p className={`text-xs ${ok ? "text-brand-dark" : "text-danger"}`}>{message}</p>
      )}
    </div>
  );
}
