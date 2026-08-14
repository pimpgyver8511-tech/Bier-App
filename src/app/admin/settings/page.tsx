import { isAdmin } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { updateSettingsAction, updateIcsUrlAction } from "@/lib/actions";
import { DbSetupButton } from "@/components/DbSetupButton";
import { IcsSyncButton } from "@/components/IcsSyncButton";

export default async function SettingsPage() {
  if (!(await isAdmin())) redirect("/admin");

  // Tabellen existieren evtl. noch nicht (frisches Deployment vor der
  // einmaligen Einrichtung) - Seite soll trotzdem rendern, damit der
  // Einrichten-Button unten erreichbar ist.
  let settings: Awaited<ReturnType<typeof prisma.settings.findUnique>> = null;
  let spielerplus: Awaited<ReturnType<typeof prisma.spielerplusConfig.findUnique>> = null;
  let dbReady = true;
  try {
    [settings, spielerplus] = await Promise.all([
      prisma.settings.findUnique({ where: { id: 1 } }),
      prisma.spielerplusConfig.findUnique({ where: { id: 1 } }),
    ]);
  } catch {
    dbReady = false;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Einstellungen</h1>
      </div>

      {!dbReady && (
        <section className="card p-5 sm:p-6 space-y-3 border-gold">
          <h2 className="text-lg font-bold">⚠️ Datenbank noch nicht eingerichtet</h2>
          <p className="text-sm text-muted">
            Die Tabellen existieren noch nicht. Einmalig einrichten, danach funktioniert die
            App normal (diese Seite lädt dann auch wieder alle Einstellungen).
          </p>
          <DbSetupButton />
        </section>
      )}

      <section className="card p-5 sm:p-6 space-y-3">
        <h2 className="text-lg font-bold">Datenbank-Wartung</h2>
        <p className="text-sm text-muted">
          Nach einem Deploy mit neuen Datenbank-Änderungen hier klicken, damit diese
          angewendet werden (läuft zur Laufzeit statt beim Build, siehe README).
        </p>
        <DbSetupButton />
      </section>

      <section className="card p-5 sm:p-6 space-y-4">
        <h2 className="text-lg font-bold">Kasten-Regeln</h2>
        <form action={updateSettingsAction} className="space-y-4 max-w-sm">
          <div>
            <label className="text-sm font-medium text-muted block mb-1">
              Cooldown zwischen zwei Kästen (Wochen)
            </label>
            <input
              type="number"
              name="cooldownWeeks"
              min={0}
              defaultValue={settings?.cooldownWeeks ?? 6}
              className="input"
              required
            />
          </div>
          <div>
            <label className="text-sm font-medium text-muted block mb-1">
              Kästen pro Spieltag
            </label>
            <input
              type="number"
              name="kastenPerMatch"
              min={1}
              defaultValue={settings?.kastenPerMatch ?? 2}
              className="input"
              required
            />
          </div>
          <button type="submit" className="btn btn-primary">Speichern</button>
        </form>
      </section>

      <section className="card p-5 sm:p-6 space-y-4">
        <h2 className="text-lg font-bold">Spielplan-Sync (Spielerplus)</h2>
        <p className="text-sm text-muted">
          Spielerplus bietet unter „Kalender abonnieren&rdquo; einen persönlichen .ics-Link an
          (Team-Kalender → Kalender-Symbol → „Kalender abonnieren&rdquo;). Der wird hier
          eingetragen und beim Synchronisieren einfach per HTTP abgerufen – kein Login, kein
          Browser nötig.
          Übernommen werden Datum, Ort, Heim/Auswärts und Gegner neuer bzw. verschobener Spiele.
          Die Zusagen/Absagen der einzelnen Spieler stehen nicht im Kalender-Export und bleiben
          weiterhin manuell auf der jeweiligen Spiel-Seite zu pflegen.
        </p>

        <form action={updateIcsUrlAction} className="space-y-2 max-w-lg">
          <label className="text-sm font-medium text-muted block mb-1">
            Spielerplus-Kalender-URL (.ics)
          </label>
          <input
            type="url"
            name="icsUrl"
            placeholder="https://www.spielerplus.de/events/ics?t=...&u=..."
            defaultValue={spielerplus?.icsUrl ?? ""}
            className="input"
          />
          <button type="submit" className="btn btn-outline text-sm">Speichern</button>
        </form>

        <IcsSyncButton />

        {spielerplus?.lastSyncAt && (
          <p className="text-sm text-muted">
            Letzter Sync:{" "}
            {new Date(spielerplus.lastSyncAt).toLocaleString("de-DE", {
              timeZone: "Europe/Berlin",
            })}{" "}
            –{" "}
            {spielerplus.lastSyncOk ? "✅ erfolgreich" : "❌ fehlgeschlagen"}
            {spielerplus.lastSyncMsg ? ` (${spielerplus.lastSyncMsg})` : ""}
          </p>
        )}
      </section>
    </div>
  );
}
