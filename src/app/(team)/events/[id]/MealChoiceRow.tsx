"use client";

import { useMemo, useState, useTransition } from "react";
import { saveMealChoiceAction } from "@/lib/event-actions";
import type { MenuChoice } from "@/lib/menu";

type Participant = { id: string; name: string; dish: string | null; dishPrice: number | null; note: string | null };

const OTHER = "__other";

function euro(v: number) {
  return `${v.toFixed(2).replace(".", ",")} €`;
}

function DishSelect({
  value,
  onChange,
  groups,
  placeholder,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  groups: [string, MenuChoice[]][];
  placeholder: string;
  label: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-muted block mb-1">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="input">
        <option value="">{placeholder}</option>
        {groups.map(([section, items]) => (
          <optgroup key={section} label={section}>
            {items.map((c) => (
              <option key={c.label} value={c.label}>
                {c.label} – {euro(c.price)}
              </option>
            ))}
          </optgroup>
        ))}
        <option value={OTHER}>Etwas anderes (selbst eintragen)</option>
      </select>
    </label>
  );
}

export function MealChoiceRow({
  participant,
  choices,
  editable,
  removeButton,
}: {
  participant: Participant;
  choices: MenuChoice[];
  editable: boolean;
  removeButton?: React.ReactNode;
}) {
  const labels = useMemo(() => new Set(choices.map((c) => c.label)), [choices]);
  const groups = useMemo(() => {
    const map = new Map<string, MenuChoice[]>();
    for (const c of choices) map.set(c.section, [...(map.get(c.section) ?? []), c]);
    return Array.from(map);
  }, [choices]);

  const [first = "", second = ""] = participant.dish?.split(" + ") ?? [];
  const toSelect = (d: string) => (!d ? "" : labels.has(d) ? d : OTHER);

  const [open, setOpen] = useState(false);
  const [main, setMain] = useState(toSelect(first));
  const [mainOther, setMainOther] = useState(labels.has(first) ? "" : first);
  const [extra, setExtra] = useState(toSelect(second));
  const [extraOther, setExtraOther] = useState(labels.has(second) ? "" : second);
  const [note, setNote] = useState(participant.note ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const hasMenu = choices.length > 0;
  const mainValue = !hasMenu || main === OTHER ? mainOther : main;
  const extraValue = extra === OTHER ? extraOther : extra;

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await saveMealChoiceAction(participant.id, [mainValue, extraValue], note);
      if (result.ok) setOpen(false);
      else setError(result.message ?? "Speichern fehlgeschlagen.");
    });
  }

  return (
    <li className="px-4 sm:px-6 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium">{participant.name}</p>
          {participant.dish ? (
            <p className="text-sm mt-0.5">
              🍽️ {participant.dish}
              {participant.dishPrice ? <span className="text-muted"> · {euro(participant.dishPrice)}</span> : null}
            </p>
          ) : (
            <span className="badge badge-gold mt-1">noch nichts gewählt</span>
          )}
          {participant.note && <p className="text-xs text-muted mt-0.5">📝 {participant.note}</p>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {editable && !open && (
            <button type="button" onClick={() => setOpen(true)} className="btn btn-outline text-sm py-1.5">
              {participant.dish ? "Ändern" : "Essen wählen"}
            </button>
          )}
          {removeButton}
        </div>
      </div>

      {open && (
        <div className="mt-3 rounded-xl border border-border bg-background p-3 space-y-3">
          {hasMenu ? (
            <>
              <DishSelect value={main} onChange={setMain} groups={groups} placeholder="— Gericht wählen —" label="Gericht" />
              {main === OTHER && (
                <input
                  value={mainOther}
                  onChange={(e) => setMainOther(e.target.value)}
                  className="input"
                  placeholder="Was möchtest du essen?"
                  maxLength={120}
                />
              )}
              <DishSelect
                value={extra}
                onChange={setExtra}
                groups={groups}
                placeholder="— nichts weiter —"
                label="Dazu (optional, z. B. Vorspeise, Dessert, Extra)"
              />
              {extra === OTHER && (
                <input
                  value={extraOther}
                  onChange={(e) => setExtraOther(e.target.value)}
                  className="input"
                  placeholder="Was noch dazu?"
                  maxLength={120}
                />
              )}
            </>
          ) : (
            <label className="block">
              <span className="text-xs font-medium text-muted block mb-1">Gericht</span>
              <input
                value={mainOther}
                onChange={(e) => setMainOther(e.target.value)}
                className="input"
                placeholder="Was möchtest du essen?"
                maxLength={120}
              />
            </label>
          )}
          <label className="block">
            <span className="text-xs font-medium text-muted block mb-1">Anmerkung (optional)</span>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="input"
              placeholder="z. B. ohne Zwiebeln, vegetarisch, Allergie …"
              maxLength={200}
            />
          </label>
          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={save} disabled={isPending} className="btn btn-primary">
              {isPending ? "Speichere…" : "Speichern"}
            </button>
            <button type="button" onClick={() => setOpen(false)} disabled={isPending} className="btn btn-outline">
              Abbrechen
            </button>
          </div>
        </div>
      )}
    </li>
  );
}
