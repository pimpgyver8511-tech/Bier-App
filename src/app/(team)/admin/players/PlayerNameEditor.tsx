"use client";

import { useState, useTransition } from "react";
import { renamePlayerAction } from "@/lib/actions";

export function PlayerNameEditor({ playerId, name }: { playerId: string; name: string }) {
  const [isPending, startTransition] = useTransition();
  const [value, setValue] = useState(name);

  return (
    <input
      type="text"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => {
        const trimmed = value.trim();
        if (!trimmed || trimmed === name) {
          setValue(name);
          return;
        }
        startTransition(() => {
          renamePlayerAction(playerId, trimmed);
        });
      }}
      disabled={isPending}
      className="input font-medium py-1.5"
    />
  );
}
