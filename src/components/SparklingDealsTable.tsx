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
      <p className="text-muted text-sm px-4 sm:px-6 py-6">
        Noch keine Angebote geladen – die Liste wird täglich automatisch aktualisiert.
      </p>
    );
  }

  const priceLabel = (d: SparklingDeal) => `${d.price.toFixed(2).replace(".", ",")} €`;

  return (
    <>
      <div className="px-4 sm:px-6 py-3 border-b border-border flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 text-sm">
        <label className="flex items-center gap-1.5">
          <span className="text-muted shrink-0">Händler:</span>
          <select
            value={storeFilter}
            onChange={(e) => setStoreFilter(e.target.value)}
            className="border border-border rounded-md px-2 py-1.5 bg-surface flex-1 sm:flex-none min-w-0"
          >
            <option value="">Alle</option>
            {stores.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-center gap-2">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Suchen, z. B. Rotkäppchen"
            className="border border-border rounded-md px-2 py-1.5 bg-surface min-w-0 flex-1 sm:w-56"
          />
          <button
            type="button"
            onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
            className="sm:hidden border border-border rounded-md px-2 py-1.5 bg-surface whitespace-nowrap"
          >
            Preis {sortDir === "asc" ? "↑" : "↓"}
          </button>
        </div>
      </div>

      {/* Handy: Karten statt Tabelle, damit nichts seitlich abgeschnitten wird */}
      <ul className="sm:hidden divide-y divide-border">
        {visible.map((d) => (
          <li key={d.id} className={`px-4 py-3 ${d.id === cheapestId ? "bg-brand-light" : ""}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium leading-snug">{d.title}</p>
                {d.details && <p className="text-xs text-muted mt-0.5">{d.details}</p>}
              </div>
              <p className="font-bold text-brand-dark whitespace-nowrap text-base">
                {priceLabel(d)}
                {d.id === cheapestId && " 🏆"}
              </p>
            </div>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className="text-sm text-muted mr-auto">{d.store}</span>
              {d.offerUrl && (
                <a
                  href={d.offerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="badge badge-blue border-0 font-sans py-1"
                >
                  📄 Prospekt
                </a>
              )}
              <a
                href={mapsUrl(d.store)}
                target="_blank"
                rel="noopener noreferrer"
                className="badge badge-green border-0 font-sans py-1"
              >
                🧭 Route
              </a>
            </div>
          </li>
        ))}
        {visible.length === 0 && (
          <li className="px-4 py-6 text-center text-muted text-sm">Keine Angebote für diese Auswahl.</li>
        )}
      </ul>

      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted border-b border-border">
              <th className="px-6 py-2.5 font-medium">Produkt</th>
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
                <td className="px-6 py-3">
                  <p className="font-medium">{d.title}</p>
                  {d.details && <p className="text-xs text-muted mt-0.5">{d.details}</p>}
                </td>
                <td className="px-3 py-3 text-muted">{d.store}</td>
                <td className="px-3 py-3 font-semibold text-brand-dark whitespace-nowrap">
                  {priceLabel(d)}
                  {d.id === cheapestId && " 🏆"}
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
                <td colSpan={5} className="px-6 py-6 text-center text-muted">
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
