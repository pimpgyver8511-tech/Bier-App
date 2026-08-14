"use client";

import { useTransition } from "react";
import { setAttendanceAction } from "@/lib/actions";

type Status = "ZUSAGE" | "ABSAGE" | "UNSICHER" | "UNKNOWN";

const OPTIONS: { value: Status; label: string; activeClass: string }[] = [
  { value: "ZUSAGE", label: "Zusage", activeClass: "bg-brand text-white border-brand" },
  { value: "ABSAGE", label: "Absage", activeClass: "bg-danger text-white border-danger" },
  { value: "UNSICHER", label: "Unsicher", activeClass: "bg-gold text-[#3a2404] border-gold" },
  { value: "UNKNOWN", label: "Offen", activeClass: "bg-gray-200 text-foreground border-gray-300" },
];

export function AttendanceRow({
  matchId,
  playerId,
  playerName,
  status,
  source,
}: {
  matchId: string;
  playerId: string;
  playerName: string;
  status: Status;
  source: string;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <tr className="border-b border-border last:border-0">
      <td className="px-5 sm:px-6 py-2.5 font-medium">
        {playerName}
        {source === "SPIELERPLUS" && (
          <span className="ml-2 text-[10px] uppercase tracking-wide text-muted">via Spielerplus</span>
        )}
      </td>
      <td className="px-3 py-2.5">
        <div className="inline-flex rounded-lg border border-border overflow-hidden text-xs">
          {OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              disabled={isPending}
              onClick={() =>
                startTransition(() => {
                  setAttendanceAction(matchId, playerId, opt.value);
                })
              }
              className={`px-2.5 py-1.5 border-r last:border-r-0 border-border transition ${
                status === opt.value ? opt.activeClass : "bg-white hover:bg-brand-light"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </td>
    </tr>
  );
}
