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
 * ist nicht noetig. Die allgemeine Bier-Seite deckt die meisten Angebote
 * ab, die Marken-Seiten fangen zusaetzlich Angebote auf, die dort nicht
 * gelistet sind (z.B. weil kaufda.de sie nur der jeweiligen Marken-Seite
 * zuordnet).
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
 * kaufda.de bestaetigt. brochureId und Seitenzahl stehen am Angebot selbst
 * in parentContent, lat/lng/zip sind die bereits verwendeten Leipzig-Werte.
 */
function buildOfferUrl(item: KaufdaOfferItem): string | null {
  const brochureId = item.parentContent?.id;
  const page = item.parentContent?.page?.number;
  if (!brochureId || !page || !item.id) return null;
  const params = new URLSearchParams({
    adPlacement: "ad_placement__bv_brochure_page",
    lat: "51.3397",
    lng: "12.3713",
    pageType: "LOCAL_SEARCH_RESULTS_PAGE",
    sourceType: "PORTAL_STARTPAGE",
    zip: "04109",
    page: String(page),
    locality: "Leipzig",
    productId: item.id,
  });
  return `https://www.kaufda.de/contentViewer/static/${brochureId}?${params.toString()}`;
}

type ExtractedOffer = {
  id: string;
  brand: string;
  store: string;
  price: number;
  offerUrl: string | null;
};

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
    results.push({ id, brand, store, price, offerUrl: buildOfferUrl(item) });
  }
  return results;
}

// Ein selbst erklaerender Bot-User-Agent wird von Prospekt-/
// Preisvergleichsseiten haeufig erkannt und blockiert - deshalb wird hier
// ein normaler Browser-User-Agent samt typischer Browser-Header verwendet.
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
  // Mehrere Quellseiten (allgemeine Bier-Seite + Marken-Seiten) koennen
  // dasselbe Angebot liefern - Dedupe ueber die von kaufda.de vergebene
  // Angebots-ID stellt sicher, dass jedes echte Angebot nur einmal
  // gespeichert wird.
  const collected = new Map<
    string,
    { brand: string; store: string; price: number; sourceUrl: string; offerUrl: string | null }
  >();
  const errors: string[] = [];

  for (const url of KAUFDA_SOURCES) {
    try {
      const html = await fetchText(url);
      const offers = extractOffers(html);
      for (const o of offers) {
        if (!collected.has(o.id)) {
          collected.set(o.id, {
            brand: o.brand,
            store: o.store,
            price: o.price,
            sourceUrl: url,
            offerUrl: o.offerUrl,
          });
        }
      }
      if (offers.length === 0) {
        errors.push(`${url}: keine Treffer (Antwort ${html.length} Zeichen)`);
      }
    } catch (err) {
      errors.push(`${url}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const now = new Date();
  const deals = Array.from(collected.values());

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
    `${deals.length} Angebot(e) von ${KAUFDA_SOURCES.length} Seiten abgerufen.` +
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
};

/**
 * Liefert alle Angebote flach (ein Eintrag pro Marke+Haendler-Kombination),
 * aufsteigend nach Preis sortiert. Filterung/Umsortierung nach Haendler,
 * Marke oder Preisrichtung passiert clientseitig in der Tabelle.
 */
export async function getAllBeerDeals(): Promise<BeerDeal[]> {
  const all = await prisma.beerDeal.findMany({ orderBy: { price: "asc" } });
  const deals: BeerDeal[] = [];
  for (const deal of all) {
    if (!deal.store || deal.price === null) continue;
    deals.push({
      id: deal.id,
      brand: deal.brand,
      store: deal.store,
      price: deal.price,
      offerUrl: deal.offerUrl,
    });
  }
  return deals;
}

export async function getBeerDealsConfig() {
  return prisma.beerDealsConfig.findUnique({ where: { id: 1 } });
}
