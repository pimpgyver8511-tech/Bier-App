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
- **Prisma 7 + SQLite** (`better-sqlite3` Treiber) – eine Datei, kein externer DB-Server nötig
- **Playwright** (optional) – für den experimentellen Spielerplus-Sync

## Lokal starten

```bash
npm install
cp .env.example .env      # Werte anpassen, siehe unten
npx prisma db push        # legt prisma/dev.db an
npm run dev
```

App läuft dann auf http://localhost:3000. Öffentliche Übersicht unter `/`,
Admin-Bereich unter `/admin` (Login mit `ADMIN_PASSWORD` aus der `.env`).

## Umgebungsvariablen (`.env`)

| Variable | Pflicht | Beschreibung |
|---|---|---|
| `DATABASE_URL` | ja | SQLite-Datei, Standard `file:./prisma/dev.db` |
| `ADMIN_PASSWORD` | ja | Passwort für den Admin-Bereich |
| `SESSION_SECRET` | ja | Zufälliger String zum Signieren der Admin-Session |
| `SPIELERPLUS_EMAIL` / `SPIELERPLUS_PASSWORD` | optional | Login für den automatischen Anwesenheits-Sync |
| `SPIELERPLUS_TEAM_URL` | optional | Alternative zur Team-URL in den Admin-Einstellungen |

Ohne die drei letzten Werte funktioniert die App normal – Anwesenheit wird
dann manuell im Admin-Bereich gepflegt.

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
   Kasten-Historie unter `/verlauf` bzw. Admin → Kasten-Historie).

## Spielerplus-Sync (experimentell)

Spielerplus bietet keine offizielle öffentliche API. Der Sync-Button im
Admin-Bereich einer Spiel-Seite loggt sich deshalb inoffiziell mit deinem
eigenen Spielerplus-Account per Headless-Browser (Playwright) ein, sucht das
passende Spiel anhand des Datums und liest die Zusagen/Absagen aus.

**Wichtig:** Dieses Modul (`src/lib/spielerplus.ts`) wurde entwickelt, ohne
gegen die echte Spielerplus-Seite testen zu können (die Entwicklungsumgebung
hatte keinen Zugriff auf spielerplus.de). Die Selektoren basieren auf
üblichen Konventionen für Login-Formulare und Tabellen und müssen mit hoher
Wahrscheinlichkeit **einmalig nachjustiert werden**, sobald du sie gegen den
echten Account testest. Schlägt der Sync fehl, bekommst du eine Fehlermeldung
im Admin-Bereich – die Anwesenheit lässt sich davon unabhängig jederzeit
manuell über die drei Buttons (Zusage/Absage/Offen) pro Spieler pflegen, das
ist der voll unterstützte Standardweg.

Voraussetzungen für den Sync:
- `SPIELERPLUS_EMAIL` und `SPIELERPLUS_PASSWORD` gesetzt
- Team-/Spielplan-URL unter Admin → Einstellungen hinterlegt
- Ein installierter Chromium-Browser auf dem Server. Pfad optional über
  `PLAYWRIGHT_CHROMIUM_EXECUTABLE` angeben, sonst werden gängige Standardpfade
  (`/usr/bin/chromium`, `/usr/bin/google-chrome-stable`, …) probiert.

Falls die Selektoren angepasst werden müssen: Login-Logik in
`loginToSpielerplus()`, das Finden/Parsen des Spiels in
`findMatchAttendance()` – beides in `src/lib/spielerplus.ts`.

## Deployment

Die App ist ein normales Next.js-Projekt mit lokaler SQLite-Datei, läuft also
auf jedem Node-Server (z. B. eigener vServer, Fly.io, Railway). Wichtig:

- `npm run build && npm run start`
- `prisma/dev.db` liegt auf einem persistenten Volume (kein ephemeres Dateisystem)
- `.env` mit produktivem `ADMIN_PASSWORD` und `SESSION_SECRET` setzen
- Für Vercel: SQLite-Dateien sind dort nicht persistent (read-only Filesystem
  zur Laufzeit) – entweder auf eine gehostete Postgres-DB wechseln (Prisma
  Adapter tauschen) oder einen Anbieter mit persistentem Dateisystem nutzen.

## Projektstruktur (Kurzüberblick)

```
prisma/schema.prisma        Datenmodell (Player, Match, Attendance, KastenAssignment, ...)
src/lib/db.ts                Prisma-Client-Singleton
src/lib/auth.ts               Admin-Session (Passwort + signiertes Cookie)
src/lib/kasten.ts             Regel-Engine für die faire Kasten-Zuteilung
src/lib/spielerplus.ts        Experimenteller Spielerplus-Sync
src/lib/actions.ts            Server Actions (alle Schreibzugriffe)
src/app/page.tsx              Öffentliche Startseite (nächstes Spiel, Warteschlange)
src/app/verlauf/page.tsx      Öffentliche Kasten-Historie
src/app/admin/**              Admin-Bereich (Login, Spieler, Spiele, Historie, Einstellungen)
```
