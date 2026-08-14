# Kasten-Historie – Rohdaten aus "Volkssport" PDF (Google Doc)

Quelle: `Volkssport_.pdf`, von Jens am 13.08.2026 hochgeladen (bisherige
handische Pflege der Kasten-Historie, vor der Bier App).

**Update von Jens (14.08.2026):**
- Seite 1 und Seite 2 des PDFs werden **ignoriert** (alte Saisons, nicht
  relevant für den Import). Rohtext dazu liegt trotzdem noch unten im
  Anhang, falls doch mal gebraucht.
- Seite 3 wird von Jens selbst nochmal **ordentlich aufgearbeitet** und neu
  geliefert – die Version unten ist also nur der Zwischenstand aus dem PDF,
  wird noch ersetzt.
- Der **Kohlfahrt-Abschnitt ist komplett gestrichen**.
- **"Armin: -1" / "Hoffi: -1" bedeutet Guthaben** (sie haben schon einen
  Kasten im Voraus/zu viel gebracht, sind also NICHT als Nächstes dran,
  auch wenn ihr Cooldown das nahelegen würde).
- **Philipp Wiehl hat geheiratet** – vermutlich ein weiterer offener/noch
  zu verbuchender Kasten-Anlass, aber noch nicht abschließend geklärt ob
  das schon irgendwo erfasst ist (siehe offene Frage unten).

**Nächste große Priorität laut Jens (13.08.2026):** Abgleich der
Spieler-Anwesenheit mit der Spielerplus-App. Der frühere automatische
Sync-Versuch (Playwright/Chromium) musste wieder entfernt werden, weil er
auf Vercel die ganze App zum Absturz brachte (siehe Commit-Historie /
README, Abschnitt "Spielerplus-Sync") – dafür braucht es einen anderen
Ansatz (z. B. separater Dienst außerhalb von Vercel). Wird bewusst auf
eine spätere Session verschoben, hier nur als Merker festgehalten.

**Status (14.08.2026, Update 2): Import-Werkstatt gebaut, Daten liegen bereit.**
Unter Admin → **Import** (`/admin/import`) gibt es jetzt eine Seite, die
diese Rohdaten (siehe `src/lib/import-data.ts`) Zeile für Zeile zur Prüfung
anzeigt: Spieler-Dropdown (mit Vorschlag, falls eindeutig zuordenbar dank
Jens' Tabelle unten), editierbare Begründung, editierbare Anzahl, dann
„Übernehmen" (legt bei Bedarf ein `Match` an und erzeugt die
`KastenAssignment`-Einträge) oder „Ignorieren" (verwirft die Zeile ohne
Import). "Kästen offen"-Zeilen werden ohne Spieltag importiert
(`fulfilled: false`), Seite-3-Zeilen mit Spieltag (`fulfilled: true`), die
zwei Guthaben-Zeilen (Armin, Hoffi) als bereits erfüllt mit heutigem Datum
(schiebt ihren Cooldown korrekt nach hinten). Lokal komplett durchgetestet.

Damit die Cooldown-/Fairness-Berechnung nicht von unklaren Alt-Schulden
verzerrt wird, zählen nur Zuweisungen mit Spieltag oder mit
`fulfilled: true` fürs "letzter Kasten"/"insgesamt". Rein offene
Alt-Schulden ohne Spieltag stehen weiterhin in der normalen
Kasten-Historie (`/verlauf`, Admin → Kasten-Historie), verzerren aber nicht
die automatische Vorschlagsliste.

**Nächster Schritt für Jens:** unter `/admin/import` durchklicken – vor
allem die als „❓ ungeklärt" markierten Zeilen (Spitznamen ohne
Kader-Zuordnung) manuell einem Spieler zuordnen oder ignorieren.

## Seite 3 (Zwischenstand aus dem PDF, wird von Jens noch überarbeitet)

Vermutlich Saison 2026 (16.03.2026 – 10.08.2026) – Jahreszahl noch nicht
von Jens bestätigt, nur Claudes Vermutung anhand des heutigen Datums und
der Kader-Beitrittsdaten (Andreas Hoffart 07.07.2026, Philipp Kluttig
06.08.2026).

```
16.3 Mole Bday 25
23.3 Helbe Traumtor, 
30.3 Stefan Schreiber 2 Doktor Kästen
8.4 Kevin R und Zintzschi
13.4 Pilzer Einstand und erstes Pflichtspiel-Kasten
20.4 Felix Schmidt und Niki - einfach so Kästen
27.4 Simon Teamevent statt Training, Jan Wasserflasche vergessen
4.5 Schmu und ich
11.5 Meppe Schaufel Tor, Bryan Matschrunde Tus II
18.5 Basti Pauly 2x
27.5 Frank 2x
8.6 Rico - lange keinen Kasten mehr Kasten
22.6 Kirby - Schlaganfall und Matschrunde
26.6 Simon Strafkasten und Pilzer Handtuch vergessen
27.7 Jesse Einstand
3.8 Bryan - Physio Kasten
10.8 Felix Schmidt und Mole
```

## Kästen offen (Stand: PDF-Erstellung, ohne Datum)

Das sind laut Original bereits **bekannte, aber noch nicht eingelöste**
Kasten-Schulden – vermutlich der wichtigste Teil für den ersten echten
Import in die App:

```
Jakob - Matschrunde, Weitschuss statt Torschuss im Training
Hoffi - Handtuch vergessen Makrans
R Trikotnummerwechsel-Kasten Rotation
Daui - Matschrunde West 03, Trainingslager verpeilt zweiter Kasten
Alex - Matschrunde Training 3.11, DTB Kiste
Jörg - 4 Kästen
Felle - Matschrunde Lok
Kevin Richter - Bday Kasten Ende Juli
Paulys - Bday 4.8
Kirby - Matschrunde Training 3.11
Frank - Bday
Stefan Schreiber - Bday 8.4
Zintzschi - Matschrunde Markkleeberg
Hoffi - Schach-Kopf Kasten, "wetten dass wir am Wochenende den Pokal gewonnen haben" Kiste
Theo - Emo Kasten (Entschuldigung gegen Markkleeberg)
Schmu - Neue Schuhe (gegen Lok das erste Mal gesichtet)
Basti Paul - Comeback Kiste, Matschrunde RS, Matschrunde bei Stefan zu Hause
Hoffi - das joke Kasten auf dem rooftop in Plagwitz, 2x Quatsch Kasten
Jens - Polnischer Abgang Kasten, Verguckt Kasten, Flasche vergessen Training
Frank - neue Schuhe Markkleeberg (weiß)
Helbe - Schlaganfall Kasten 3.8 gegen Spielvereinigung
Felix Sander - 40. Geburtstag
Zintzschi - neue Schuhe
Philipp neu - erstes Pflichtspiel Kasten
Jesse - erstes Pflichtspiel Kasten


Plus, mit geklärter Bedeutung:

```
Armin: -1     -> Guthaben (schon einen Kasten im Voraus gebracht)
Hoffi: -1     -> Guthaben (schon einen Kasten im Voraus gebracht)


## Spitznamen → Kader-Zuordnung (Ersteinschätzung, für Seite 3 + "Kästen offen")

Abgeglichen mit dem aktuellen 29-Spieler-Kader aus `prisma/seed.ts`.
Sicherheits-Einstufung: ✅ sehr wahrscheinlich · ⚠️ Vermutung · ❓ unklar/nicht im Kader.

| Im PDF | Vermuteter Spieler | Sicherheit |
|---|---|---|
| Mole | Matthias Molemans | ✅ (Nachname → Spitzname) |
| Basti Pauly, Basti Paul, Paulys (teilw.) | Sebastian Pauly | ✅ |
| Alex, Alex P, Alex Pauly | Alexander Pauly | ✅ |
| Rico | Rico Grundmann | ✅ |
| Simon | Simon Ogrisseck | ✅ |
| Bryan | Bryan Sura | ✅ |
| Hoffi | Andreas Hoffart | ✅ |
| Jens | Jens Otto-Langhof | ✅ |
| Frank | Frank Richter | ✅ |
| Theo | Theo Koch | ✅ |
| Zintzschi, Zintzsch | Sebastian Zintzsch | ✅ |
| Jakob | Jakob Hoffmann | ✅ |
| Armin | Armin Scheidig | ✅ |
| Jesse | Jesse Thalheim | ✅ |
| Niki | Niklas Cervinka | ✅ |
| Pilzer, Pilz | Patrick Pilz | ✅ |
| Kevin R | Kevin Richter | ✅ |
| Felix Sander | Felix Sander | ✅ |
| Felix Schmidt | Felix Schmidt | ✅ |
| Stefan Schreiber | Stefan Schreiber | ✅ |
| Philipp neu | Philipp Kluttig 
| Holfi | Sascha Holfert
| Jan | nicht im aktuellen Kader (evtl. ausgeschieden) | ❓ |
| Kirby | Sebastian Kirmse
| Daui | Kevin Dau 
| Schmu | Stefan Schmidt 
| Felle | Jürgen Fellenberg (alter Trainer) 
| Helbe | Philipp Helbig 
| Meppe | Manuel Rauscher



## Offene Fragen für die nächste Session

1. **Überarbeitete Seite 3 von Jens abwarten** – ersetzt den Zwischenstand
   oben.
2. **Jahreszahl für Seite 3 bestätigen** 2026. bestätigt
3. **Unklare Spitznamen auflösen** Tabelle korrigiert
4. **Philipp Wiehl (Hochzeit)** – nicht nötig
5. 
6. **"2x"-Einträge** – als zwei separate `KastenAssignment`-Zeilen
   importieren (für korrekte "Kästen insgesamt"-Zählung)?
7. **Kein Match-Bezug** – die App verknüpft jeden Kasten mit einem
   `Match`-Datensatz (Datum, Gegner). Für den Import müssten wir entweder
   rückwirkend Matches für all diese Daten anlegen (nur Datum, Gegner
   optional) oder das Datenmodell so anpassen, dass ein Kasten auch ohne
   Match-Bezug historisch erfasst werden kann.
8. **Guthaben abbilden** – die App kennt aktuell kein "Guthaben"-Konzept
   (nur Cooldown seit letztem Kasten). Für Armin/Hoffi (und ggf. andere)
   muss überlegt werden, wie sich "hat schon einen im Voraus gebracht" im
   Datenmodell/der Zuteilungslogik abbilden lässt.

## Empfehlung fürs weitere Vorgehen

Sobald die obigen Fragen geklärt sind: ein einmaliges Import-Script
(ähnlich `prisma/seed.ts`) schreiben, das für jede Zeile hier einen
`Match` (nur mit Datum) plus die zugehörigen `KastenAssignment`-Einträge
anlegt. Der Abschnitt "Kästen offen" sollte vermutlich mit
`fulfilled: false` importiert werden (die sind ja noch nicht eingelöst),
alles andere mit `fulfilled: true` (bereits mitgebrachte Kästen der
Vergangenheit).

---

## Anhang: Seite 1 & 2 (ignoriert, nur als Rohtext archiviert)

<details>
<summary>Seite 1 (alte Saison, ignoriert)</summary>

```
25.3 Mole (Bday), Basti Pauly (Matsch)
12.4 Felle (Akku aus), Simon (wieder da) - Städtebau
15.4 Rico (Bday), Reserve Kasten
26.4 Alex Matschrunde, Bryan (neue Schuhe)
29.4 Stefan (Bday), Felle (Geiles Kollektiv Kiste)
6.5 Mole (1. Tor), Felix/Felix (kecker Pokalspruch)
13.5 Jan (Falli), Hoffi (Matschrunde), Kirby (Ehering)
17.5 Simon (Matschrunde), Jens (Walter Frosch)
27.5 Bryan (Bday), Kev (Matschrunde)
3.6 Frank und Theo
10.6 Heili Einstand, Mika Bday
1.7 Daui Matschrunde Kickers
8.7 Schmu (Elfer gehalten), Jens (Atomschuss)
15.7 Rico (Elfer), Köppi (Geburtstag)
22.7 Zintzschi, Hoffi (Badelatschen vergessen)
26.7 Sascha (Einstand)
29.7 Felle 2x
5.8 Jakob und Armin jeweils Einstand
12.8 Mole 2x
19.8 Felix Sander (Hochzeit, Bday)
26.8 Ali 2x Knipser-Kasten, Bday
2.9 Theo Bday, Armin Bday
6.9 Heili 2x
9.9 Jan 2x
16.9 Kirby Bday, Kevin Bday
23.9 Bryan Bierfass
30.9 Mika, Simon Spielort
21.10 Bday Jens
28.10 Jan Sven
24.3 Holfi, Armin
```

</details>

<details>
<summary>Seite 2 (alte Saison, ignoriert)</summary>

```
31.3 Theo, Frank
14.4 Stefan, Rico, ich
29.4 Mika Kapitän, Zintzschi Matsch
5.5 Paulys (Grätsche und Kapitän)
12.5 Kevin r und Schmu
19.5 Niklas (Schwalbe) und Bryan (Nachwuchs)
26.5 Stefan Shirt Kasten
2.6 Felix (Meisterkist), Daui
7.7 Helbe (Einstand)
22.7 Jakob (Welcome back), Meppe (Triathlon)
28.7 Simon Doppelpack, ich Handy vergessen
4.8 Andi Einstand + Kapitän Mölkau
11.8 Kirby Teamleiter, Jan Trikot vergessen
18.8 Theo Torquote, Hoffi Schlaganfalls Kasten
25.8 Zintzschi Matschrunde Malio, Alex P Spieltag verwechselt
1.9 Kevin r Matschrunde Engelsdorf, Basti Pauli Tempo rausgenommen Kasten
8.9 Felix S und Frank (Shirt auf Bank vergessen)
15.9 Frank und Stefan Kapitän vs Lok
22.9 Rico Matschrunde vs Spielvereinigung, Ali falscher Spielort Kasten
29.9 Welcome back Kasten Helbe, Matschrunde LFC Jakob
13.10 Bryan Stinke Kasten, Nicki endlich wieder da Kasten
20.10 2x Jens 40 Kasten
17.11 Holfi - endlich wieder da Kasten
24.11 Andi H. Jens/Jan verwechselt
1.12 Schmu, zerbrochene Flasche beim Training
8.12 Armin Mareike Kasten
15.12 Schmu, zerbrochene Flasche
4.1 Turnier - Zintzschi Zeugwart Kasten
5.1 Jakob Matschrunde
12.1 Alex Pauly, doppelter Übersteiger
19.1 Jens - endlich wieder da Kasten
16.2 Hoffi Punisher Kasten, Oli Einstand
23.2 Hoffi 2x
9.3 Armin, Theo geborgte Badelatschen liegen gelassen Kasten
```

</details>
