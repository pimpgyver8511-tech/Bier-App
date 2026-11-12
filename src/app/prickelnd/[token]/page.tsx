import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isAdmin, isValidSparklingShareToken } from "@/lib/auth";
import {
  getAllSparklingDeals,
  getSparklingDealsConfig,
  parseSparklingSyncDebug,
  type SparklingSyncDebug,
} from "@/lib/sparklingdeals";
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

function euro(price: number) {
  return `${price.toFixed(2).replace(".", ",")} €`;
}

/** Nur fuer den Admin: was der letzte Abgleich aussortiert hat und warum. */
function SyncDiagnostics({ debug }: { debug: SparklingSyncDebug }) {
  return (
    <details className="border-t border-border text-xs">
      <summary className="px-4 sm:px-6 py-2.5 cursor-pointer text-muted select-none">
        🔍 Diagnose (nur für dich sichtbar) – {debug.rejected.length} aussortiert,{" "}
        {debug.notYetValid.length} noch nicht gültig
      </summary>
      <div className="px-4 sm:px-6 pb-4 space-y-3">
        <div>
          <p className="font-semibold mb-1">Treffer je Händler</p>
          <p className="text-muted">
            {debug.stores.length
              ? debug.stores.map((s) => `${s.store} (${s.count})`).join(" · ")
              : "keine"}
          </p>
        </div>
        <div>
          <p className="font-semibold mb-1">kaufda-Suche (gefundene Prospekte)</p>
          <p className="text-muted">
            {debug.queries
              .map((q) => `${q.query}: ${q.brochures < 0 ? "Fehler" : q.brochures}`)
              .join(" · ")}
          </p>
        </div>
        {debug.notYetValid.length > 0 && (
          <div>
            <p className="font-semibold mb-1">Gefunden, aber erst ab später gültig</p>
            <ul className="space-y-0.5 text-muted">
              {debug.notYetValid.map((d, i) => (
                <li key={i}>
                  {d.title} – {d.store} – {euro(d.price)} – ab{" "}
                  {new Date(d.validFrom).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin" })}
                </li>
              ))}
            </ul>
          </div>
        )}
        <div>
          <p className="font-semibold mb-1">Aussortiert</p>
          {debug.rejected.length ? (
            <ul className="space-y-0.5 text-muted">
              {debug.rejected.map((r, i) => (
                <li key={i}>
                  {r.title} – {r.store}: <span className="text-foreground">{r.reason}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted">nichts</p>
          )}
        </div>
        {debug.errors.length > 0 && (
          <div>
            <p className="font-semibold mb-1">Fehler bei Quellen</p>
            <ul className="space-y-0.5 text-danger">
              {debug.errors.map((e, i) => (
                <li key={i} className="break-all">
                  {e}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </details>
  );
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
  // Getrennt abgefragt: fehlt nach einem Update noch eine neue Spalte der
  // Config-Tabelle (Admin > Einstellungen > Datenbank), bleiben die Angebote
  // trotzdem sichtbar.
  const [dealsResult, configResult] = await Promise.allSettled([
    getAllSparklingDeals(),
    getSparklingDealsConfig(),
  ]);
  const deals = dealsResult.status === "fulfilled" ? dealsResult.value : [];
  const config = configResult.status === "fulfilled" ? configResult.value : null;
  const debug = admin ? parseSparklingSyncDebug(config?.lastSyncDebug) : null;

  return (
    <section className="card overflow-hidden">
      <div className="px-4 sm:px-6 py-4 border-b border-border flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-lg font-bold">🥂 Gingers World</h1>
          <p className="text-xs text-muted mt-0.5">Aktuelle Angebote in Leipzig, günstigste zuerst</p>
        </div>
        {admin && <SparklingDealsSyncButton />}
      </div>

      <SparklingDealsTable deals={deals} />

      <div className="px-4 sm:px-6 py-2.5 text-xs text-muted bg-surface border-t border-border">
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

      {debug && <SyncDiagnostics debug={debug} />}
    </section>
  );
}
