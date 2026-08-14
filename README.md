# 🍺 Bier App

Kleine Web-App für den Verein: Jede Woche legt der Admin fest, welche zwei
(oder mehr) Spieler einen Kasten Bier zum nächsten Spiel mitbringen müssen.
Die App gleicht dazu die Anwesenheit ab, prüft einen Mindestabstand zwischen
zwei Kästen pro Spieler ("Cooldown") und schlägt fair die Spieler vor, die am
längsten keinen Kasten mehr mitgebracht haben. Alle Spieler können den
aktuellen Stand ohne Login einsehen; nur der Admin-Bereich ist geschützt.

## Tech-Stack

- **Next.js 16** (App Router, TypeScript, Server Actions)
- **Tailwind CSS 4** – Vereinsfarben Grün/Weiß mit Bier-Gold als Akzent
- **Prisma 7 + Postgres** (`@prisma/adapter-pg` Treiber) – läuft mit jedem
  Postgres-Anbieter (Vercel Postgres/Neon, Prisma Postgres, Supabase, lokal, …)

## Lokal starten

Voraussetzung: eine erreichbare Postgres-Datenbank (lokal z. B. via Docker:
`docker run -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:16`).

```bash
npm install
cp .env.example .env         # Werte anpassen, siehe unten
npx prisma migrate dev       # legt Tabellen an
npx prisma db seed           # optional: aktuellen Kader einspielen (prisma/seed.ts)
npm run dev
```

App läuft dann auf http://localhost:3000. Öffentliche Übersicht unter `/`,
Admin-Bereich unter `/admin` (Login mit `ADMIN_PASSWORD` aus der `.env`).

## Umgebungsvariablen (`.env`)

| Variable | Pflicht | Beschreibung |
|---|---|---|
| `DATABASE_URL` | ja | Postgres-Connection-String, z. B. `postgresql://user:pw@host:5432/db?schema=public` |
| `ADMIN_PASSWORD` | ja | Passwort für den Admin-Bereich |
| `SESSION_SECRET` | ja | Zufälliger String zum Signieren der Admin-Session |

Die Spielerplus-Kalender-URL für den Spielplan-Sync wird nicht über eine
Umgebungsvariable, sondern direkt im Admin-Bereich unter Einstellungen
gepflegt (siehe nächster Abschnitt).

## Wie die Kasten-Zuteilung funktioniert

1. Für jedes Spiel wird die Anwesenheit gepflegt (manuell oder per Spielerplus-Sync).
2. Ein Spieler ist **grundsätzlich wählbar**, wenn er für das Spiel zugesagt hat
   *und* seit seinem letzten Kasten mindestens `cooldownWeeks` Wochen vergangen
   sind (einstellbar unter Admin → Einstellungen, Standard: 6 Wochen).
3. Aus den wählbaren Spielern werden die `kastenPerMatch` (Standard: 2)
   vorgeschlagen, die am längsten keinen Kasten mehr mitgebracht haben (bzw.
   noch nie). Das ist die faire Warteschlange, die auch auf der öffentlichen
   Startseite sichtbar ist.
4. Der Admin kann den Vorschlag übernehmen oder abweichend eigene Spieler
   auswählen, dazu optional eine Begründung eintragen (ersetzt die bisherige
   separate Google-Notes-Liste – die Begründungen leben jetzt direkt in der
   Kasten-Historie unter Admin → Kasten-Historie).

## Spielerplus-Sync

Spielerplus bietet keine offizielle öffentliche API. Ein automatischer
Login+Scraping-Sync (per Playwright/Chromium) wurde probiert, musste aber
wieder entfernt werden: Next.js bindet `playwright-core` schon beim Build
fest in die serverseitige Funktion ein, sobald das Paket irgendwo im Code
vorkommt (auch bei bedingtem/dynamischem Import) – auf Vercel führte das
dazu, dass **die gesamte App** mit „Cannot find module" abstürzte, nicht nur
der Sync selbst. Da auf Vercel ohnehin kein Chromium-Browser installiert
ist, wurde dieser Ansatz verworfen.

Stattdessen nutzt die App den **.ics-Kalender-Export**, den Spielerplus unter
„Kalender abonnieren" pro Team anbietet: ein öffentlicher, tokenbasierter
Link ohne Login, der sich per einfachem `fetch()` abrufen lässt – kein
Browser, kein Chromium nötig, läuft problemlos in einer normalen
Vercel-Funktion. Die URL wird unter Admin → Einstellungen hinterlegt; der
Sync-Button legt daraus neue `Match`-Einträge an bzw. aktualisiert
bestehende (Datum, Ort, Heim/Auswärts, Gegner), erkannt über die
Spielerplus-Termin-ID (`Match.externalId`). Der eigene Vereinsname wird
automatisch aus dem `X-WR-CALDESC`-Feld des Kalenders gelesen, um bei jedem
Spiel Heim/Auswärts und Gegner aus dem Termin-Titel abzuleiten.

**Wichtig:** Der Kalender-Export enthält keine Zusagen/Absagen einzelner
Spieler (personenbezogene Daten, die Spielerplus nicht öffentlich exportiert)
– nur den Spielplan selbst. Die Anwesenheitspflege bleibt deshalb weiterhin
manuell über die drei Buttons (Zusage/Absage/Offen) pro Spieler auf der
jeweiligen Spiel-Seite – das ist und bleibt der unterstützte Standardweg.

## Deployment auf Vercel

1. **Repo bei Vercel importieren**: [vercel.com/new](https://vercel.com/new) →
   GitHub-Account verbinden → dieses Repo auswählen → Branch
   `claude/bier-app-development-pblygb` (oder erst in `main` mergen).
2. **Postgres-Datenbank anlegen**: im Vercel-Projekt unter *Storage* → *Create
   Database* → Postgres (Neon-basiert, kostenloser Hobby-Tier reicht locker
   für ein Vereins-Team). Vercel setzt `DATABASE_URL` dabei automatisch als
   Umgebungsvariable im Projekt.
3. **Weitere Umgebungsvariablen** unter *Settings → Environment Variables* setzen:
   - `ADMIN_PASSWORD` – dein Admin-Passwort
   - `SESSION_SECRET` – langer Zufallsstring
4. **Deploy auslösen** – danach automatisch bei jedem Push auf den verbundenen Branch.
5. **Datenbank einrichten/aktualisieren**: einloggen unter `/admin`, zu
   **Einstellungen** gehen (Abschnitt "Datenbank-Wartung") und auf
   **„Datenbank einrichten/aktualisieren"** klicken. (`prisma migrate deploy`
   lief bei uns im Vercel-Build zuverlässig auf einen Verbindungsfehler zur
   Datenbank – die Build-Umgebung scheint dort anderen Netzwerkzugriff zu
   haben als die Serverless-Function-Laufzeit. Migrationen laufen deshalb zur
   Laufzeit über diesen Button, der direkt den bestehenden Prisma-Client
   nutzt.)
   - **Bei jeder künftigen Schema-Änderung** (neues Prisma-Migrationsfile):
     in `src/lib/db-setup.ts` einen neuen Eintrag im `MIGRATIONS`-Array mit
     demselben Namen und denselben SQL-Statements wie die neue Migration
     ergänzen, deployen, dann den Button erneut klicken. Bereits angewendete
     Migrationen werden über die Tabelle `_manual_migrations` übersprungen.

## Projektstruktur (Kurzüberblick)

```
prisma/schema.prisma        Datenmodell (Player, Match, Attendance, KastenAssignment, ...)
src/lib/db.ts                Prisma-Client-Singleton
src/lib/auth.ts               Admin-Session (Passwort + signiertes Cookie)
src/lib/kasten.ts             Regel-Engine für die faire Kasten-Zuteilung
src/lib/spielerplus.ts        Spielplan-Sync über den Spielerplus-.ics-Kalenderexport
src/lib/actions.ts            Server Actions (alle Schreibzugriffe)
src/app/page.tsx              Öffentliche Startseite (nächstes Spiel, Warteschlange)
src/app/admin/**              Admin-Bereich (Login, Spieler, Spiele, Historie, Einstellungen)
```
