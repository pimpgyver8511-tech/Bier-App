import { BeerDealsSyncButton } from "@/components/BeerDealsSyncButton";

export type BeerDealRow = {
  id: string;
  brand: string;
  store: string | null;
  price: number | null;
};

function formatDateTime(d: Date) {
  return d.toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Berlin",
  });
}

function mapsUrl(store: string) {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${store} Leipzig`)}`;
}

export function BeerDealsCard({
  deals,
  lastSyncAt,
  lastSyncOk,
  lastSyncMsg,
}: {
  deals: BeerDealRow[];
  lastSyncAt: Date | null;
  lastSyncOk: boolean;
  lastSyncMsg: string | null;
}) {
  return (
    <section className="card overflow-hidden">
      <div className="px-5 sm:px-6 py-4 border-b border-border flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            🍺 Bierkasten-Angebote diese Woche{" "}
            <span className="badge badge-gray text-[10px]">nur für Admin sichtbar</span>
          </h2>
          <p className="text-xs text-muted mt-0.5">
            Die günstigsten Kästen (20x0,5l bzw. 24x0,33l) aktuell in Leipzig
          </p>
        </div>
        <BeerDealsSyncButton />
      </div>

      {deals.length === 0 ? (
        <p className="text-muted text-sm px-5 sm:px-6 py-6">
          Noch keine Angebote geladen. Auf &quot;Jetzt aktualisieren&quot; klicken oder auf den
          wöchentlichen automatischen Sync warten.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted border-b border-border">
                <th className="px-5 sm:px-6 py-2.5 font-medium">Marke</th>
                <th className="px-3 py-2.5 font-medium">Händler</th>
                <th className="px-3 py-2.5 font-medium">Preis</th>
                <th className="px-3 py-2.5 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {deals.map((d, i) => (
                <tr key={d.id} className={`border-b border-border last:border-0 ${i === 0 ? "bg-brand-light" : ""}`}>
                  <td className="px-5 sm:px-6 py-3 font-medium">{d.brand}</td>
                  <td className="px-3 py-3 text-muted">{d.store ?? "–"}</td>
                  <td className="px-3 py-3 font-semibold text-brand-dark">
                    {d.price !== null ? `${d.price.toFixed(2).replace(".", ",")} €` : "–"}
                    {i === 0 && " 🏆"}
                  </td>
                  <td className="px-3 py-3">
                    {d.store && (
                      <a
                        href={mapsUrl(d.store)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="badge badge-green border-0 font-sans hover:brightness-95 transition"
                      >
                        🧭 Route
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="px-5 sm:px-6 py-2.5 text-xs text-muted bg-surface border-t border-border">
        {lastSyncAt ? (
          <>
            Letzter Sync: {formatDateTime(lastSyncAt)} —{" "}
            <span className={lastSyncOk ? "text-brand-dark" : "text-danger"}>
              {lastSyncOk ? "✅ erfolgreich" : "⚠️ fehlgeschlagen"}
            </span>
            {lastSyncMsg ? ` (${lastSyncMsg})` : ""}
          </>
        ) : (
          "Noch kein Sync gelaufen."
        )}{" "}
        · Route führt zur nächstgelegenen Filiale ab deinem Standort
      </div>
    </section>
  );
}
