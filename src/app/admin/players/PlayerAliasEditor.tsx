"use client";

import { useState, useTransition } from "react";
import { updatePlayerAliasAction } from "@/lib/actions";

export function PlayerAliasEditor({
  playerId,
  alias,
}: {
  playerId: string;
  alias: string | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [value, setValue] = useState(alias ?? "");

  return (
    <input
      type="text"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => {
        const trimmed = value.trim();
        if (trimmed === (alias ?? "")) return;
        startTransition(() => {
          updatePlayerAliasAction(playerId, trimmed);
        });
      }}
      disabled={isPending}
      placeholder="Abweichender Name in Spielerplus (für CSV-Import)"
      className="input text-xs py-1 mt-0.5"
    />
  );
}
