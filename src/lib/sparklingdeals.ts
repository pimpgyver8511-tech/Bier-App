import { prisma } from "@/lib/db";
import {
  buildOfferUrl,
  buildOfferUrlFromParts,
  extractHitLeaflets,
  extractNextData,
  fetchBrochurePages,
  fetchText,
  parseDate,
  searchBrochureIds,
  type KaufdaBrochurePagesResponse,
} from "@/lib/beerdeals";

export type SparklingDealsSyncResult = {
  ok: boolean;
  message: string;
  count: number;
};

/**
 * Sekt-/Prosecco-Angebote fuer eine nicht verlinkte Spass-Seite - gleiche
 * Quellen wie die Bierangebote (kaufda.de-Kategorie-/Markenseiten, kaufda-
 * Prospektsuche, HIT-Wochenprospekt), aber eigene Tabelle und eigener
 * Sync, damit die Bierangebote der Mannschaft davon unberuehrt bleiben.
 * Nicht existierende Markenseiten fallen im Sync einfach als Fehler raus,
 * ohne den Rest zu blockieren.
 */
const KAUFDA_SPARKLING_SOURCES = [
  "Sekt",
  "Prosecco",
  "Champagner",
  "Rotkaeppchen",
  "Freixenet",
  "Mumm",
  "Henkell",
  "Soehnlein",
  "Kupferberg",
  "Schloss-Wachenheim",
  "Mionetto",
  "Fuerst-von-Metternich",
  "Moet-Chandon",
].map((slug) => `https://www.kaufda.de/Leipzig/Angebote/${slug}`);

const KAUFDA_SEARCH_QUERIES = ["Sekt", "Prosecco"];

// Ohne Kategorie-Filter: Sekt liegt bei HIT nicht zwingend in derselben
// Prospekt-Kategorie wie Bier ("Getraenke", 1803).
const HIT_ALL_OFFERS_URL = "https://www.hit.de/maerkte/leipzig/angebote";

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

const SPARKLING_KEYWORDS = [
  "sekt",
  "prosecco",
  "schaumwein",
  "perlwein",
  "cremant",
  "cava",
  "champagner",
  "champagne",
  "spumante",
  "frizzante",
  "secco",
  "pikkolo",
];

// Typische Sekt-Marken, deren Angebotstext nicht immer selbst "Sekt" o.ae.
// enthaelt (z.B. "Henkell Trocken", "Söhnlein Brillant").
const SPARKLING_BRANDS = [
  "rotkappchen",
  "freixenet",
  "mumm",
  "henkell",
  "sohnlein",
  "kupferberg",
  "wachenheim",
  "metternich",
  "mionetto",
  "moet",
  "veuve clicquot",
  "kessler",
];

// Treffer auf die Stichworte oben, die aber kein Getraenk sind (Insekten-
// schutz enthaelt "sekt", Sektglaeser, Champagner-Trueffel, ...).
const NON_DRINK_WORDS = [
  "insekt",
  "sektglas",
  "glaser",
  "kelch",
  "flote",
  "kuhler",
  "truffel",
  "praline",
  "schoko",
  "bonbon",
  "fruchtgummi",
  "senf",
  "essig",
  "kerze",
  "sorbet",
  "susswaren",
];

function isSparkling(rawText: string): boolean {
  const text = normalizeText(rawText);
  if (NON_DRINK_WORDS.some((w) => text.includes(w))) return false;
  if (SPARKLING_KEYWORDS.some((w) => text.includes(w))) return true;
  if (SPARKLING_BRANDS.some((b) => text.includes(b))) {
    // Reine Markentreffer ohne Sekt-Stichwort: Stillwein derselben Marke
    // (z.B. "Rotkäppchen Qualitätswein") nicht mitnehmen.
    return !text.replace(/schaumwein|perlwein/g, "").includes("wein");
  }
  return false;
}

function buildTitle(brand: string | undefined, name: string | undefined): string {
  const b = (brand ?? "").trim();
  const n = (name ?? "").trim().replace(/\s*\n\s*/g, " ");
  if (!b) return n;
  if (!n) return b;
  return normalizeText(n).includes(normalizeText(b)) ? n : `${b} ${n}`;
}

function cleanDetails(value: string | undefined): string | null {
  if (!value) return null;
  const cleaned = value
    .split(/\n+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" · ");
  if (!cleaned) return null;
  return cleaned.length > 140 ? `${cleaned.slice(0, 137)}…` : cleaned;
}

function isPlausiblePrice(price: number | undefined): price is number {
  return typeof price === "number" && Number.isFinite(price) && price >= 1 && price <= 80;
}

type SparklingOffer = {
  id: string;
  title: string;
  details: string | null;
  store: string;
  price: number;
  sourceUrl: string;
  offerUrl: string | null;
  brochureId: string | null;
  validFrom: Date | null;
  validUntil: Date | null;
};

function extractKaufdaPageOffers(html: string, sourceUrl: string): SparklingOffer[] {
  const items = extractNextData(html)?.props?.pageProps?.pageInformation?.offers?.main?.items ?? [];
  const results: SparklingOffer[] = [];
  for (const item of items) {
    if (!isSparkling([item.brand, item.title, item.description].filter(Boolean).join(" "))) continue;
    const price = item.prices?.mainPrice;
    const title = buildTitle(item.brand, item.title);
    if (!item.id || !item.publisherName || !title || !isPlausiblePrice(price)) continue;
    results.push({
      id: `kaufda-${item.id}`,
      title,
      details: cleanDetails(item.description),
      store: item.publisherName,
      price,
      sourceUrl,
      offerUrl: buildOfferUrl(item),
      brochureId: item.parentContent?.id ?? null,
      validFrom: parseDate(item.validFrom),
      validUntil: parseDate(item.validUntil),
    });
  }
  return results;
}

function extractKaufdaBrochureOffers(data: KaufdaBrochurePagesResponse): SparklingOffer[] {
  const results: SparklingOffer[] = [];
  for (const pageEntry of data.contents ?? []) {
    for (const offer of pageEntry.offers ?? []) {
      const content = offer.content;
      const product = content?.products?.[0];
      if (!content || !product) continue;
      const description = product.description?.map((d) => d.paragraph ?? "").join("\n");
      const categories = (product.categoryPaths ?? []).map((c) => c.name ?? "").join(" ");
      if (!isSparkling([product.brandName, product.name, description, categories].filter(Boolean).join(" "))) {
        continue;
      }
      const salesPrice = content.deals?.find((d) => d.type === "SALES_PRICE");
      const price = salesPrice?.min ?? salesPrice?.max;
      const store = content.publisher?.name;
      const title = buildTitle(product.brandName, product.name);
      if (!content.id || !store || !title || !isPlausiblePrice(price)) continue;
      const brochureId = content.parentContent?.id;
      const validity = content.publicationProfiles?.[0]?.validity;
      results.push({
        id: `kaufda-${content.id}`,
        title,
        details: cleanDetails(description),
        store,
        price,
        sourceUrl: "https://www.kaufda.de/api/search",
        offerUrl: buildOfferUrlFromParts(brochureId, content.parentContent?.page?.number, content.id),
        brochureId: brochureId ?? null,
        validFrom: parseDate(validity?.startDate),
        validUntil: parseDate(validity?.endDate),
      });
    }
  }
  return results;
}

function extractHitSparklingOffers(html: string): { offers: SparklingOffer[]; leafletCount: number } {
  const { leaflets } = extractHitLeaflets(html);
  const results: SparklingOffer[] = [];
  for (const leaflet of leaflets) {
    if (!leaflet.id || !leaflet.headline) continue;
    if (!isSparkling(`${leaflet.headline} ${leaflet.text ?? ""}`)) continue;
    const price = Number(leaflet.price);
    if (!isPlausiblePrice(price)) continue;
    results.push({
      id: `hit-${leaflet.id}`,
      title: leaflet.headline.trim().replace(/\s*\n\s*/g, " "),
      details: cleanDetails(leaflet.text),
      store: "HIT",
      price,
      sourceUrl: HIT_ALL_OFFERS_URL,
      offerUrl: leaflet.url ?? null,
      brochureId: null,
      validFrom: parseDate(leaflet.validFrom),
      validUntil: parseDate(leaflet.validTo),
    });
  }
  return { offers: results, leafletCount: leaflets.length };
}

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export async function syncSparklingDeals(): Promise<SparklingDealsSyncResult> {
  const collected = new Map<string, SparklingOffer>();
  const errors: string[] = [];

  // Laeuft parallel zu den kaufda-Abrufen und wird erst spaeter ausgewertet -
  // allSettled statt eines nackten Promise, damit ein frueher Fehlschlag
  // nicht als unbehandelte Rejection endet, bevor er unten abgefragt wird.
  const hitPromise = Promise.allSettled([fetchText(HIT_ALL_OFFERS_URL).then(extractHitSparklingOffers)]);
  const searchPromise = Promise.allSettled(KAUFDA_SEARCH_QUERIES.map((q) => searchBrochureIds(q)));

  const pageResults = await Promise.allSettled(
    KAUFDA_SPARKLING_SOURCES.map(async (url) => extractKaufdaPageOffers(await fetchText(url), url))
  );
  let pageHits = 0;
  pageResults.forEach((result, i) => {
    if (result.status === "rejected") {
      errors.push(`${KAUFDA_SPARKLING_SOURCES[i]}: ${errorText(result.reason)}`);
      return;
    }
    for (const o of result.value) {
      if (!collected.has(o.id)) {
        collected.set(o.id, o);
        pageHits++;
      }
    }
  });

  let hitCount = 0;
  let hitInfo = "";
  const [hitResult] = await hitPromise;
  if (hitResult.status === "fulfilled") {
    const { offers, leafletCount } = hitResult.value;
    hitCount = offers.length;
    if (leafletCount === 0) hitInfo = " HIT: keine Angebote auf der Seite gefunden.";
    for (const o of offers) collected.set(o.id, o);
  } else {
    hitInfo = ` HIT: ${errorText(hitResult.reason)}.`;
    errors.push(`HIT: ${errorText(hitResult.reason)}`);
  }

  const brochureIds = new Set<string>();
  for (const o of collected.values()) if (o.brochureId) brochureIds.add(o.brochureId);
  for (const result of await searchPromise) {
    if (result.status === "fulfilled") {
      for (const id of result.value) brochureIds.add(id);
    } else {
      errors.push(`kaufda-Suche: ${errorText(result.reason)}`);
    }
  }

  // Prospekt-Daten haben die genauere (tagesgenaue) Gueltigkeit und
  // ueberschreiben deshalb Eintraege mit gleicher Angebots-ID von oben.
  const brochureResults = await Promise.allSettled(
    Array.from(brochureIds, async (id) => extractKaufdaBrochureOffers(await fetchBrochurePages(id)))
  );
  let brochureHits = 0;
  for (const result of brochureResults) {
    if (result.status === "rejected") {
      errors.push(`Prospekt: ${errorText(result.reason)}`);
      continue;
    }
    for (const o of result.value) {
      if (!collected.has(o.id)) brochureHits++;
      collected.set(o.id, o);
    }
  }

  const seen = new Set<string>();
  const deals = Array.from(collected.values())
    .filter((d) => {
      const key = `${normalizeText(d.title)}|${normalizeText(d.store)}|${d.price}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((d) => ({
      title: d.title,
      details: d.details,
      store: d.store,
      price: d.price,
      sourceUrl: d.sourceUrl,
      offerUrl: d.offerUrl,
      validFrom: d.validFrom,
      validUntil: d.validUntil,
    }));

  const now = new Date();
  if (deals.length === 0) {
    const message =
      "Keine Angebote gefunden." + (errors.length ? " Details: " + errors.slice(0, 10).join("; ") : "");
    await prisma.sparklingDealsConfig.upsert({
      where: { id: 1 },
      update: { lastSyncAt: now, lastSyncOk: false, lastSyncMsg: message },
      create: { id: 1, lastSyncAt: now, lastSyncOk: false, lastSyncMsg: message },
    });
    return { ok: false, message, count: 0 };
  }

  await prisma.$transaction([
    prisma.sparklingDeal.deleteMany({}),
    prisma.sparklingDeal.createMany({ data: deals }),
  ]);

  const message =
    `${deals.length} Angebot(e): ${pageHits} von kaufda-Seiten, ${brochureHits} zusätzlich aus ` +
    `${brochureIds.size} Prospekten, ${hitCount} von HIT.` +
    (errors.length ? ` (${errors.length} Quellen ohne Treffer/Fehler)` : "") +
    hitInfo;
  await prisma.sparklingDealsConfig.upsert({
    where: { id: 1 },
    update: { lastSyncAt: now, lastSyncOk: true, lastSyncMsg: message },
    create: { id: 1, lastSyncAt: now, lastSyncOk: true, lastSyncMsg: message },
  });
  return { ok: true, message, count: deals.length };
}

export type SparklingDeal = {
  id: string;
  title: string;
  details: string | null;
  store: string;
  price: number;
  offerUrl: string | null;
};

/** Aktuell gueltige Angebote, guenstigste zuerst (gleiche Gueltigkeitslogik wie Bier). */
export async function getAllSparklingDeals(): Promise<SparklingDeal[]> {
  const now = new Date();
  return prisma.sparklingDeal.findMany({
    where: {
      AND: [
        { OR: [{ validFrom: null }, { validFrom: { lte: now } }] },
        { OR: [{ validUntil: null }, { validUntil: { gte: now } }] },
      ],
    },
    orderBy: { price: "asc" },
    select: { id: true, title: true, details: true, store: true, price: true, offerUrl: true },
  });
}

export async function getSparklingDealsConfig() {
  return prisma.sparklingDealsConfig.findUnique({ where: { id: 1 } });
}
