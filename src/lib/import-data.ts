// Rohdaten fuer die Kasten-Historie-Import-Werkstatt (Admin > Import).
// Quelle: docs/kasten-historie-import.md (Seite 3 + "Kaesten offen"),
// Stand nach Jens' Ueberarbeitung vom 14.08.2026. Diese Datei ist die
// Grundlage, aus der "Rohdaten laden" die KastenImportRow-Zeilen erzeugt -
// bei Aenderungen am Dokument hier nachziehen und in der Admin-Seite neu
// laden.

export type RawImportRow = {
  source: "SEITE3" | "OFFEN" | "GUTHABEN";
  rawDate?: string; // z.B. "16.3", nur bei SEITE3
  resolvedDate?: string; // ISO-Datum, nur bei SEITE3 (Jahr 2026 bestaetigt)
  nickname: string;
  reason: string;
  count?: number; // Standard 1
  suggestedPlayerName?: string; // exakter Name im Kader, falls zuordenbar
};

export const RAW_IMPORT_ROWS: RawImportRow[] = [
  // ---------- Seite 3 (Saison 2026, chronologisch) ----------
  { source: "SEITE3", rawDate: "16.3", resolvedDate: "2026-03-16", nickname: "Mole", reason: "Bday 25", suggestedPlayerName: "Matthias Molemans" },
  { source: "SEITE3", rawDate: "23.3", resolvedDate: "2026-03-23", nickname: "Helbe", reason: "Traumtor", suggestedPlayerName: "Philipp Helbig" },
  { source: "SEITE3", rawDate: "30.3", resolvedDate: "2026-03-30", nickname: "Stefan Schreiber", reason: "Doktor Kästen", count: 2, suggestedPlayerName: "Stefan Schreiber" },
  { source: "SEITE3", rawDate: "8.4", resolvedDate: "2026-04-08", nickname: "Kevin R", reason: "", suggestedPlayerName: "Kevin Richter" },
  { source: "SEITE3", rawDate: "8.4", resolvedDate: "2026-04-08", nickname: "Zintzschi", reason: "", suggestedPlayerName: "Sebastian Zintzsch" },
  { source: "SEITE3", rawDate: "13.4", resolvedDate: "2026-04-13", nickname: "Pilzer", reason: "Einstand und erstes Pflichtspiel-Kasten", suggestedPlayerName: "Patrick Pilz" },
  { source: "SEITE3", rawDate: "20.4", resolvedDate: "2026-04-20", nickname: "Felix Schmidt", reason: "einfach so Kästen", suggestedPlayerName: "Felix Schmidt" },
  { source: "SEITE3", rawDate: "20.4", resolvedDate: "2026-04-20", nickname: "Niki", reason: "einfach so Kästen", suggestedPlayerName: "Niklas Cervinka" },
  { source: "SEITE3", rawDate: "27.4", resolvedDate: "2026-04-27", nickname: "Simon", reason: "Teamevent statt Training", suggestedPlayerName: "Simon Ogrisseck" },
  { source: "SEITE3", rawDate: "27.4", resolvedDate: "2026-04-27", nickname: "Jan", reason: "Wasserflasche vergessen" },
  { source: "SEITE3", rawDate: "4.5", resolvedDate: "2026-05-04", nickname: "Schmu", reason: "", suggestedPlayerName: "Stefan Schmidt" },
  { source: "SEITE3", rawDate: "4.5", resolvedDate: "2026-05-04", nickname: "ich (Jens)", reason: "", suggestedPlayerName: "Jens Otto-Langhof" },
  { source: "SEITE3", rawDate: "11.5", resolvedDate: "2026-05-11", nickname: "Meppe", reason: "Schaufel Tor", suggestedPlayerName: "Manuel Rauscher" },
  { source: "SEITE3", rawDate: "11.5", resolvedDate: "2026-05-11", nickname: "Bryan", reason: "Matschrunde Tus II", suggestedPlayerName: "Bryan Sura" },
  { source: "SEITE3", rawDate: "18.5", resolvedDate: "2026-05-18", nickname: "Basti Pauly", reason: "", count: 2, suggestedPlayerName: "Sebastian Pauly" },
  { source: "SEITE3", rawDate: "27.5", resolvedDate: "2026-05-27", nickname: "Frank", reason: "", count: 2, suggestedPlayerName: "Frank Richter" },
  { source: "SEITE3", rawDate: "8.6", resolvedDate: "2026-06-08", nickname: "Rico", reason: "lange keinen Kasten mehr", suggestedPlayerName: "Rico Grundmann" },
  { source: "SEITE3", rawDate: "22.6", resolvedDate: "2026-06-22", nickname: "Kirby", reason: "Schlaganfall und Matschrunde", suggestedPlayerName: "Sebastian Kirmse" },
  { source: "SEITE3", rawDate: "26.6", resolvedDate: "2026-06-26", nickname: "Simon", reason: "Strafkasten", suggestedPlayerName: "Simon Ogrisseck" },
  { source: "SEITE3", rawDate: "26.6", resolvedDate: "2026-06-26", nickname: "Pilzer", reason: "Handtuch vergessen", suggestedPlayerName: "Patrick Pilz" },
  { source: "SEITE3", rawDate: "27.7", resolvedDate: "2026-07-27", nickname: "Jesse", reason: "Einstand", suggestedPlayerName: "Jesse Thalheim" },
  { source: "SEITE3", rawDate: "3.8", resolvedDate: "2026-08-03", nickname: "Bryan", reason: "Physio Kasten", suggestedPlayerName: "Bryan Sura" },
  { source: "SEITE3", rawDate: "10.8", resolvedDate: "2026-08-10", nickname: "Felix Schmidt", reason: "", suggestedPlayerName: "Felix Schmidt" },
  { source: "SEITE3", rawDate: "10.8", resolvedDate: "2026-08-10", nickname: "Mole", reason: "", suggestedPlayerName: "Matthias Molemans" },

  // ---------- Kästen offen (noch nicht eingelöst, kein Datum) ----------
  { source: "OFFEN", nickname: "Jakob", reason: "Matschrunde, Weitschuss statt Torschuss im Training", suggestedPlayerName: "Jakob Hoffmann" },
  { source: "OFFEN", nickname: "Hoffi", reason: "Handtuch vergessen Makrans", suggestedPlayerName: "Andreas Hoffart" },
  { source: "OFFEN", nickname: "R", reason: "Trikotnummerwechsel-Kasten Rotation" },
  { source: "OFFEN", nickname: "Daui", reason: "Matschrunde West 03, Trainingslager verpeilt zweiter Kasten", suggestedPlayerName: "Kevin Dau" },
  { source: "OFFEN", nickname: "Alex", reason: "Matschrunde Training 3.11, DTB Kiste", suggestedPlayerName: "Alexander Pauly" },
  { source: "OFFEN", nickname: "Jörg", reason: "4 Kästen", count: 4 },
  { source: "OFFEN", nickname: "Felle", reason: "Matschrunde Lok" },
  { source: "OFFEN", nickname: "Kevin Richter", reason: "Bday Kasten Ende Juli", suggestedPlayerName: "Kevin Richter" },
  { source: "OFFEN", nickname: "Paulys", reason: "Bday 4.8" },
  { source: "OFFEN", nickname: "Kirby", reason: "Matschrunde Training 3.11", suggestedPlayerName: "Sebastian Kirmse" },
  { source: "OFFEN", nickname: "Frank", reason: "Bday", suggestedPlayerName: "Frank Richter" },
  { source: "OFFEN", nickname: "Stefan Schreiber", reason: "Bday 8.4", suggestedPlayerName: "Stefan Schreiber" },
  { source: "OFFEN", nickname: "Zintzschi", reason: "Matschrunde Markkleeberg", suggestedPlayerName: "Sebastian Zintzsch" },
  { source: "OFFEN", nickname: "Hoffi", reason: "Schach-Kopf Kasten, \"wetten dass wir am Wochenende den Pokal gewonnen haben\" Kiste", suggestedPlayerName: "Andreas Hoffart" },
  { source: "OFFEN", nickname: "Theo", reason: "Emo Kasten (Entschuldigung gegen Markkleeberg)", suggestedPlayerName: "Theo Koch" },
  { source: "OFFEN", nickname: "Schmu", reason: "Neue Schuhe (gegen Lok das erste Mal gesichtet)", suggestedPlayerName: "Stefan Schmidt" },
  { source: "OFFEN", nickname: "Basti Paul", reason: "Comeback Kiste, Matschrunde RS, Matschrunde bei Stefan zu Hause", suggestedPlayerName: "Sebastian Pauly" },
  { source: "OFFEN", nickname: "Hoffi", reason: "das joke Kasten auf dem rooftop in Plagwitz, 2x Quatsch Kasten", count: 2, suggestedPlayerName: "Andreas Hoffart" },
  { source: "OFFEN", nickname: "Jens", reason: "Polnischer Abgang Kasten, Verguckt Kasten, Flasche vergessen Training", suggestedPlayerName: "Jens Otto-Langhof" },
  { source: "OFFEN", nickname: "Frank", reason: "neue Schuhe Markkleeberg (weiß)", suggestedPlayerName: "Frank Richter" },
  { source: "OFFEN", nickname: "Helbe", reason: "Schlaganfall Kasten 3.8 gegen Spielvereinigung", suggestedPlayerName: "Philipp Helbig" },
  { source: "OFFEN", nickname: "Felix Sander", reason: "40. Geburtstag", suggestedPlayerName: "Felix Sander" },
  { source: "OFFEN", nickname: "Zintzschi", reason: "neue Schuhe", suggestedPlayerName: "Sebastian Zintzsch" },
  { source: "OFFEN", nickname: "Philipp neu", reason: "erstes Pflichtspiel Kasten", suggestedPlayerName: "Philipp Kluttig" },
  { source: "OFFEN", nickname: "Jesse", reason: "erstes Pflichtspiel Kasten", suggestedPlayerName: "Jesse Thalheim" },

  // ---------- Guthaben (schon im Voraus gebracht) ----------
  { source: "GUTHABEN", nickname: "Armin", reason: "Guthaben (Kasten im Voraus gebracht)", suggestedPlayerName: "Armin Scheidig" },
  { source: "GUTHABEN", nickname: "Hoffi", reason: "Guthaben (Kasten im Voraus gebracht)", suggestedPlayerName: "Andreas Hoffart" },
];
