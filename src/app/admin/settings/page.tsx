import { isAdmin } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { updateSettingsAction, updateSpielerplusUrlAction } from "@/lib/actions";
import { DbSetupButton } from "./DbSetupButton";

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

  const credentialsConfigured = Boolean(
    process.env.SPIELERPLUS_EMAIL && process.env.SPIELERPLUS_PASSWORD
  );

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
        <h2 className="text-lg font-bold">Spielerplus-Sync</h2>
        <p className="text-sm text-muted">
          Zugangsdaten (E-Mail/Passwort) werden nicht über die Weboberfläche gepflegt, sondern
          als Umgebungsvariablen <code className="bg-brand-light px-1 rounded">SPIELERPLUS_EMAIL</code>{" "}
          und <code className="bg-brand-light px-1 rounded">SPIELERPLUS_PASSWORD</code> gesetzt –
          aus Sicherheitsgründen. Status:{" "}
          {credentialsConfigured ? (
            <span className="badge badge-green">konfiguriert</span>
          ) : (
            <span className="badge badge-gray">nicht konfiguriert</span>
          )}
        </p>

        <form action={updateSpielerplusUrlAction} className="space-y-2 max-w-lg">
          <label className="text-sm font-medium text-muted block mb-1">
            Team-/Spielplan-URL bei Spielerplus
          </label>
          <input
            type="url"
            name="teamUrl"
            placeholder="https://www.spielerplus.de/team/..."
            defaultValue={spielerplus?.teamUrl ?? ""}
            className="input"
          />
          <button type="submit" className="btn btn-outline text-sm">Speichern</button>
        </form>

        {spielerplus?.lastSyncAt && (
          <p className="text-sm text-muted">
            Letzter Sync: {new Date(spielerplus.lastSyncAt).toLocaleString("de-DE")} –{" "}
            {spielerplus.lastSyncOk ? "✅ erfolgreich" : "❌ fehlgeschlagen"}
            {spielerplus.lastSyncMsg ? ` (${spielerplus.lastSyncMsg})` : ""}
          </p>
        )}

        <p className="text-xs text-muted">
          Hinweis: Der Sync loggt sich mit deinem Spielerplus-Account ein und liest die
          Anwesenheit für das jeweilige Spiel aus. Das ist eine inoffizielle Automatisierung
          ohne öffentliche API von Spielerplus – ändert Spielerplus seine Seite, kann der Sync
          fehlschlagen. Die Anwesenheit lässt sich in diesem Fall jederzeit manuell auf der
          Spiel-Seite pflegen.
        </p>
      </section>
    </div>
  );
}
