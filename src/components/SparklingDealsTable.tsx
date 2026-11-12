"use client";

import { useMemo, useState } from "react";
import type { SparklingDeal } from "@/lib/sparklingdeals";

function mapsUrl(store: string) {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${store} Leipzig`)}`;
}

export function SparklingDealsTable({ deals }: { deals: SparklingDeal[] }) {
  const [storeFilter, setStoreFilter] = useState("");
  const [query, setQuery] = useState("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const stores = useMemo(
    () => Array.from(new Set(deals.map((d) => d.store))).sort((a, b) => a.localeCompare(b, "de")),
    [deals]
  );
  const cheapestId = useMemo(
    () => deals.reduce<SparklingDeal | null>((best, d) => (!best || d.price < best.price ? d : best), null)?.id,
    [deals]
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = deals.filter(
      (d) =>
        (!storeFilter || d.store === storeFilter) &&
        (!q || `${d.title} ${d.details ?? ""}`.toLowerCase().includes(q))
    );
    rows.sort((a, b) => (sortDir === "asc" ? a.price - b.price : b.price - a.price));
    return rows;
  }, [deals, storeFilter, query, sortDir]);

  if (deals.length === 0) {
    return (
      <p className="text-muted text-sm px-5 sm:px-6 py-6">
        Noch keine Angebote geladen – die Liste wird täglich automatisch aktualisiert.
      </p>
    );
  }

  return (
    <>
      <div className="px-5 sm:px-6 py-3 border-b border-border flex items-center gap-3 flex-wrap text-sm">
        <label className="flex items-center gap-1.5">
          <span className="text-muted">Händler:</span>
          <select
            value={storeFilter}
            onChange={(e) => setStoreFilter(e.target.value)}
            className="border border-border rounded-md px-2 py-1 bg-surface"
          >
            <option value="">Alle</option>
            {stores.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Suchen, z. B. Rotkäppchen"
          className="border border-border rounded-md px-2 py-1 bg-surface min-w-0 flex-1 sm:flex-none sm:w-56"
        />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted border-b border-border">
              <th className="px-5 sm:px-6 py-2.5 font-medium">Produkt</th>
              <th className="px-3 py-2.5 font-medium">Händler</th>
              <th className="px-3 py-2.5 font-medium">
                <button
                  type="button"
                  onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
                  className="font-medium inline-flex items-center gap-1 hover:text-foreground"
                >
                  Preis {sortDir === "asc" ? "↑" : "↓"}
                </button>
              </th>
              <th className="px-3 py-2.5 font-medium"></th>
              <th className="px-3 py-2.5 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {visible.map((d) => (
              <tr
                key={d.id}
                className={`border-b border-border last:border-0 ${d.id === cheapestId ? "bg-brand-light" : ""}`}
              >
                <td className="px-5 sm:px-6 py-3">
                  <p className="font-medium">{d.title}</p>
                  {d.details && <p className="text-xs text-muted mt-0.5">{d.details}</p>}
                </td>
                <td className="px-3 py-3 text-muted">{d.store}</td>
                <td className="px-3 py-3 font-semibold text-brand-dark whitespace-nowrap">
                  {d.price.toFixed(2).replace(".", ",")} €{d.id === cheapestId && " 🏆"}
                </td>
                <td className="px-3 py-3">
                  {d.offerUrl && (
                    <a
                      href={d.offerUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="badge badge-blue border-0 font-sans hover:brightness-95 transition"
                    >
                      📄 Prospekt
                    </a>
                  )}
                </td>
                <td className="px-3 py-3">
                  <a
                    href={mapsUrl(d.store)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="badge badge-green border-0 font-sans hover:brightness-95 transition"
                  >
                    🧭 Route
                  </a>
                </td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 sm:px-6 py-6 text-center text-muted">
                  Keine Angebote für diese Auswahl.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
