"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { saveMealChoiceAction } from "@/lib/event-actions";
import type { MenuChoice } from "@/lib/menu";

type Participant = {
  id: string;
  name: string;
  dish: string | null;
  note: string | null;
};

const OTHER = "__other";

/** Beilagen/Beschreibung von der Karte, z. B. "hausgemachtes Rotkraut | Klöße". */
function DishDescription({ text }: { text: string | null | undefined }) {
  if (!text) return null;
  return <p className="text-xs text-muted mt-1 leading-snug">↳ {text}</p>;
}

function euro(v: number) {
  return `${v.toFixed(2).replace(".", ",")} €`;
}

/**
 * Eigene Auswahlliste statt <select>: ein natives Auswahlfeld kann pro
 * Eintrag nur eine Zeile zeigen - hier stehen zu jedem Gericht Preis,
 * Beilagen/Beschreibung und Allergene, dazu eine Suche.
 */
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
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node))
        setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const q = query.trim().toLowerCase();
  const filtered = groups
    .map(
      ([section, items]) =>
        [
          section,
          q
            ? items.filter((c) =>
                `${c.label} ${c.description ?? ""} ${section}`
                  .toLowerCase()
                  .includes(q),
              )
            : items,
        ] as [string, MenuChoice[]],
    )
    .filter(([, items]) => items.length > 0);

  const selected = groups
    .flatMap(([, items]) => items)
    .find((c) => c.label === value);
  const buttonText =
    value === OTHER
      ? "Etwas anderes (selbst eintragen)"
      : selected
        ? `${selected.label} – ${euro(selected.price)}`
        : placeholder;

  function choose(v: string) {
    onChange(v);
    setOpen(false);
    setQuery("");
  }

  const optionClass = (active: boolean) =>
    `w-full text-left px-3 py-2.5 rounded-lg transition ${active ? "bg-brand-light ring-1 ring-brand" : "hover:bg-brand-light"}`;

  return (
    <div ref={rootRef} className="relative">
      <span className="text-xs font-medium text-muted block mb-1">{label}</span>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={listId}
        className="input flex items-center justify-between gap-2 text-left"
      >
        <span className={`truncate ${value ? "" : "text-muted"}`}>
          {buttonText}
        </span>
        <span aria-hidden className="text-muted shrink-0">
          {open ? "▲" : "▼"}
        </span>
      </button>

      {open && (
        <div
          id={listId}
          className="absolute z-30 left-0 right-0 mt-1 rounded-xl border border-border bg-surface shadow-lg overflow-hidden"
        >
          <div className="p-2 border-b border-border">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Suchen, z. B. Schnitzel, vegetarisch …"
              className="input"
            />
          </div>
          <div role="listbox" className="max-h-[60vh] overflow-y-auto p-1.5">
            {!q && (
              <button
                type="button"
                role="option"
                aria-selected={!value}
                onClick={() => choose("")}
                className={optionClass(!value)}
              >
                <span className="text-muted">{placeholder}</span>
              </button>
            )}
            {filtered.map(([section, items]) => (
              <div key={section}>
                <p className="sticky top-0 z-10 bg-surface px-3 pt-3 pb-1 text-xs font-bold uppercase tracking-wide text-brand-dark">
                  {section}
                </p>
                {items.map((c) => (
                  <button
                    key={c.label}
                    type="button"
                    role="option"
                    aria-selected={c.label === value}
                    onClick={() => choose(c.label)}
                    className={optionClass(c.label === value)}
                  >
                    <span className="flex items-start justify-between gap-3">
                      <span className="font-medium">{c.label}</span>
                      <span className="font-semibold text-brand-dark whitespace-nowrap">
                        {euro(c.price)}
                      </span>
                    </span>
                    {c.description && (
                      <span className="block text-xs text-muted mt-0.5 leading-snug">
                        {c.description}
                      </span>
                    )}
                    {c.allergens && (
                      <span className="block text-[11px] text-muted/80 mt-0.5">
                        Allergene/Zusatzstoffe: {c.allergens}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            ))}
            {filtered.length === 0 && (
              <p className="px-3 py-3 text-sm text-muted">Nichts gefunden.</p>
            )}
            <div className="border-t border-border mt-1.5 pt-1.5">
              <button
                type="button"
                role="option"
                aria-selected={value === OTHER}
                onClick={() => choose(OTHER)}
                className={optionClass(value === OTHER)}
              >
                ✏️ Etwas anderes (selbst eintragen)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
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
  const descriptionOf = useMemo(() => {
    const map = new Map(choices.map((c) => [c.label, c.description]));
    return (label: string) => map.get(label) ?? null;
  }, [choices]);
  const groups = useMemo(() => {
    const map = new Map<string, MenuChoice[]>();
    for (const c of choices)
      map.set(c.section, [...(map.get(c.section) ?? []), c]);
    return Array.from(map);
  }, [choices]);

  const [first = "", second = ""] = participant.dish?.split(" + ") ?? [];
  const toSelect = (d: string) => (!d ? "" : labels.has(d) ? d : OTHER);

  const [open, setOpen] = useState(false);
  const [main, setMain] = useState(toSelect(first));
  const [mainOther, setMainOther] = useState(labels.has(first) ? "" : first);
  const [extra, setExtra] = useState(toSelect(second));
  const [extraOther, setExtraOther] = useState(
    labels.has(second) ? "" : second,
  );
  const [note, setNote] = useState(participant.note ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const hasMenu = choices.length > 0;
  const mainValue = !hasMenu || main === OTHER ? mainOther : main;
  const extraValue = extra === OTHER ? extraOther : extra;

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await saveMealChoiceAction(
        participant.id,
        [mainValue, extraValue],
        note,
      );
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
            <div className="mt-0.5">
              {participant.dish.split(" + ").map((part) => (
                <div key={part}>
                  <p className="text-sm">🍽️ {part}</p>
                  {descriptionOf(part) && (
                    <p className="text-xs text-muted leading-snug pl-6">
                      {descriptionOf(part)}
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <span className="badge badge-gold mt-1">noch nichts gewählt</span>
          )}
          {participant.note && (
            <p className="text-xs mt-1 rounded-md bg-[#fbeed2] text-gold-dark px-2 py-1 inline-block">
              ✏️ {participant.note}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {editable && !open && (
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="btn btn-outline text-sm py-1.5"
            >
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
              <div>
                <DishSelect
                  value={main}
                  onChange={setMain}
                  groups={groups}
                  placeholder="— Gericht wählen —"
                  label="Gericht"
                />
                <DishDescription text={descriptionOf(main)} />
              </div>
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
              <DishDescription text={descriptionOf(extra)} />
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
              <span className="text-xs font-medium text-muted block mb-1">
                Gericht
              </span>
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
            <span className="text-sm font-semibold block mb-0.5">
              ✏️ Änderungen &amp; Sonderwünsche (optional)
            </span>
            <span className="text-xs text-muted block mb-1">
              Freitext fürs Restaurant, z. B. andere Beilage, ohne Zutat, Soße
              extra, Allergie
            </span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="input min-h-[4.5rem] resize-y"
              rows={3}
              placeholder="z. B. Bratkartoffeln statt Pommes, ohne Zwiebeln, Soße extra …"
              maxLength={300}
            />
            <span className="text-[11px] text-muted block mt-0.5 text-right">
              {note.length}/300
            </span>
          </label>
          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={save}
              disabled={isPending}
              className="btn btn-primary"
            >
              {isPending ? "Speichere…" : "Speichern"}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={isPending}
              className="btn btn-outline"
            >
              Abbrechen
            </button>
          </div>
        </div>
      )}
    </li>
  );
}
