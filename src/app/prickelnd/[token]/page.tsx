import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isAdmin, isValidSparklingShareToken } from "@/lib/auth";
import { getAllSparklingDeals, getSparklingDealsConfig } from "@/lib/sparklingdeals";
import { SparklingDealsTable } from "@/components/SparklingDealsTable";
import { SparklingDealsSyncButton } from "@/components/SparklingDealsSyncButton";

export const metadata: Metadata = {
  title: "Gingers World",
  robots: { index: false, follow: false },
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

/**
 * Nicht verlinkte Spass-Seite mit Sekt-/Prosecco-Angeboten - nur ueber den
 * Link mit Token erreichbar (siehe getSparklingShareToken), ohne Login.
 * Ein falscher Token liefert eine normale 404, die Seite verraet also nicht,
 * dass es sie gibt.
 */
export default async function SparklingDealsPage({ params }: PageProps<"/prickelnd/[token]">) {
  const { token } = await params;
  if (!isValidSparklingShareToken(token)) notFound();

  const admin = await isAdmin();
  let deals: Awaited<ReturnType<typeof getAllSparklingDeals>> = [];
  let config: Awaited<ReturnType<typeof getSparklingDealsConfig>> = null;
  try {
    [deals, config] = await Promise.all([getAllSparklingDeals(), getSparklingDealsConfig()]);
  } catch {
    // Tabelle evtl. noch nicht eingerichtet (Admin > Einstellungen > Datenbank)
  }

  return (
    <section className="card overflow-hidden">
      <div className="px-5 sm:px-6 py-4 border-b border-border flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-lg font-bold">🥂 Gingers World</h1>
          <p className="text-xs text-muted mt-0.5">Aktuelle Angebote in Leipzig, günstigste zuerst</p>
        </div>
        {admin && <SparklingDealsSyncButton />}
      </div>

      <SparklingDealsTable deals={deals} />

      <div className="px-5 sm:px-6 py-2.5 text-xs text-muted bg-surface border-t border-border">
        {config?.lastSyncAt ? (
          <>
            Stand: {formatDateTime(config.lastSyncAt)}
            {admin && (
              <>
                {" — "}
                <span className={config.lastSyncOk ? "text-brand-dark" : "text-danger"}>
                  {config.lastSyncOk ? "✅ erfolgreich" : "⚠️ fehlgeschlagen"}
                </span>
                {config.lastSyncMsg ? ` (${config.lastSyncMsg})` : ""}
              </>
            )}
          </>
        ) : (
          "Noch nicht aktualisiert."
        )}{" "}
        · Route führt zur nächstgelegenen Filiale ab deinem Standort
      </div>
    </section>
  );
}
