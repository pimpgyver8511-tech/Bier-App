import { prisma } from "@/lib/db";

export type BeerDealsSyncResult = {
  ok: boolean;
  message: string;
  count: number;
};

/**
 * kaufda.de liefert pro Kategorie- bzw. Marken-Seite serverseitig
 * gerenderte Angebotsdaten direkt im "__NEXT_DATA__"-Script-Tag der Seite
 * (bestaetigt per echtem Seitenquelltext) - eine zusaetzliche API-Anfrage
 * ist nicht noetig. Die allgemeine Bier-Seite ("Bier" unten) deckt dabei
 * NICHT alle Angebote ab: sie meldet z.B. "totalItems": 151, bettet aber
 * nur die ersten 16 davon in die Seite ein (der Rest laedt vermutlich
 * client-seitig beim Scrollen nach). Eine Markenliste kann prinzipbedingt
 * nie zu 100% vollstaendig sein (kaufda.de bietet nur fuer eine feste,
 * kleine Auswahl an Marken eigene SEO-Seiten an - kleinere/regionale
 * Marken wie Sternburg haben gar keine eigene Seite, per echtem
 * Nutzer-Test bestaetigt: 403 beim Versuch, eine geratene URL dafuer
 * aufzurufen). Diese Liste bleibt als zusaetzliche, verlaessliche Quelle
 * bestehen, ist aber NICHT mehr die einzige - siehe searchBierBrochureIds()
 * weiter unten fuer die markenunabhaengige Vollstaendigkeits-Ergaenzung.
 */
const KAUFDA_SOURCES = [
  "https://www.kaufda.de/Leipzig/Angebote/Bier",
  "https://www.kaufda.de/Leipzig/Angebote/Krombacher",
  "https://www.kaufda.de/Leipzig/Angebote/Bitburger",
  "https://www.kaufda.de/Leipzig/Angebote/Veltins",
  "https://www.kaufda.de/Leipzig/Angebote/Becks",
  "https://www.kaufda.de/Leipzig/Angebote/Hasseroeder",
  "https://www.kaufda.de/Leipzig/Angebote/Radeberger",
  "https://www.kaufda.de/Leipzig/Angebote/Warsteiner",
  "https://www.kaufda.de/Leipzig/Angebote/Oettinger",
  "https://www.kaufda.de/Leipzig/Angebote/Erdinger",
  "https://www.kaufda.de/Leipzig/Angebote/Koelsch",
  "https://www.kaufda.de/Leipzig/Angebote/Budweiser",
  "https://www.kaufda.de/Leipzig/Angebote/Augustiner",
  "https://www.kaufda.de/Leipzig/Angebote/Hasseroeder-Pilsener",
  "https://www.kaufda.de/Leipzig/Angebote/Freiberger",
  "https://www.kaufda.de/Leipzig/Angebote/Berliner-Pilsener",
  "https://www.kaufda.de/Leipzig/Angebote/Fassbier",
  "https://www.kaufda.de/Leipzig/Angebote/Ur-Krostitzer",
  "https://www.kaufda.de/Leipzig/Angebote/Luebzer",
  "https://www.kaufda.de/Leipzig/Angebote/Wernesgruener",
  "https://www.kaufda.de/Leipzig/Angebote/Heineken",
  "https://www.kaufda.de/Leipzig/Angebote/Spaten",
  "https://www.kaufda.de/Leipzig/Angebote/Pilsner-Urquell",
  "https://www.kaufda.de/Leipzig/Angebote/Benediktiner",
  "https://www.kaufda.de/Leipzig/Angebote/Paulaner",
  "https://www.kaufda.de/Leipzig/Angebote/Franziskaner",
  "https://www.kaufda.de/Leipzig/Angebote/Loewenbraeu",
  "https://www.kaufda.de/Leipzig/Angebote/Diebels",
  "https://www.kaufda.de/Leipzig/Angebote/Paderborner",
  "https://www.kaufda.de/Leipzig/Angebote/Koenig-Pilsener",
  "https://www.kaufda.de/Leipzig/Angebote/Jever",
  "https://www.kaufda.de/Leipzig/Angebote/Flensburger",
  "https://www.kaufda.de/Leipzig/Angebote/Astra",
  "https://www.kaufda.de/Leipzig/Angebote/Karlsberg",
  "https://www.kaufda.de/Leipzig/Angebote/Wickueler",
  "https://www.kaufda.de/Leipzig/Angebote/Schoefferhofer",
  "https://www.kaufda.de/Leipzig/Angebote/Licher",
  "https://www.kaufda.de/Leipzig/Angebote/Gaffel",
  "https://www.kaufda.de/Leipzig/Angebote/Reissdorf",
  "https://www.kaufda.de/Leipzig/Angebote/Fruh",
  "https://www.kaufda.de/Leipzig/Angebote/Duckstein",
  "https://www.kaufda.de/Leipzig/Angebote/Landskron",
  "https://www.kaufda.de/Leipzig/Angebote/Kulmbacher",
  "https://www.kaufda.de/Leipzig/Angebote/Moenchshof",
  "https://www.kaufda.de/Leipzig/Angebote/Einbecker",
  "https://www.kaufda.de/Leipzig/Angebote/Goesser",
  "https://www.kaufda.de/Leipzig/Angebote/Corona",
  "https://www.kaufda.de/Leipzig/Angebote/Desperados",
  "https://www.kaufda.de/Leipzig/Angebote/Meisterbraeu",
];

type KaufdaOfferItem = {
  id?: string;
  publisherName?: string;
  title?: string;
  description?: string;
  brand?: string;
  parentContent?: {
    id?: string;
    page?: {
      number?: number;
    };
  };
  prices?: {
    mainPrice?: number;
  };
  validFrom?: string;
  validUntil?: string;
};

type KaufdaNextData = {
  props?: {
    pageProps?: {
      pageInformation?: {
        offers?: {
          main?: {
            items?: KaufdaOfferItem[];
          };
        };
      };
    };
  };
};

/**
 * Ein kompletter Bierkasten wird in der Artikelbeschreibung immer als
 * "<Anzahl> x 0,<Rest>" angegeben (z.B. "20 x 0,5 Liter",
 * "24 x 0,33-l-Fl.", "28 x 0,25/20 x 0,4"). Sixpacks und Einzelflaschen
 * haben entweder keine solche Mengenangabe (z.B. "0,5-l-Dose") oder eine
 * deutlich kleinere Anzahl (z.B. "6 x 0,33-l-Fl.-Sixpack") - anhand aller
 * real beobachteten Angebote lag die Kasten-Anzahl immer bei 18 oder
 * mehr, deshalb dient 18 als Schwellenwert.
 */
function isFullCase(description: string | undefined): boolean {
  if (!description) return false;
  const match = description.match(/(\d{1,3})\s*x\s*0[.,]\d/i);
  if (!match) return false;
  return Number(match[1]) >= 18;
}

function extractNextData(html: string): KaufdaNextData | null {
  const match = html.match(
    /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/
  );
  if (!match) return null;
  try {
    return JSON.parse(match[1]) as KaufdaNextData;
  } catch {
    return null;
  }
}

/**
 * kaufda.de oeffnet den Prospekt fuer ein einzelnes Angebot ueber eine
 * "/contentViewer/static/{brochureId}"-URL mit Seitenzahl und Angebots-ID
 * als Query-Parameter - per echtem Klick auf "Prospekt oeffnen" auf
 * kaufda.de bestaetigt. lat/lng/zip sind die bereits verwendeten
 * Leipzig-Werte.
 */
function buildOfferUrlFromParts(
  brochureId: string | undefined,
  page: number | undefined,
  productId: string | undefined
): string | null {
  if (!brochureId || !page || !productId) return null;
  const params = new URLSearchParams({
    adPlacement: "ad_placement__bv_brochure_page",
    lat: KAUFDA_LEIPZIG_LAT,
    lng: KAUFDA_LEIPZIG_LNG,
    pageType: "LOCAL_SEARCH_RESULTS_PAGE",
    sourceType: "PORTAL_STARTPAGE",
    zip: "04109",
    page: String(page),
    locality: "Leipzig",
    productId,
  });
  return `https://www.kaufda.de/contentViewer/static/${brochureId}?${params.toString()}`;
}

function buildOfferUrl(item: KaufdaOfferItem): string | null {
  return buildOfferUrlFromParts(item.parentContent?.id, item.parentContent?.page?.number, item.id);
}

type ExtractedOffer = {
  id: string;
  brand: string;
  store: string;
  price: number;
  offerUrl: string | null;
  brochureId: string | null;
  validFrom: Date | null;
  validUntil: Date | null;
};

/** Parst ein ISO-Datum aus den kaufda.de-Daten, oder null bei Fehlern/Fehlen. */
function parseDate(value: string | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function extractOffers(html: string): ExtractedOffer[] {
  const data = extractNextData(html);
  const items = data?.props?.pageProps?.pageInformation?.offers?.main?.items ?? [];
  const results: ExtractedOffer[] = [];
  for (const item of items) {
    if (!isFullCase(item.description)) continue;
    const price = item.prices?.mainPrice;
    const store = item.publisherName;
    const brand = item.brand || item.title;
    const id = item.id;
    if (!id || !price || !store || !brand) continue;
    // Plausibilitaetsfilter gegen offensichtliche Datenfehler.
    if (price < 6 || price > 40) continue;
    results.push({
      id,
      brand,
      store,
      price,
      offerUrl: buildOfferUrl(item),
      brochureId: item.parentContent?.id ?? null,
      // Diese validFrom/validUntil-Werte sind nur der grobe Gueltigkeits-
      // zeitraum des GESAMTEN Prospekts (z.B. die ganze Woche) - dienen
      // hier nur als Fallback, falls die praezisere Abfrage pro Prospekt
      // (siehe fetchBrochureValidities) fehlschlaegt. Echte Tagesangebote
      // ("nur am 29.08.") haben eine engere Gueltigkeit, die erst dort
      // sichtbar wird (per echtem Beispiel des Nutzers bestaetigt).
      validFrom: parseDate(item.validFrom),
      validUntil: parseDate(item.validUntil),
    });
  }
  return results;
}

const KAUFDA_LEIPZIG_LAT = "51.3397";
const KAUFDA_LEIPZIG_LNG = "12.3713";

// Gemeinsame Browser-Header fuer alle kaufda.de-Anfragen (HTML wie JSON-
// APIs) - Preisvergleichsseiten erkennen/blockieren selbst erklaerende
// Bot-User-Agents haeufig.
const KAUFDA_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

type KaufdaBrochureOfferContent = {
  id?: string;
  publisher?: {
    name?: string;
  };
  parentContent?: {
    id?: string;
    page?: {
      number?: number;
    };
  };
  products?: {
    name?: string;
    brandName?: string;
    description?: { paragraph?: string }[];
    categoryPaths?: { id?: string; name?: string }[];
  }[];
  deals?: {
    type?: string;
    max?: number;
    min?: number;
  }[];
  publicationProfiles?: {
    validity?: {
      startDate?: string;
      endDate?: string;
    };
  }[];
};

type KaufdaBrochurePagesResponse = {
  contents?: {
    offers?: {
      content?: KaufdaBrochureOfferContent;
    }[];
  }[];
};

/**
 * Roh-Abruf aller Seiten/Angebote eines einzelnen Prospekts. Wird von der
 * kaufda.de-Prospekt-Viewer-App selbst genutzt (per Network-Tab-Capture
 * des Nutzers gefunden) und liefert - anders als die Kategorie-/Marken-
 * Seiten - pro Angebot die tatsaechliche, produktgenaue Gueltigkeit
 * (publicationProfiles[0].validity) statt nur des groben Prospekt-
 * Zeitraums.
 */
async function fetchBrochurePages(brochureId: string): Promise<KaufdaBrochurePagesResponse> {
  const url = `https://content-viewer-be.kaufda.de/v1/brochures/${brochureId}/pages?partner=kaufda_web&brochureKey=&lat=${KAUFDA_LEIPZIG_LAT}&lng=${KAUFDA_LEIPZIG_LNG}`;
  const res = await fetch(url, {
    headers: { "User-Agent": KAUFDA_USER_AGENT, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as KaufdaBrochurePagesResponse;
}

/**
 * kaufda.de klassifiziert jedes Produkt ueber eine categoryPaths-Kette der
 * Bonial-Kategorietaxonomie - fuer Bier ist darin immer ein Eintrag
 * "DE-1496"/"Bier" enthalten, egal welche Bier-Unterkategorie (Fassbier,
 * Weissbier, Biermarken, ...) oder Marke. Das unterscheidet echtes Bier
 * von anderen, ebenfalls im Kasten verkauften Getraenken (Cola, Limonade,
 * Spirituosen), die searchBierBrochureIds() zwangslaeufig mitbringt: ein
 * ganzer Prospekt gilt dort schon als Treffer, wenn irgendwo darin ein
 * Bier-Angebot steckt - per echtem Beispiel des Nutzers bestaetigt (Coca-
 * Cola, Limoncello, Jaegermeister im selben METRO-Prospekt wie mehrere
 * echte Bier-Angebote).
 */
function isBeerCategory(categoryPaths: { id?: string; name?: string }[] | undefined): boolean {
  if (!categoryPaths) return false;
  return categoryPaths.some((c) => c.id === "DE-1496" || c.name?.toLowerCase() === "bier");
}

/**
 * Extrahiert vollstaendige Bierkasten-Angebote (Marke, Haendler, Preis,
 * praezise Gueltigkeit) direkt aus den Prospekt-Seitendaten - mit echten
 * Beispieldaten des Nutzers verifiziert. Im Gegensatz zu extractOffers()
 * (Kategorie-/Marken-Seiten, dort ist die Marke bereits durch die Seite
 * selbst auf Bier eingeschraenkt) ist das hier markenunabhaengig: es
 * funktioniert fuer jeden Haendler/jede Marke in diesem Prospekt, auch
 * fuer Marken ohne eigene kaufda.de-Seite (z.B. Sternburg) - deshalb ist
 * hier zusaetzlich der isBeerCategory()-Check noetig.
 */
function extractOffersFromBrochurePages(data: KaufdaBrochurePagesResponse): ExtractedOffer[] {
  const results: ExtractedOffer[] = [];
  for (const pageEntry of data.contents ?? []) {
    for (const offer of pageEntry.offers ?? []) {
      const content = offer.content;
      if (!content) continue;
      const product = content.products?.[0];
      if (!isBeerCategory(product?.categoryPaths)) continue;
      const description = product?.description?.map((d) => d.paragraph ?? "").join(" ");
      if (!isFullCase(description)) continue;

      const salesPrice = content.deals?.find((d) => d.type === "SALES_PRICE");
      const price = salesPrice?.min ?? salesPrice?.max;
      const store = content.publisher?.name;
      const brand = product?.brandName || product?.name;
      const id = content.id;
      if (!id || !price || !store || !brand) continue;
      // Plausibilitaetsfilter gegen offensichtliche Datenfehler.
      if (price < 6 || price > 40) continue;

      const brochureId = content.parentContent?.id;
      const pageNumber = content.parentContent?.page?.number;
      const validity = content.publicationProfiles?.[0]?.validity;
      results.push({
        id,
        brand,
        store,
        price,
        offerUrl: buildOfferUrlFromParts(brochureId, pageNumber, id),
        brochureId: brochureId ?? null,
        validFrom: parseDate(validity?.startDate),
        validUntil: parseDate(validity?.endDate),
      });
    }
  }
  return results;
}

type KaufdaSearchResponse = {
  searchResults?: {
    contents?: {
      brochures?: {
        content?: {
          id?: string;
        };
      }[];
    };
  };
};

/**
 * Durchsucht kaufda.de markenunabhaengig nach "Bier"-Prospekten - dieselbe
 * paginierte Suche, die die Webseite selbst beim Scrollen der allgemeinen
 * Bier-Seite nachlaedt (per Network-Tab-Capture des Nutzers gefunden:
 * /api/search?query=Bier&offset=N&limit=24). Anders als KAUFDA_SOURCES ist
 * das nicht auf eine feste Markenliste beschraenkt - liefert die IDs
 * aller Prospekte, die aktuell ein "Bier"-Angebot in Leipzig fuehren,
 * egal ob die Marke eine eigene kaufda.de-Seite hat oder nicht. Bricht
 * ab, sobald eine Seite weniger Treffer liefert als angefragt (Ende der
 * Ergebnisse) oder ein Abruf fehlschlaegt.
 */
async function searchBierBrochureIds(): Promise<Set<string>> {
  const ids = new Set<string>();
  const limit = 24;
  for (let offset = 0; offset < 500; offset += limit) {
    const url = `https://www.kaufda.de/api/search?query=Bier&lat=${KAUFDA_LEIPZIG_LAT}&lng=${KAUFDA_LEIPZIG_LNG}&offset=${offset}&limit=${limit}`;
    const res = await fetch(url, {
      headers: { "User-Agent": KAUFDA_USER_AGENT, Accept: "application/json" },
    });
    if (!res.ok) break;
    const data = (await res.json()) as KaufdaSearchResponse;
    const brochures = data.searchResults?.contents?.brochures ?? [];
    for (const b of brochures) {
      if (b.content?.id) ids.add(b.content.id);
    }
    if (brochures.length < limit) break;
  }
  return ids;
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": KAUFDA_USER_AGENT,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      "Accept-Language": "de-DE,de;q=0.9,en;q=0.8",
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

export async function syncBeerDeals(): Promise<BeerDealsSyncResult> {
  // Mehrere Quellseiten (allgemeine Bier-Seite + Marken-Seiten) koennen
  // dasselbe Angebot liefern - Dedupe ueber die von kaufda.de vergebene
  // Angebots-ID stellt sicher, dass jedes echte Angebot nur einmal
  // gespeichert wird.
  const collected = new Map<
    string,
    {
      brand: string;
      store: string;
      price: number;
      sourceUrl: string;
      offerUrl: string | null;
      brochureId: string | null;
      validFrom: Date | null;
      validUntil: Date | null;
    }
  >();
  const errors: string[] = [];

  // Die Quellseiten werden parallel abgefragt (inzwischen knapp 50 Marken-
  // Seiten) - sequentiell wuerde das den Sync unnoetig in die Laenge
  // ziehen, ein einzelner fehlschlagender Abruf soll die anderen nicht
  // blockieren.
  const sourceResults = await Promise.allSettled(
    KAUFDA_SOURCES.map(async (url) => {
      const html = await fetchText(url);
      return { url, offers: extractOffers(html), htmlLength: html.length };
    })
  );
  for (let i = 0; i < sourceResults.length; i++) {
    const result = sourceResults[i];
    const url = KAUFDA_SOURCES[i];
    if (result.status === "rejected") {
      errors.push(`${url}: ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`);
      continue;
    }
    const { offers, htmlLength } = result.value;
    for (const o of offers) {
      if (!collected.has(o.id)) {
        collected.set(o.id, {
          brand: o.brand,
          store: o.store,
          price: o.price,
          sourceUrl: url,
          offerUrl: o.offerUrl,
          brochureId: o.brochureId,
          validFrom: o.validFrom,
          validUntil: o.validUntil,
        });
      }
    }
    if (offers.length === 0) {
      errors.push(`${url}: keine Treffer (Antwort ${htmlLength} Zeichen)`);
    }
  }

  // Markenunabhaengige Vollstaendigkeits-Ergaenzung: die Markenliste oben
  // erfasst nur Haendler/Marken mit eigener kaufda.de-Seite. Zusaetzlich
  // wird nach allen Prospekten gesucht, die aktuell ein "Bier"-Angebot in
  // Leipzig fuehren (per echtem Nutzer-Beispiel: Sternburg bei Marktkauf
  // hat keine eigene Marken-Seite und wurde so verpasst) - vereinigt mit
  // den Prospekten, die oben schon per Markenliste gefunden wurden.
  const brochureIds = new Set<string>();
  for (const deal of collected.values()) {
    if (deal.brochureId) brochureIds.add(deal.brochureId);
  }
  try {
    for (const id of await searchBierBrochureIds()) brochureIds.add(id);
  } catch (err) {
    errors.push(`Bier-Suche: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Fuer jeden gefundenen Prospekt werden die vollstaendigen Angebote
  // (Marke, Haendler, Preis, praezise Tages-Gueltigkeit) direkt aus den
  // Prospekt-Seitendaten geladen - praeziser als die Kategorie-/Marken-
  // Seiten und funktioniert fuer jede Marke, nicht nur die gelisteten.
  // Ueberschreibt bestehende Eintraege aus der Markenliste mit dieser
  // vollstaendigeren Quelle; ein fehlschlagender Prospekt wirft den
  // restlichen Sync nicht um - betroffene Angebote behalten dann ihre
  // (groebere) Gueltigkeit aus der Markenliste, falls sie von dort kamen.
  const brochureResults = await Promise.allSettled(
    Array.from(brochureIds, async (brochureId) => ({
      brochureId,
      offers: extractOffersFromBrochurePages(await fetchBrochurePages(brochureId)),
    }))
  );
  for (const result of brochureResults) {
    if (result.status === "rejected") {
      errors.push(`Prospekt: ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`);
      continue;
    }
    for (const o of result.value.offers) {
      collected.set(o.id, {
        brand: o.brand,
        store: o.store,
        price: o.price,
        sourceUrl: "https://www.kaufda.de/api/search?query=Bier",
        offerUrl: o.offerUrl,
        brochureId: o.brochureId,
        validFrom: o.validFrom,
        validUntil: o.validUntil,
      });
    }
  }

  const now = new Date();
  // Zwei Prospekte desselben Haendlers koennen dasselbe Angebot parallel
  // fuehren (z.B. Haupt- und Beilagen-Prospekt) - kaufda.de vergibt dafuer
  // zwei unterschiedliche Angebots-IDs, obwohl Marke, Haendler und Preis
  // identisch sind (per echtem Nutzer-Beispiel bestaetigt: zwei Warsteiner-
  // Angebote bei Kaufland, unterschiedliche brochureId/productId, exakt
  // gleicher Preis). Da unsere Tabelle ohnehin nur Marke/Haendler/Preis
  // zeigt, waeren solche Duplikate fuer den Nutzer nicht unterscheidbar -
  // deshalb zusaetzlich auf dieser Kombination deduplizieren.
  const seenDealKeys = new Set<string>();
  // brochureId war nur fuer den Abgleich mit fetchBrochureValidities noetig
  // und ist keine Spalte in der Datenbank.
  const deals = Array.from(collected.values())
    .filter((deal) => {
      const key = `${deal.brand.toLowerCase()}|${deal.store.toLowerCase()}|${deal.price}`;
      if (seenDealKeys.has(key)) return false;
      seenDealKeys.add(key);
      return true;
    })
    .map((deal) => ({
      brand: deal.brand,
      store: deal.store,
      price: deal.price,
      sourceUrl: deal.sourceUrl,
      offerUrl: deal.offerUrl,
      validFrom: deal.validFrom,
      validUntil: deal.validUntil,
    }));

  if (deals.length === 0) {
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
    prisma.beerDeal.createMany({ data: deals }),
  ]);

  const message =
    `${deals.length} Angebot(e) von ${KAUFDA_SOURCES.length} Marken-Seiten und ${brochureIds.size} Prospekten abgerufen.` +
    (errors.length ? ` (${errors.length} ohne Treffer/Fehler)` : "");
  await prisma.beerDealsConfig.upsert({
    where: { id: 1 },
    update: { lastSyncAt: now, lastSyncOk: true, lastSyncMsg: message },
    create: { id: 1, lastSyncAt: now, lastSyncOk: true, lastSyncMsg: message },
  });

  return { ok: true, message, count: deals.length };
}

export type BeerDeal = {
  id: string;
  brand: string;
  store: string;
  price: number;
  offerUrl: string | null;
  validFrom: Date | null;
  validUntil: Date | null;
};

/**
 * Liefert alle aktuell gueltigen Angebote flach (ein Eintrag pro Marke+
 * Haendler-Kombination), aufsteigend nach Preis sortiert. Manche Angebote
 * (z.B. Tagesangebote) gelten nur an einem einzelnen Tag - die Filterung
 * auf validFrom/validUntil <= jetzt <= sorgt dafuer, dass so ein Angebot
 * nur an den Tagen angezeigt wird, an denen es tatsaechlich gilt, egal
 * wann zuletzt synchronisiert wurde. Angebote ohne Gueltigkeitsangabe
 * werden immer angezeigt. Filterung/Umsortierung nach Haendler, Marke
 * oder Preisrichtung passiert clientseitig in der Tabelle.
 */
export async function getAllBeerDeals(): Promise<BeerDeal[]> {
  const now = new Date();
  const all = await prisma.beerDeal.findMany({
    where: {
      AND: [
        { OR: [{ validFrom: null }, { validFrom: { lte: now } }] },
        { OR: [{ validUntil: null }, { validUntil: { gte: now } }] },
      ],
    },
    orderBy: { price: "asc" },
  });
  const deals: BeerDeal[] = [];
  for (const deal of all) {
    if (!deal.store || deal.price === null) continue;
    deals.push({
      id: deal.id,
      brand: deal.brand,
      store: deal.store,
      price: deal.price,
      offerUrl: deal.offerUrl,
      validFrom: deal.validFrom,
      validUntil: deal.validUntil,
    });
  }
  return deals;
}

export async function getBeerDealsConfig() {
  return prisma.beerDealsConfig.findUnique({ where: { id: 1 } });
}
