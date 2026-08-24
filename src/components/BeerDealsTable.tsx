"use client";

import { useMemo, useState } from "react";
import type { BeerDeal } from "@/lib/beerdeals";

function mapsUrl(store: string) {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${store} Leipzig`)}`;
}

function formatDay(d: Date) {
  return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", timeZone: "Europe/Berlin" });
}

/**
 * Manche Angebote (z.B. Tagesangebote) gelten nur an einem einzelnen Tag
 * statt die ganze Woche - das wird hier sichtbar gemacht, statt sie wie
 * ein normales Wochenangebot aussehen zu lassen.
 */
function formatValidity(d: BeerDeal): string | null {
  if (d.validFrom && d.validUntil) {
    const fromDay = formatDay(d.validFrom);
    const untilDay = formatDay(d.validUntil);
    return fromDay === untilDay ? `nur am ${fromDay}` : `bis ${untilDay}`;
  }
  if (d.validUntil) return `bis ${formatDay(d.validUntil)}`;
  return null;
}

export function BeerDealsTable({ deals }: { deals: BeerDeal[] }) {
  const [storeFilter, setStoreFilter] = useState("");
  const [brandFilter, setBrandFilter] = useState("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const stores = useMemo(
    () => Array.from(new Set(deals.map((d) => d.store))).sort((a, b) => a.localeCompare(b, "de")),
    [deals]
  );
  const brands = useMemo(
    () => Array.from(new Set(deals.map((d) => d.brand))).sort((a, b) => a.localeCompare(b, "de")),
    [deals]
  );
  const cheapestId = useMemo(
    () => deals.reduce<BeerDeal | null>((best, d) => (!best || d.price < best.price ? d : best), null)?.id,
    [deals]
  );

  const visible = useMemo(() => {
    const rows = deals.filter(
      (d) => (!storeFilter || d.store === storeFilter) && (!brandFilter || d.brand === brandFilter)
    );
    rows.sort((a, b) => (sortDir === "asc" ? a.price - b.price : b.price - a.price));
    return rows;
  }, [deals, storeFilter, brandFilter, sortDir]);

  if (deals.length === 0) {
    return (
      <p className="text-muted text-sm px-5 sm:px-6 py-6">
        Noch keine Angebote geladen. Auf &quot;Jetzt aktualisieren&quot; klicken oder auf den
        täglichen automatischen Sync warten.
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
        <label className="flex items-center gap-1.5">
          <span className="text-muted">Marke:</span>
          <select
            value={brandFilter}
            onChange={(e) => setBrandFilter(e.target.value)}
            className="border border-border rounded-md px-2 py-1 bg-surface"
          >
            <option value="">Alle</option>
            {brands.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </label>
        {(storeFilter || brandFilter) && (
          <button
            type="button"
            onClick={() => {
              setStoreFilter("");
              setBrandFilter("");
            }}
            className="text-xs text-muted underline hover:text-foreground"
          >
            Filter zurücksetzen
          </button>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted border-b border-border">
              <th className="px-5 sm:px-6 py-2.5 font-medium">Marke</th>
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
              <th className="px-3 py-2.5 font-medium">Gültig</th>
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
                <td className="px-5 sm:px-6 py-3 font-medium">{d.brand}</td>
                <td className="px-3 py-3 text-muted">{d.store}</td>
                <td className="px-3 py-3 font-semibold text-brand-dark">
                  {d.price.toFixed(2).replace(".", ",")} €{d.id === cheapestId && " 🏆"}
                </td>
                <td className="px-3 py-3 text-muted whitespace-nowrap">{formatValidity(d) ?? "–"}</td>
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
                <td colSpan={6} className="px-5 sm:px-6 py-6 text-center text-muted">
                  Keine Angebote für diese Filterauswahl.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
