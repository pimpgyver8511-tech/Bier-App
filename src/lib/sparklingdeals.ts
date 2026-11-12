import {
  extractKauflandOffers,
  fetchKauflandLeafletLinks,
  fetchLeipzigKauflandStores,
  kauflandDay,
  kauflandOffersUrl,
  tidyKauflandBrand,
  type KauflandStore,
} from "@/lib/kaufland";
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

// Neben den Gattungsbegriffen auch die gaengigen Marken: die kaufda-Suche
// findet einen Prospekt nur, wenn der Suchbegriff im Angebot vorkommt - ein
// "Fürst von Metternich Riesling trocken" ohne das Wort "Sekt" bliebe sonst
// unsichtbar, wenn im selben Prospekt kein anderes Sekt-Angebot steht.
const KAUFDA_SEARCH_QUERIES = [
  "Sekt",
  "Prosecco",
  "Schaumwein",
  "Metternich",
  "Rotkäppchen",
  "Söhnlein",
  "Henkell",
  "Mumm",
  "Freixenet",
];

// Ohne Kategorie-Filter: Sekt liegt bei HIT nicht zwingend in derselben
// Prospekt-Kategorie wie Bier ("Getraenke", 1803).
const HIT_ALL_OFFERS_URL = "https://www.hit.de/maerkte/leipzig/angebote";

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
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
];

// Typische Sekt-Marken, deren Angebotstext nicht immer selbst "Sekt" o.ae.
// enthaelt (z.B. "Henkell Trocken", "Söhnlein Brillant"). Reine Sekt-Marken
// gelten auch dann als Sekt, wenn im Text/der Kategorie "Wein" steht (z.B.
// Kategorie "Wein & Sekt"); bei Marken, die auch Stillwein bzw. ganz andere
// Produkte fuehren, braucht es zusaetzlich einen Getraenke-Hinweis.
const PURE_SPARKLING_BRANDS = [
  "metternich",
  "henkell",
  "sohnlein",
  "kupferberg",
  "mumm",
  "mionetto",
  "moet",
  "veuve clicquot",
  "kessler",
];
const MIXED_SPARKLING_BRANDS = ["rotkappchen", "freixenet", "wachenheim"];

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

// Lebensmittel mit Sekt-Markennamen (Rotkaeppchen ist auch eine Kaesemarke,
// per echtem Nutzer-Screenshot bestaetigt: "Rotkäppchen Mozzarella Sticks").
const FOOD_WORDS = ["mozzarella", "kase", "camembert", "sticks", "pizza", "chips", "snack"];

/** Normalisierter Text ohne Grundpreis-Angaben wie "(1 l = 4,65)". */
function stripUnitPrices(text: string): string {
  return text
    .replace(/\(?\s*(?:1\s*-?\s*)?(?:liter|ltr|l|kg)\s*=\s*[\d.,]+(?:\s*-\s*[\d.,]+)?\s*(?:€|eur)?\s*\)?/g, " ")
    .replace(/(?:liter|grund)-?preis[^)]*/g, " ");
}

/** Alle Fluessigkeits-Mengenangaben im Text, in Litern. */
function parseVolumes(cleanedText: string): number[] {
  const volumes: number[] = [];
  const unitFactor: Record<string, number> = { l: 1, ltr: 1, liter: 1, cl: 0.01, ml: 0.001 };
  for (const m of cleanedText.matchAll(/(\d+(?:[.,]\d+)?)\s*-?\s*(liter|ltr|ml|cl|l)(?![a-z])/g)) {
    const value = Number(m[1].replace(",", "."));
    if (Number.isFinite(value) && value > 0) volumes.push(value * unitFactor[m[2]]);
  }
  return volumes;
}

type Verdict = { ok: true } | { ok: false; reason: string };

const OK: Verdict = { ok: true };

/** Erwaehnt der Text ueberhaupt Sekt/eine Sekt-Marke? Nur dann lohnt ein Diagnose-Eintrag. */
function mentionsSparkling(rawText: string): boolean {
  const text = normalizeText(rawText);
  return [...SPARKLING_KEYWORDS, ...PURE_SPARKLING_BRANDS, ...MIXED_SPARKLING_BRANDS].some((w) =>
    text.includes(w)
  );
}

function classifySparkling(rawText: string): Verdict {
  const text = normalizeText(rawText);
  const nonDrink = NON_DRINK_WORDS.find((w) => text.includes(w));
  if (nonDrink) return { ok: false, reason: `kein Getränk („${nonDrink}“)` };
  const hasKeyword = SPARKLING_KEYWORDS.some((w) => text.includes(w));
  // Essens-Woerter nur ohne eindeutiges Sekt-Stichwort werten: Kaufland
  // beschreibt Getraenke gern mit "passt zu ... würzigem Käse".
  const food = hasKeyword ? undefined : FOOD_WORDS.find((w) => text.includes(w));
  if (food) return { ok: false, reason: `Lebensmittel („${food}“)` };
  const cleaned = stripUnitPrices(text);
  const volumes = parseVolumes(cleaned);
  // Gewichtsangabe (z.B. "150-g-Pckg.") ohne Literangabe = Lebensmittel.
  if (volumes.length === 0 && /\d\s*-?\s*(?:g|kg)(?![a-z])|pckg|packung/.test(cleaned)) {
    return { ok: false, reason: "Lebensmittel (Gewichtsangabe)" };
  }
  if (hasKeyword) return OK;
  if (PURE_SPARKLING_BRANDS.some((b) => text.includes(b))) return OK;
  if (MIXED_SPARKLING_BRANDS.some((b) => text.includes(b))) {
    // Stillwein derselben Marke (z.B. "Rotkäppchen Qualitätswein") nicht
    // mitnehmen, und nur, wenn der Text erkennbar ein Getraenk beschreibt.
    if (cleaned.replace(/schaumwein|perlwein/g, "").includes("wein")) {
      return { ok: false, reason: "vermutlich Stillwein" };
    }
    if (volumes.length > 0 || /flasche|\bfl\b|trocken|brut|\bdry\b|mild|\brose\b/.test(cleaned)) return OK;
    return { ok: false, reason: "kein Getränk erkennbar" };
  }
  return { ok: false, reason: "kein Sekt" };
}

const MIN_BOTTLE_LITERS = 0.75;

/**
 * Nur normale Flaschen ab 0,75 l (ausdruecklich so gewuenscht) - keine Piccolos/
 * kleinen Flaschen. Massgeblich ist die Flaschengroesse, nicht die
 * Gesamtmenge eines Mehrfachpacks ("3 x 0,2 l" fliegt raus). Grundpreis-
 * Angaben wie "(1 l = 4,65)" werden vorher entfernt, sonst sahe jede kleine
 * Flasche wie 1 Liter aus. Angebote ganz ohne Mengenangabe bleiben drin
 * (Sekt gibt es fast immer als 0,75 l), ausser sie heissen ausdruecklich
 * Piccolo/Pikkolo.
 */
function checkBottleSize(rawText: string): Verdict {
  const text = stripUnitPrices(normalizeText(rawText));
  if (/pikkolo|piccolo/.test(text)) return { ok: false, reason: "Piccolo" };
  const volumes = parseVolumes(text);
  if (volumes.length === 0) return OK;
  const largest = Math.max(...volumes);
  // Kleine Toleranz fuer Rundung (z.B. "0,7499" durch Umrechnung).
  if (largest >= MIN_BOTTLE_LITERS - 0.001) return OK;
  return { ok: false, reason: `zu klein (${String(largest).replace(".", ",")} l)` };
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

type Rejection = { title: string; store: string; reason: string };
type RejectFn = (r: Rejection) => void;

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
  /** Nur in diesen Filialen (volle Namen); fehlt = ueberall beim Haendler. */
  onlyAt?: string[];
};

/**
 * Gemeinsame Pruefung fuer alle Quellen: liefert true, wenn das Angebot
 * uebernommen wird, und meldet Sekt-verdaechtige, aber aussortierte
 * Angebote samt Grund an reject() (fuer die Admin-Diagnose).
 */
function accept(
  text: string,
  sizeText: string,
  title: string,
  store: string | undefined,
  price: number | undefined,
  reject: RejectFn
): boolean {
  const verdict = classifySparkling(text);
  const size = verdict.ok ? checkBottleSize(sizeText) : verdict;
  const priceOk = isPlausiblePrice(price);
  if (verdict.ok && size.ok && priceOk) return true;
  if (mentionsSparkling(text)) {
    const reason = !verdict.ok
      ? verdict.reason
      : !size.ok
        ? size.reason
        : `Preis ungewöhnlich (${price ?? "?"} €)`;
    reject({ title: title || "(ohne Titel)", store: store ?? "?", reason });
  }
  return false;
}

function extractKaufdaPageOffers(html: string, sourceUrl: string, reject: RejectFn): SparklingOffer[] {
  const items = extractNextData(html)?.props?.pageProps?.pageInformation?.offers?.main?.items ?? [];
  const results: SparklingOffer[] = [];
  for (const item of items) {
    const text = [item.brand, item.title, item.description].filter(Boolean).join(" ");
    const price = item.prices?.mainPrice;
    const title = buildTitle(item.brand, item.title);
    if (!accept(text, text, title, item.publisherName, price, reject)) continue;
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

function extractKaufdaBrochureOffers(data: KaufdaBrochurePagesResponse, reject: RejectFn): SparklingOffer[] {
  const results: SparklingOffer[] = [];
  for (const pageEntry of data.contents ?? []) {
    for (const offer of pageEntry.offers ?? []) {
      const content = offer.content;
      const product = content?.products?.[0];
      if (!content || !product) continue;
      const description = product.description?.map((d) => d.paragraph ?? "").join("\n");
      const categories = (product.categoryPaths ?? []).map((c) => c.name ?? "").join(" ");
      const salesPrice = content.deals?.find((d) => d.type === "SALES_PRICE");
      const price = salesPrice?.min ?? salesPrice?.max;
      const store = content.publisher?.name;
      const title = buildTitle(product.brandName, product.name);
      const text = [product.brandName, product.name, description, categories].filter(Boolean).join(" ");
      const sizeText = [product.name, description].filter(Boolean).join(" ");
      if (!accept(text, sizeText, title, store, price, reject)) continue;
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

function extractHitSparklingOffers(
  html: string,
  reject: RejectFn
): { offers: SparklingOffer[]; leafletCount: number } {
  const { leaflets } = extractHitLeaflets(html);
  const results: SparklingOffer[] = [];
  for (const leaflet of leaflets) {
    if (!leaflet.id || !leaflet.headline) continue;
    const text = `${leaflet.headline} ${leaflet.text ?? ""}`;
    const price = Number(leaflet.price);
    const title = leaflet.headline.trim().replace(/\s*\n\s*/g, " ");
    if (!accept(text, text, title, "HIT", price, reject)) continue;
    results.push({
      id: `hit-${leaflet.id}`,
      title,
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

/**
 * Sekt-Angebote aller Leipziger Kaufland-Filialen zusammengefuehrt: gleiche
 * Artikelnummer zum gleichen Preis = ein Eintrag. Gibt es ein Angebot nicht
 * in allen Filialen, steht in den Details, wo es das gibt.
 */
function mergeKauflandSparklingOffers(
  pages: { store: KauflandStore; html: string }[],
  leafletLinks: Map<string, string>,
  reject: RejectFn
): { offers: SparklingOffer[]; total: number } {
  type Entry = { offer: SparklingOffer; stores: string[] };
  const merged = new Map<string, Entry>();
  let total = 0;
  for (const { store, html } of pages) {
    const all = extractKauflandOffers(html);
    total += all.length;
    for (const offer of all) {
      const brand = tidyKauflandBrand(offer.title ?? "");
      const title = buildTitle(brand, offer.subtitle);
      const text = [offer.title, offer.subtitle, offer.unit, offer.detailDescription].filter(Boolean).join(" ");
      const sizeText = [offer.subtitle, offer.unit, offer.detailDescription].filter(Boolean).join(" ");
      if (!accept(text, sizeText, title, "Kaufland", offer.price, reject)) continue;
      const salesFrom = offer.salesFrom ?? offer.dateFrom;
      const key = `${offer.klNr ?? normalizeText(title)}|${offer.price}|${salesFrom}`;
      const existing = merged.get(key);
      if (existing) {
        if (!existing.stores.includes(store.name)) existing.stores.push(store.name);
        continue;
      }
      merged.set(key, {
        stores: [store.name],
        offer: {
          id: `kaufland-${key}`,
          title,
          details: [offer.unit, offer.detailDescription].filter(Boolean).join("\n"),
          store: "Kaufland",
          price: offer.price as number,
          sourceUrl: kauflandOffersUrl(store.id),
          offerUrl: (offer.klNr && leafletLinks.get(offer.klNr)) || kauflandOffersUrl(store.id),
          brochureId: null,
          validFrom: kauflandDay(salesFrom, "start"),
          validUntil: kauflandDay(offer.salesTo ?? offer.dateTo, "end"),
        },
      });
    }
  }
  const storeCount = pages.length;
  const offers = Array.from(merged.values(), ({ offer, stores }) => ({
    ...offer,
    details: cleanDetails(offer.details ?? undefined),
    onlyAt: stores.length < storeCount ? stores.map((s) => `Kaufland ${s}`) : undefined,
  }));
  return { offers, total };
}

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** Was beim letzten Abgleich aussortiert wurde - nur fuer die Admin-Diagnose. */
export type SparklingSyncDebug = {
  rejected: Rejection[];
  notYetValid: { title: string; store: string; price: number; validFrom: string }[];
  stores: { store: string; count: number }[];
  queries: { query: string; brochures: number }[];
  errors: string[];
};

const MAX_DEBUG_ENTRIES = 80;

export async function syncSparklingDeals(): Promise<SparklingDealsSyncResult> {
  const collected = new Map<string, SparklingOffer>();
  const errors: string[] = [];
  const rejectedByKey = new Map<string, Rejection>();
  const reject: RejectFn = (r) => {
    const key = `${normalizeText(r.title)}|${normalizeText(r.store)}`;
    if (!rejectedByKey.has(key)) rejectedByKey.set(key, r);
  };

  // Laeuft parallel zu den kaufda-Abrufen und wird erst spaeter ausgewertet -
  // allSettled statt eines nackten Promise, damit ein frueher Fehlschlag
  // nicht als unbehandelte Rejection endet, bevor er unten abgefragt wird.
  const hitPromise = Promise.allSettled([
    fetchText(HIT_ALL_OFFERS_URL).then((html) => extractHitSparklingOffers(html, reject)),
  ]);
  // Alle Leipziger Kaufland-Filialen parallel; die Prospekt-Links reichen von
  // einer Filiale (Seitenaufbau ist gleich), sonst Link auf die Angebotsseite.
  const kauflandPromise = fetchLeipzigKauflandStores().then(async (stores) => {
    const [pages, links] = await Promise.all([
      Promise.allSettled(stores.map(async (store) => ({ store, html: await fetchText(kauflandOffersUrl(store.id)) }))),
      fetchKauflandLeafletLinks(stores[0].id).catch((err: unknown) => {
        errors.push(`Kaufland-Prospekt: ${errorText(err)}`);
        return new Map<string, string>();
      }),
    ]);
    return { stores, pages, links };
  });
  // nicht als unbehandelte Rejection enden lassen, ausgewertet wird unten
  kauflandPromise.catch(() => {});
  const searchPromise = Promise.allSettled(KAUFDA_SEARCH_QUERIES.map((q) => searchBrochureIds(q)));

  const pageResults = await Promise.allSettled(
    KAUFDA_SPARKLING_SOURCES.map(async (url) => extractKaufdaPageOffers(await fetchText(url), url, reject))
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

  // Kaufland direkt. Bei gleichem Titel/Preis wie ein kaufda-Eintrag gewinnt
  // dieser hier (steht unten beim Entdoppeln vorne), weil er direkt auf die
  // richtige Prospektseite verlinkt.
  const kauflandOffers: SparklingOffer[] = [];
  let kauflandInfo = "";
  try {
    const { stores, pages, links } = await kauflandPromise;
    const loaded: { store: KauflandStore; html: string }[] = [];
    pages.forEach((result, i) => {
      if (result.status === "fulfilled") loaded.push(result.value);
      else errors.push(`Kaufland ${stores[i].name}: ${errorText(result.reason)}`);
    });
    const { offers, total } = mergeKauflandSparklingOffers(loaded, links, reject);
    kauflandOffers.push(...offers);
    kauflandInfo = ` Kaufland: ${loaded.length} von ${stores.length} Leipziger Filialen geladen.`;
    if (loaded.length > 0 && total === 0) kauflandInfo += " Keine Angebote auf den Seiten gefunden.";
  } catch (err) {
    kauflandInfo = ` Kaufland: ${errorText(err)}.`;
    errors.push(`Kaufland: ${errorText(err)}`);
  }

  const brochureIds = new Set<string>();
  for (const o of collected.values()) if (o.brochureId) brochureIds.add(o.brochureId);
  const queryStats: SparklingSyncDebug["queries"] = [];
  (await searchPromise).forEach((result, i) => {
    const query = KAUFDA_SEARCH_QUERIES[i];
    if (result.status === "fulfilled") {
      for (const id of result.value) brochureIds.add(id);
      queryStats.push({ query, brochures: result.value.size });
    } else {
      errors.push(`kaufda-Suche „${query}“: ${errorText(result.reason)}`);
      queryStats.push({ query, brochures: -1 });
    }
  });

  // Prospekt-Daten haben die genauere (tagesgenaue) Gueltigkeit und
  // ueberschreiben deshalb Eintraege mit gleicher Angebots-ID von oben.
  const brochureResults = await Promise.allSettled(
    Array.from(brochureIds, async (id) => extractKaufdaBrochureOffers(await fetchBrochurePages(id), reject))
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
  const deals = [...kauflandOffers, ...collected.values()]
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
      onlyAt: d.onlyAt?.length ? d.onlyAt.join("|") : null,
    }));

  const now = new Date();
  // Bereits gefundene Angebote nicht zusaetzlich als "aussortiert" fuehren
  // (z.B. Prospektseite abgelehnt, aber kaufda-Markenseite uebernommen).
  const acceptedKeys = new Set(deals.map((d) => `${normalizeText(d.title)}|${normalizeText(d.store)}`));
  const storeCounts = new Map<string, number>();
  for (const d of deals) storeCounts.set(d.store, (storeCounts.get(d.store) ?? 0) + 1);
  const debug: SparklingSyncDebug = {
    rejected: Array.from(rejectedByKey.entries())
      .filter(([key]) => !acceptedKeys.has(key))
      .map(([, r]) => r)
      .slice(0, MAX_DEBUG_ENTRIES),
    notYetValid: deals
      .filter((d) => d.validFrom && d.validFrom > now)
      .map((d) => ({ title: d.title, store: d.store, price: d.price, validFrom: d.validFrom!.toISOString() }))
      .slice(0, MAX_DEBUG_ENTRIES),
    stores: Array.from(storeCounts, ([store, count]) => ({ store, count })).sort((a, b) =>
      a.store.localeCompare(b.store, "de")
    ),
    queries: queryStats,
    errors: errors.slice(0, 30),
  };
  const lastSyncDebug = JSON.stringify(debug);

  if (deals.length === 0) {
    const message =
      "Keine Angebote gefunden." + (errors.length ? " Details: " + errors.slice(0, 10).join("; ") : "");
    await prisma.sparklingDealsConfig.upsert({
      where: { id: 1 },
      update: { lastSyncAt: now, lastSyncOk: false, lastSyncMsg: message, lastSyncDebug },
      create: { id: 1, lastSyncAt: now, lastSyncOk: false, lastSyncMsg: message, lastSyncDebug },
    });
    return { ok: false, message, count: 0 };
  }

  await prisma.$transaction([
    prisma.sparklingDeal.deleteMany({}),
    prisma.sparklingDeal.createMany({ data: deals }),
  ]);

  const message =
    `${deals.length} Angebot(e): ${pageHits} von kaufda-Seiten, ${brochureHits} zusätzlich aus ` +
    `${brochureIds.size} Prospekten, ${hitCount} von HIT, ${kauflandOffers.length} direkt von Kaufland.` +
    (errors.length ? ` (${errors.length} Quellen ohne Treffer/Fehler)` : "") +
    hitInfo +
    kauflandInfo;
  await prisma.sparklingDealsConfig.upsert({
    where: { id: 1 },
    update: { lastSyncAt: now, lastSyncOk: true, lastSyncMsg: message, lastSyncDebug },
    create: { id: 1, lastSyncAt: now, lastSyncOk: true, lastSyncMsg: message, lastSyncDebug },
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
  /** Nur in diesen Filialen erhaeltlich (leer = ueberall beim Haendler). */
  onlyAt: string[];
};

/** Aktuell gueltige Angebote, guenstigste zuerst (gleiche Gueltigkeitslogik wie Bier). */
export async function getAllSparklingDeals(): Promise<SparklingDeal[]> {
  const now = new Date();
  const where = {
    AND: [
      { OR: [{ validFrom: null }, { validFrom: { lte: now } }] },
      { OR: [{ validUntil: null }, { validUntil: { gte: now } }] },
    ],
  };
  const select = { id: true, title: true, details: true, store: true, price: true, offerUrl: true } as const;
  try {
    const rows = await prisma.sparklingDeal.findMany({
      where,
      orderBy: { price: "asc" },
      select: { ...select, onlyAt: true },
    });
    return rows.map((r) => ({ ...r, onlyAt: r.onlyAt ? r.onlyAt.split("|").filter(Boolean) : [] }));
  } catch {
    // Spalte "onlyAt" evtl. noch nicht angelegt (Admin > Einstellungen >
    // Datenbank) - die Seite soll fuer die Freundin trotzdem funktionieren.
    const rows = await prisma.sparklingDeal.findMany({ where, orderBy: { price: "asc" }, select });
    return rows.map((r) => ({ ...r, onlyAt: [] }));
  }
}

export async function getSparklingDealsConfig() {
  return prisma.sparklingDealsConfig.findUnique({ where: { id: 1 } });
}

export function parseSparklingSyncDebug(raw: string | null | undefined): SparklingSyncDebug | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SparklingSyncDebug;
  } catch {
    return null;
  }
}
