import { BeerDealsSyncButton } from "@/components/BeerDealsSyncButton";
import { BeerDealsTable } from "@/components/BeerDealsTable";
import type { BeerDeal } from "@/lib/beerdeals";

function formatDateTime(d: Date) {
  return d.toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Berlin",
  });
}

export function BeerDealsCard({
  deals,
  lastSyncAt,
  lastSyncOk,
  lastSyncMsg,
  admin,
}: {
  deals: BeerDeal[];
  lastSyncAt: Date | null;
  lastSyncOk: boolean;
  lastSyncMsg: string | null;
  admin: boolean;
}) {
  return (
    <section className="card overflow-hidden">
      <div className="px-5 sm:px-6 py-4 border-b border-border flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            🍺 Bierkasten-Angebote diese Woche
          </h2>
          <p className="text-xs text-muted mt-0.5">
            Die günstigsten Kästen (20x0,5l bzw. 24x0,33l) aktuell in Leipzig
          </p>
        </div>
        {admin && <BeerDealsSyncButton />}
      </div>

      <BeerDealsTable deals={deals} />

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
