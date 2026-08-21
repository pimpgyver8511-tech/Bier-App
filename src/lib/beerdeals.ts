import { prisma } from "@/lib/db";

export type BeerDealsSyncResult = {
  ok: boolean;
  message: string;
  count: number;
};

const STORES = [
  "Kaufland",
  "Rewe",
  "Edeka",
  "Globus",
  "Netto",
  "Penny",
  "Aldi Nord",
  "Aldi Süd",
  "Aldi",
  "Lidl",
  "real",
  "Marktkauf",
  "Combi",
  "famila",
  "tegut",
  "Konsum",
  "Diska",
  "Trinkgut",
  "Getränkeland",
  "Getränke Hoffmann",
  "N.P. Discount",
  "NP Discount",
  "nah und gut",
  "nah & gut",
  "alldrink",
];

/**
 * aktionspreis.de hat keine offizielle API. Die Gruppen-Seite
 * (/gruppe/bierkasten-angebote, alle Marken gemeinsam) waere zwar ideal,
 * um nicht auf einzelne Marken beschraenkt zu sein, filtert den Ort aber
 * ueber ein Cookie/localStorage statt ueber die URL (per Screenshot vom
 * Nutzer bestaetigt: die URL enthaelt keine PLZ) - von einer Vercel-
 * Funktion aus (kein Browser, kein gespeichertes Cookie) laesst sich
 * Leipzig darueber nicht zuverlaessig anfragen. Die Marken-Einzelseiten
 * akzeptieren dagegen nachweislich ein "/leipzig"-Suffix in der URL,
 * deshalb werden mehrere bekannte Marken einzeln abgefragt (unten
 * moeglichst breit gehalten, um die Anzeige nicht auf wenige Marken zu
 * verengen).
 *
 * Haendlernamen stehen auf der Detailseite teils nur als Logo-Bild
 * (z.B. "N.P. Discount", "nah & gut" im Tiefstpreis-Kasten) statt als
 * sichtbarer Text - deshalb wird beim Parsen zusaetzlich der alt-/
 * title-Text von <img>/<a> ausgelesen, bevor Tags entfernt werden.
 */
const BRAND_SOURCES: { brand: string; url: string }[] = [
  { brand: "Hasseröder", url: "https://www.aktionspreis.de/angebote/hasseroeder-kasten-20-x-0-5l/leipzig" },
  { brand: "Warsteiner", url: "https://www.aktionspreis.de/angebote/warsteiner-kasten-20-x-0-5l/leipzig" },
  { brand: "Radeberger", url: "https://www.aktionspreis.de/angebote/radeberger-kasten-20-x-0-5l/leipzig" },
  { brand: "Krombacher", url: "https://www.aktionspreis.de/angebote/krombacher-kasten-20-x-0-5l/leipzig" },
  { brand: "Ur-Krostitzer", url: "https://www.aktionspreis.de/angebote/ur-krostitzer-kasten-20-x-0-5l/leipzig" },
  { brand: "Sternburg", url: "https://www.aktionspreis.de/angebote/sternburg-kasten-20-x-0-5l/leipzig" },
  { brand: "Spaten", url: "https://www.aktionspreis.de/angebote/spaten-20-x-0-5l/leipzig" },
  { brand: "Oettinger", url: "https://www.aktionspreis.de/angebote/oettinger-kasten-20-x-0-5l/leipzig" },
  { brand: "Bitburger", url: "https://www.aktionspreis.de/angebote/bitburger-kasten-20-x-0-5l/leipzig" },
  { brand: "Heineken", url: "https://www.aktionspreis.de/angebote/heineken-kasten-20-x-0-4l/leipzig" },
  { brand: "Berliner Pilsner", url: "https://www.aktionspreis.de/angebote/berliner-pilsner-kasten-20-x-0-5l/leipzig" },
  { brand: "Pilsner Urquell", url: "https://www.aktionspreis.de/angebote/pilsner-urquell-kasten-20-x-0-5l/leipzig" },
  { brand: "Lübzer", url: "https://www.aktionspreis.de/angebote/luebzer-kasten-20-x-0-5l/leipzig" },
  { brand: "Benediktiner", url: "https://www.aktionspreis.de/angebote/benediktiner-kasten-20-x-0-5l/leipzig" },
];

function flattenHtml(html: string): string {
  const withoutScripts = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ");
  // Alt-/Title-Text von Bildern und Links VOR dem Tag-Strip in den
  // Fliesstext ziehen, damit Logo-only-Haendlernamen nicht verloren
  // gehen (siehe Kommentar oben).
  const withAltText = withoutScripts.replace(
    /<(?:img|a)\b[^>]*?\b(?:alt|title)="([^"]*)"[^>]*>/gi,
    (_m, text: string) => ` ${text} `
  );
  return withAltText
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

/** Findet die Position des naechstgelegenen Haendlernamens zu einem Index (oder null). */
function findClosestStore(
  lower: string,
  centerIdx: number,
  radius: number
): { store: string; distance: number } | null {
  let best: { store: string; distance: number } | null = null;
  for (const store of STORES) {
    const needle = store.toLowerCase();
    const from = Math.max(0, centerIdx - radius);
    const to = Math.min(lower.length, centerIdx + radius);
    const segment = lower.slice(from, to);
    let searchFrom = 0;
    let idx: number;
    while ((idx = segment.indexOf(needle, searchFrom)) !== -1) {
      const absoluteIdx = from + idx;
      const distance = Math.abs(absoluteIdx - centerIdx);
      if (!best || distance < best.distance) best = { store, distance };
      searchFrom = idx + 1;
    }
  }
  return best;
}

/** Sucht rund um jeden Preistreffer nach dem naechstgelegenen Haendlernamen. */
function extractBrandOffers(html: string): { store: string; price: number }[] {
  const text = flattenHtml(html);
  const lower = text.toLowerCase();
  const results: { store: string; price: number }[] = [];
  const priceRegex = /(\d{1,2}),(\d{2})\s?€/g;
  let match: RegExpExecArray | null;
  while ((match = priceRegex.exec(text))) {
    const price = Number(match[1]) + Number(match[2]) / 100;
    // Plausibilitaetsfilter: ein Bierkasten kostet realistisch zwischen
    // 3 und 40 Euro - filtert Pfandbetraege etc. heraus.
    if (price < 3 || price > 40) continue;

    // UVP-Vergleichswerte (durchgestrichener Originalpreis) sind kein
    // echtes Angebot - werden anhand des "uvp"-Textes kurz davor erkannt.
    const immediatelyBefore = lower.slice(Math.max(0, match.index - 15), match.index);
    if (immediatelyBefore.includes("uvp")) continue;

    const closest = findClosestStore(lower, match.index, 120);
    if (!closest) continue;

    results.push({ store: closest.store, price });
  }
  return results;
}

// Ein selbst erklaerender Bot-User-Agent wird von Preisvergleichsseiten
// haeufig erkannt und blockiert/mit leerem Inhalt beantwortet (alle 14
// Marken gleichzeitig null Treffer deutete genau darauf hin) - deshalb
// wird hier ein normaler Browser-User-Agent samt typischer Browser-
// Header verwendet.
async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      "Accept-Language": "de-DE,de;q=0.9,en;q=0.8",
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

export async function syncBeerDeals(): Promise<BeerDealsSyncResult> {
  const collected: { brand: string; store: string; price: number; sourceUrl: string }[] = [];
  const errors: string[] = [];

  for (const { brand, url } of BRAND_SOURCES) {
    try {
      const html = await fetchText(url);
      const offers = extractBrandOffers(html);
      for (const o of offers) {
        collected.push({ brand, store: o.store, price: o.price, sourceUrl: url });
      }
      if (offers.length === 0) {
        // Kurze Antwort deutet auf eine Block-/Weiterleitungsseite statt
        // echtem Inhalt hin (z.B. Bot-Schutz) - hilft bei der Diagnose,
        // ob es an der Erkennung oder am Zugriff selbst liegt.
        const priceHits = (html.match(/\d{1,2},\d{2}\s?€/g) ?? []).length;
        errors.push(
          `${brand}: keine Treffer (Antwort ${html.length} Zeichen, ${priceHits} Preis-Muster gefunden)`
        );
      }
    } catch (err) {
      errors.push(`${brand}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const now = new Date();

  if (collected.length === 0) {
    const message =
      "Keine Angebote gefunden." + (errors.length ? " Details: " + errors.join("; ") : "");
    await prisma.beerDealsConfig.upsert({
      where: { id: 1 },
      update: { lastSyncAt: now, lastSyncOk: false, lastSyncMsg: message },
      create: { id: 1, lastSyncAt: now, lastSyncOk: false, lastSyncMsg: message },
    });
    return { ok: false, message, count: 0 };
  }

  await prisma.$transaction([
    prisma.beerDeal.deleteMany({}),
    prisma.beerDeal.createMany({ data: collected }),
  ]);

  const message =
    `${collected.length} Angebot(e) von ${BRAND_SOURCES.length} Marken abgerufen.` +
    (errors.length ? ` (${errors.length} ohne Treffer/Fehler)` : "");
  await prisma.beerDealsConfig.upsert({
    where: { id: 1 },
    update: { lastSyncAt: now, lastSyncOk: true, lastSyncMsg: message },
    create: { id: 1, lastSyncAt: now, lastSyncOk: true, lastSyncMsg: message },
  });

  return { ok: true, message, count: collected.length };
}

export async function getTopBeerDeals(limit = 10) {
  return prisma.beerDeal.findMany({
    orderBy: { price: "asc" },
    take: limit,
  });
}

export async function getBeerDealsConfig() {
  return prisma.beerDealsConfig.findUnique({ where: { id: 1 } });
}
