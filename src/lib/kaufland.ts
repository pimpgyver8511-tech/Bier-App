import { fetchText } from "@/lib/beerdeals";

/**
 * Kaufland als direkte Quelle (zusaetzlich zu kaufda). Anlass: der Kaufland-
 * Prospekt fuer Leipzig enthielt "Fürst von Metternich Sekt" (S. 55), der
 * ueber kaufda nicht auftauchte.
 *
 * Beide Seiten liefern ihre Daten ohne Login und sind per echtem Abruf
 * bestaetigt:
 * - Die Angebotsuebersicht fuer eine Filiale ("uebersicht.storeName=…") bettet
 *   jedes Angebot als JSON-Objekt {"offerId": …, "title", "subtitle", "price",
 *   "unit", "detailDescription", "salesFrom", "salesTo", "klNr", …} ein -
 *   auch schon die der Folgewoche.
 * - Der Online-Prospekt (leaflets.kaufland.com) hat eine JSON-Schnittstelle,
 *   deren Seiten Produkt-Links mit "productDetails.productId" (= "klNr" der
 *   Angebote) enthalten. Daraus wird der Link direkt auf die Prospektseite.
 *
 * Ohne Filialangabe liefert Kaufland eine per IP geschaetzte Filiale. Die
 * Angebote unterscheiden sich je Filiale (Sortimentsumfang), deshalb werden
 * alle Leipziger Filialen einzeln abgefragt. Die Filialliste kommt aus dem
 * Kaufland-Filialfinder; die feste Liste unten ist nur der Notnagel.
 */
export type KauflandStore = { id: string; name: string };

const STORE_FINDER_URL = "https://filiale.kaufland.de/.klstorefinder.json";
const FALLBACK_LEIPZIG_STORES: KauflandStore[] = [
  { id: "DE1383", name: "Leipzig-Altlindenau" },
  { id: "DE2630", name: "Leipzig-Schönau" },
  { id: "DE2990", name: "Leipzig-Großzschocher" },
  { id: "DE3140", name: "Leipzig-Paunsdorf" },
  { id: "DE4110", name: "Leipzig-Heiterblick" },
  { id: "DE4543", name: "Leipzig-Burghausen" },
  { id: "DE6360", name: "Leipzig-Möckern" },
  { id: "DE7460", name: "Leipzig-Gohlis-Süd" },
  { id: "DE7923", name: "Leipzig-Reudnitz-Thonberg" },
];

/** Alle Kaufland-Filialen im Stadtgebiet Leipzig (Feld "t" = Ort). */
export async function fetchLeipzigKauflandStores(): Promise<KauflandStore[]> {
  try {
    const res = await fetch(STORE_FINDER_URL, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; BierApp/1.0)", Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as { n?: string; cn?: string; t?: string }[];
    const stores = data
      .filter((s) => s.n && s.t === "Leipzig")
      .map((s) => ({ id: s.n as string, name: (s.cn ?? s.n ?? "").replace(/^Kaufland\s+/, "") }));
    return stores.length ? stores : FALLBACK_LEIPZIG_STORES;
  } catch {
    return FALLBACK_LEIPZIG_STORES;
  }
}

export function kauflandOffersUrl(storeId: string): string {
  return `https://filiale.kaufland.de/angebote/uebersicht.storeName=${storeId}.html`;
}

const LEAFLET_API = "https://endpoints.leaflets.schwarz/v4/flyer";

export type KauflandOffer = {
  offerId: string;
  klNr?: string;
  title?: string;
  subtitle?: string;
  price?: number;
  unit?: string;
  basePrice?: string;
  detailDescription?: string;
  salesFrom?: string;
  salesTo?: string;
  dateFrom?: string;
  dateTo?: string;
};

/**
 * Liest das JSON-Objekt, das bei `start` mit "{" beginnt (Klammern zaehlen,
 * Strings samt Escapes ueberspringen). Noetig, weil die Angebote mitten in
 * einem grossen Inline-Script stehen, dessen Ende sich nicht sicher finden laesst.
 */
function readJsonObjectAt(text: string, start: number): unknown {
  let depth = 0;
  let inString = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (ch === "\\") i++;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return JSON.parse(text.slice(start, i + 1));
    }
  }
  throw new Error("unvollständiges JSON");
}

export function extractKauflandOffers(html: string): KauflandOffer[] {
  const byId = new Map<string, KauflandOffer>();
  for (const match of html.matchAll(/\{"offerId":/g)) {
    try {
      const offer = readJsonObjectAt(html, match.index) as KauflandOffer;
      if (offer?.offerId && !byId.has(offer.offerId)) byId.set(offer.offerId, offer);
    } catch {
      // einzelnes kaputtes Objekt ueberspringen
    }
  }
  return Array.from(byId.values());
}

type LeafletResponse = {
  flyer?: {
    pages?: { number?: number; links?: { productDetails?: { productId?: string } }[] }[];
  };
};

/**
 * Artikelnummer -> Link auf die Prospektseite, ueber alle aktuellen
 * Prospekte der Filiale. Fehler hier sind nicht schlimm: dann gibt es eben
 * keinen Prospekt-Link.
 */
export async function fetchKauflandLeafletLinks(storeId: string): Promise<Map<string, string>> {
  const links = new Map<string, string>();
  const storeNumber = storeId.replace(/^DE/, "");
  const html = await fetchText(`https://filiale.kaufland.de/prospekte.storeName=${storeId}.html`);
  const identifiers = new Set(
    Array.from(
      html.matchAll(/leaflets\.kaufland\.com\/de-DE\/(DE_de_[A-Za-z0-9]+_(\d+)_[A-Za-z0-9]+)/g),
      (m) => (m[2] === storeNumber ? m[1] : null)
    ).filter((id): id is string => id !== null)
  );
  const results = await Promise.allSettled(
    Array.from(identifiers, async (identifier) => {
      const res = await fetch(`${LEAFLET_API}?flyer_identifier=${encodeURIComponent(identifier)}&region_id=0`, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; BierApp/1.0)", Accept: "application/json" },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return { identifier, data: (await res.json()) as LeafletResponse };
    })
  );
  for (const result of results) {
    if (result.status !== "fulfilled") continue;
    const { identifier, data } = result.value;
    for (const page of data.flyer?.pages ?? []) {
      for (const link of page.links ?? []) {
        const productId = link.productDetails?.productId;
        if (productId && page.number && !links.has(productId)) {
          links.set(productId, `https://leaflets.kaufland.com/de-DE/${identifier}/view/flyer/page/${page.number}`);
        }
      }
    }
  }
  return links;
}

/** "FÜRST VON METTERNICH" -> "Fürst von Metternich"; Kuerzel wie "MM" bleiben. */
export function tidyKauflandBrand(value: string): string {
  const small = new Set(["von", "und", "de", "di", "la", "le", "du", "del"]);
  return value
    .trim()
    .split(/\s+/)
    .map((word) => {
      if (word !== word.toUpperCase() || word.length <= 2) return word;
      const lower = word.toLowerCase();
      if (small.has(lower)) return lower;
      return lower.replace(/(^|[-'’])(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toUpperCase());
    })
    .join(" ");
}

/**
 * Datum "2026-11-14" als Tagesgrenze in deutscher Zeit. Bewusst grob (ohne
 * Sommerzeit-Berechnung): Beginn 22:00 UTC am Vortag, Ende 21:59 UTC - so
 * ist das Angebot in Sommer- wie Winterzeit den ganzen Tag sichtbar.
 */
export function kauflandDay(value: string | undefined, edge: "start" | "end"): Date | null {
  const m = value?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]) - 1, Number(m[3])];
  return edge === "start" ? new Date(Date.UTC(y, mo, d - 1, 22, 0, 0)) : new Date(Date.UTC(y, mo, d, 21, 59, 59));
}
