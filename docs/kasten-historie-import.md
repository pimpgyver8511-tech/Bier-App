# Kasten-Historie – Rohdaten aus "Volkssport" PDF (Google Doc)

Quelle: `Volkssport_.pdf`, von Jens am 13.08.2026 hochgeladen (bisherige
handische Pflege der Kasten-Historie, vor der Bier App).

**Nächste große Priorität laut Jens (13.08.2026):** Abgleich der
Spieler-Anwesenheit mit der Spielerplus-App. Der frühere automatische
Sync-Versuch (Playwright/Chromium) musste wieder entfernt werden, weil er
auf Vercel die ganze App zum Absturz brachte (siehe Commit-Historie /
README, Abschnitt "Spielerplus-Sync") – dafür braucht es einen anderen
Ansatz (z. B. separater Dienst außerhalb von Vercel). Wird bewusst auf
eine spätere Session verschoben, hier nur als Merker festgehalten.

**Status: noch NICHT in die App importiert.** Diese Datei ist eine
möglichst originalgetreue Abschrift plus eine erste Zuordnungs-Analyse.
Bevor daraus echte `KastenAssignment`-Einträge in der Datenbank werden,
müssen die unten aufgelisteten offenen Fragen geklärt werden (siehe
Abschnitt "Offene Fragen" ganz unten) – sonst verfälscht ein falsch
zugeordneter Kasten die Cooldown-/Fairness-Berechnung der App.

## Wichtigster Vorbehalt: Jahreszahlen sind NICHT im Original enthalten

Im PDF stehen nur Tag.Monat-Daten, keine Jahreszahlen. Die folgende
Jahres-Zuordnung ist eine **Vermutung** von Claude, hergeleitet aus:
- dem heutigen Datum (13.08.2026) und der Tatsache, dass Seite 3 mit
  "10.8" endet, also vermutlich das laufende Jahr 2026 ist
- den "Tus seit"-Beitrittsdaten aus dem Kader (`prisma/seed.ts`):
  Andreas Hoffart trat am 07.07.2026 bei, Philipp Kluttig am 06.08.2026 –
  beide Daten liegen kurz vor den letzten Eintragen auf Seite 3, was zur
  Vermutung "Seite 3 = 2026" passt
- der Beobachtung, dass jede Seite dort weitermacht, wo die vorherige
  aufgehört hat (z. B. Seite 1 endet 24.3, Seite 2 beginnt 31.3 – eine
  Woche später, gleiche Saison)

Daraus ergibt sich folgende **Hypothese** (bitte im Gespräch bestätigen!):

| Abschnitt | Vermutete Zeitspanne |
|---|---|
| Seite 1 (bis "28.10") | 25.03.2024 – 28.10.2024 |
| Seite 1, letzte Zeile ("24.3") | 24.03.2025 (erstes Spiel der Folgesaison) |
| Seite 2 | 31.03.2025 – 09.03.2026 |
| Seite 3 | 16.03.2026 – 10.08.2026 (aktuelle/laufende Saison) |

## Seite 1 (vermutlich 2024, letzte Zeile 2025)

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

## Seite 2 (vermutlich 2025, letzte Zeile März 2026)

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

## Seite 3 (vermutlich 2026, laufende Saison)

```
16.3 Mole Bday 25, Daui TL verpeilt
23.3 Helbe Traumtor, Holfi Bälle vergessen
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
Kasten-Schulden – vermutlich der aktuellste, wichtigste Teil für den
Direkt-Import in die App:

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
```

Direkt danach im Original, ohne weitere Erklärung:

```
Armin: -1
Hoffi: -1
7 Kästen verfügbar
```

**Unklar** (siehe offene Fragen): ob "-1" bedeutet, dass Armin/Hoffi einen
Kasten *im Guthaben* haben (schon einen zu viel gebracht) oder *im Minus*
sind (einen zu wenig / schulden noch einen zusätzlichen). "7 Kästen
verfügbar" vermutlich die Anzahl aktuell eingelagerter/vorrätiger Kästen.

## Kohlfahrt (vermutlich eigenes Event, nicht Teil der Spieltags-Kastenliste)

```
Matscher - Matsch
Präsi - Matsch
Bryan - Matsch
Schmu/Uwe - Matsch

Hoffi
Zintzsch, Bryan, Pilzer, Kevin, Sasch, Theo 18.14 Uhr - 14 min zu spät
```

Wirkt nach einer separaten Tradition/Veranstaltung (Kohlfahrt = Winter-
Wandertour mit anschließender Feier), nicht nach regulärem Spieltags-
Bierdienst. "Matsch" hier vermutlich eine Rollenzuteilung für die Kohlfahrt
selbst, nicht "Matschrunde" (Trainingsrunde) wie in den anderen Abschnitten.
Ob das überhaupt in die Kasten-Historie der App gehört: **bitte im
Gespräch klären.**

## Spitznamen → Kader-Zuordnung (Ersteinschätzung)

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
| Sascha, Sasch | Sascha Holfert | ✅ |
| Jakob | Jakob Hoffmann | ✅ |
| Armin | Armin Scheidig | ✅ |
| Jesse | Jesse Thalheim | ✅ |
| Niklas, Niki | Niklas Cervinka | ✅ |
| Pilzer, Pilz | Patrick Pilz | ✅ |
| Kevin r, Kevin R, Kevin Richter | Kevin Richter | ✅ |
| Felix Sander | Felix Sander | ✅ |
| Felix Schmidt, Felix S | Felix Schmidt | ✅ |
| Felix/Felix | Felix Sander **und** Felix Schmidt (beide gemeinsam) | ✅ |
| Stefan Schreiber | Stefan Schreiber | ✅ |
| Philipp neu | vermutlich Philipp Kluttig (Beitritt 06.08.2026, passt zeitlich) | ⚠️ |
| Holfi | Sascha Holfert? (evtl. zweiter Spitzname derselben Person) | ⚠️ |
| Nicki | Niklas Cervinka (Schreibvariante von "Niki")? | ⚠️ |
| Andi, Andi H. | Andreas Hoffart (nochmal, andere Schreibweise)? Oder eigene Person? | ⚠️ |
| Stefan (ohne Nachname) | Stefan Schmidt **oder** Stefan Schreiber | ❓ |
| Kevin (ohne Zusatz) | Kevin Dau **oder** Kevin Richter | ❓ |
| Schmu | nicht eindeutig im Kader (evtl. "Schmidt"-Spitzname, aber welcher?) | ❓ |
| Felle | nicht eindeutig – evtl. Philipp Helbig, evtl. jemand anderes | ❓ |
| Helbe | vermutlich Philipp Helbig (Nachname → Spitzname) | ⚠️ |
| R (Trikotnummerwechsel) | evtl. Kevin Richter | ❓ |
| Jan, Jan Sven | nicht im aktuellen Kader (evtl. ausgeschieden) | ❓ |
| Kirby | nicht im aktuellen Kader | ❓ |
| Heili | nicht im aktuellen Kader | ❓ |
| Mika | nicht im aktuellen Kader | ❓ |
| Daui | nicht im aktuellen Kader | ❓ |
| Köppi | nicht im aktuellen Kader | ❓ |
| Ali | nicht im aktuellen Kader | ❓ |
| Meppe | nicht im aktuellen Kader | ❓ |
| Oli | nicht im aktuellen Kader | ❓ |
| Jörg | nicht im aktuellen Kader | ❓ |
| Mareike | wirkt wie Partnerin/Person außerhalb Kader ("Armin Mareike Kasten") | ❓ |

## Offene Fragen für die nächste Session

1. **Jahreszahlen bestätigen** – stimmt die Hypothese oben (Seite 1 = 2024,
   Seite 2 = 2025/26, Seite 3 = 2026)?
2. **Unklare Spitznamen auflösen** (❓ in der Tabelle) – wer ist Jan, Kirby,
   Heili, Mika, Daui, Köppi, Ali, Meppe, Oli, Jörg, Schmu, Felle? Noch im
   Team? Falls nicht mehr aktiv: trotzdem als (inaktiver) Spieler anlegen,
   damit die Historie stimmt, oder ignorieren?
3. **"Stefan" und "Kevin" ohne Nachnamen** – jeweils Schmidt/Schreiber bzw.
   Dau/Richter, wahrscheinlich lässt sich das über den Kontext (Gegner,
   Datum) auflösen, braucht aber Jens' Ortskenntnis.
4. **Bedeutung von "Armin: -1" / "Hoffi: -1"** – Guthaben oder Schulden?
5. **"7 Kästen verfügbar"** – einfach nur Lagerbestand, für die App-Logik
   irrelevant, oder soll das irgendwo abgebildet werden?
6. **Kohlfahrt-Abschnitt** – gehört das überhaupt zur Kasten-Historie oder
   ist das ein komplett separates Vereinsritual, das wir ignorieren sollten?
7. **"2x"-Einträge** – sollen die als zwei separate `KastenAssignment`-
   Zeilen importiert werden (für korrekte "Kästen insgesamt"-Zählung)?
8. **Kein Match-Bezug** – die App verknüpft jeden Kasten mit einem
   `Match`-Datensatz (Datum, Gegner). Für den Import müssten wir entweder
   rückwirkend Matches für all diese Daten anlegen (nur Datum, Gegner
   optional) oder das Datenmodell so anpassen, dass ein Kasten auch ohne
   Match-Bezug historisch erfasst werden kann.

## Empfehlung fürs weitere Vorgehen

Sobald die obigen Fragen geklärt sind: ein einmaliges Import-Script
(ähnlich `prisma/seed.ts`) schreiben, das für jede Zeile hier einen
`Match` (nur mit Datum) plus die zugehörigen `KastenAssignment`-Einträge
anlegt. Der Abschnitt "Kästen offen" sollte vermutlich mit
`fulfilled: false` importiert werden (die sind ja noch nicht eingelöst),
alles andere mit `fulfilled: true` (bereits mitgebrachte Kästen der
Vergangenheit).
