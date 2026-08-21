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
];

/**
 * aktionspreis.de listet unter /gruppe/bierkasten-angebote alle aktuell
 * beworbenen Bierkaesten unabhaengig von der Marke (bewusst gewaehlt
 * statt einzelner Marken-Seiten, damit die Anzeige nicht auf eine feste
 * Markenliste begrenzt ist) - anders als die Marken-Seiten (die ein
 * "/leipzig"-Suffix akzeptieren) hat diese Gruppen-Seite KEIN
 * Stadt-Suffix (fuehrte zu HTTP 404, korrigiert). Ob/wie sie nach Ort
 * filtert (IP-basiert, "aus Ihrer Naehe") ist unklar - deshalb wird der
 * Text zusaetzlich nach "Leipzig" gefiltert, falls die Seite mehrere
 * Staedte gleichzeitig auflistet; taucht "Leipzig" gar nicht im Text
 * auf, wird angenommen, dass die Seite schon (anderweitig) lokal
 * gefiltert ist und alle Treffer werden uebernommen. Keine offizielle
 * API - die Seite wird als HTML abgerufen und Marke/Preis/Haendler per
 * Text-Mustererkennung extrahiert (ohne Annahmen ueber konkrete
 * CSS-Klassen, da die genaue Seitenstruktur beim Schreiben dieses Codes
 * nicht einsehbar war).
 */
const GROUP_URL = "https://www.aktionspreis.de/gruppe/bierkasten-angebote";

// Nur als Rueckfallebene, falls die Gruppen-Seite gar nichts liefert -
// deckt dann wenigstens diese (per Suche bestaetigten) Marken fuer
// Leipzig ab, statt komplett leer zu bleiben.
const FALLBACK_SOURCES: { brand: string; url: string }[] = [
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
];

function flattenHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanBrandCandidate(raw: string): string | null {
  // Nimmt die letzten paar Woerter vor dem Haendlernamen als
  // Marken-/Produktbezeichnung, schneidet Fuellwoerter am Rand ab.
  const words = raw.trim().split(" ").filter(Boolean);
  const candidate = words.slice(-6).join(" ").replace(/^[-–,.:;|]+|[-–,.:;|]+$/g, "").trim();
  if (candidate.length < 2 || candidate.length > 60) return null;
  if (!/[a-zA-ZäöüÄÖÜß]/.test(candidate)) return null;
  return candidate;
}

const LEIPZIG_MARKERS = [
  "leipzig",
  "leutzsch",
  "plagwitz",
  "grünau",
  "reudnitz",
  "schönefeld",
  "connewitz",
  "gohlis",
];

/** Extrahiert {brand, store, price}-Tripel aus der Gruppen-Seite (alle Marken). */
function extractGroupOffers(html: string): { brand: string; store: string; price: number }[] {
  const text = flattenHtml(html);
  const textLower = text.toLowerCase();
  // Listet die Seite mehrere Staedte (erkennbar an "leipzig" irgendwo im
  // Text), wird pro Treffer zusaetzlich auf Leipzig-Naehe geprueft.
  // Kommt "leipzig" gar nicht vor, ist die Seite vermutlich schon
  // anderweitig lokal gefiltert - dann wird nicht weiter eingeschraenkt.
  const multiCityPage = textLower.includes("leipzig");

  const results: { brand: string; store: string; price: number }[] = [];
  const priceRegex = /(\d{1,2}),(\d{2})\s?€/g;
  let prevEnd = 0;
  let match: RegExpExecArray | null;
  while ((match = priceRegex.exec(text))) {
    const price = Number(match[1]) + Number(match[2]) / 100;
    const chunk = text.slice(prevEnd, match.index);
    const chunkStart = prevEnd;
    prevEnd = match.index + match[0].length;

    // Plausibilitaetsfilter: ein Bierkasten kostet realistisch zwischen
    // 3 und 40 Euro - filtert Pfandbetraege, Versandkosten etc. heraus.
    if (price < 3 || price > 40) continue;

    const lower = chunk.toLowerCase();
    const store = STORES.find((s) => lower.includes(s.toLowerCase()));
    if (!store) continue;

    if (multiCityPage) {
      // Weiterer Suchradius um den Preis herum (Ort steht oft direkt
      // neben Haendler/Preis, nicht zwingen im selben Chunk davor).
      const wideWindow = textLower.slice(
        Math.max(0, chunkStart - 200),
        Math.min(textLower.length, prevEnd + 200)
      );
      const nearLeipzig = LEIPZIG_MARKERS.some((m) => wideWindow.includes(m));
      if (!nearLeipzig) continue;
    }

    const storeIdx = lower.lastIndexOf(store.toLowerCase());
    const brandRaw = chunk.slice(0, storeIdx);
    const brand = cleanBrandCandidate(brandRaw);
    if (!brand) continue;

    results.push({ brand, store, price });
  }
  return results;
}

/** Rueckfall: eine bekannte Marken-Seite liefert nur store+price, Marke steht schon fest. */
function extractSingleBrandOffers(html: string): { store: string; price: number }[] {
  const text = flattenHtml(html);
  const results: { store: string; price: number }[] = [];
  const priceRegex = /(\d{1,2}),(\d{2})\s?€/g;
  let match: RegExpExecArray | null;
  while ((match = priceRegex.exec(text))) {
    const price = Number(match[1]) + Number(match[2]) / 100;
    if (price < 3 || price > 40) continue;
    const windowStart = Math.max(0, match.index - 120);
    const context = text.slice(windowStart, match.index).toLowerCase();
    const store = STORES.find((s) => context.includes(s.toLowerCase()));
    if (store) results.push({ store, price });
  }
  return results;
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; BierAppBot/1.0)" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

export async function syncBeerDeals(): Promise<BeerDealsSyncResult> {
  const collected: { brand: string; store: string; price: number; sourceUrl: string }[] = [];
  const errors: string[] = [];
  let usedFallback = false;

  try {
    const html = await fetchText(GROUP_URL);
    for (const o of extractGroupOffers(html)) {
      collected.push({ brand: o.brand, store: o.store, price: o.price, sourceUrl: GROUP_URL });
    }
  } catch (err) {
    errors.push(`Gruppen-Seite: ${err instanceof Error ? err.message : String(err)}`);
  }

  if (collected.length === 0) {
    usedFallback = true;
    for (const { brand, url } of FALLBACK_SOURCES) {
      try {
        const html = await fetchText(url);
        for (const o of extractSingleBrandOffers(html)) {
          collected.push({ brand, store: o.store, price: o.price, sourceUrl: url });
        }
      } catch (err) {
        errors.push(`${brand}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  const now = new Date();

  if (collected.length === 0) {
    const message =
      "Keine Angebote gefunden." + (errors.length ? " Fehler: " + errors.join("; ") : "");
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

  const message = usedFallback
    ? `${collected.length} Angebot(e) über Rückfall-Markenliste abgerufen (Gruppen-Seite lieferte nichts).`
    : `${collected.length} Angebot(e) über alle Marken abgerufen.`;
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
