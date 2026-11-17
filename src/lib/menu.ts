/**
 * Liest eine Restaurant-Speisekarte von einer Webseite, damit Spieler bei
 * einer Essensbestellung (z.B. Weihnachtsfeier) direkt in der App waehlen
 * koennen. Zugeschnitten auf den YOOtheme/UIkit-Aufbau von bibabo.de
 * (per echtem Seitenabruf bestaetigt): Abschnitts-Ueberschriften mit Klasse
 * "uk-heading-bullet", Zwischentitel als <div class="uk-panel"><strong>…,
 * Gerichte als <li class="el-item"> mit "el-title", "el-meta" (Preis) und
 * "el-content" (Beilagen, Allergene in <sup>).
 *
 * Die Karte wird live geladen (1 h zwischengespeichert), damit Aenderungen
 * des Restaurants - z.B. die wechselnde Adventskarte - automatisch
 * ankommen. Klappt das nicht, zeigt die Seite nur den Link zur Karte.
 */

export type MenuItem = {
  name: string;
  /** null = kein Preis, sondern ein Hinweis (z.B. "Getränke zur Karte") */
  price: number | null;
  priceLabel: string | null;
  description: string | null;
  allergens: string | null;
};

export type MenuSection = { title: string; items: MenuItem[] };

function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&euro;/g, "€")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => String.fromCodePoint(parseInt(n, 16)));
}

function plainText(html: string | undefined): string {
  if (!html) return "";
  return decodeEntities(
    html
      .replace(/<br\s*\/?>/gi, " · ")
      .replace(/<\/p>\s*<p[^>]*>/gi, " · ")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/\s+/g, " ")
    .replace(/(?:\s*·\s*)+$/, "")
    .replace(/^(?:\s*·\s*)+/, "")
    .trim();
}

function parsePrice(label: string): number | null {
  const m = label.match(/^(\d+(?:[.,]\d{1,2})?)\s*€$/);
  return m ? Number(m[1].replace(",", ".")) : null;
}

export function parseMenu(html: string): MenuSection[] {
  const sections: MenuSection[] = [];
  let current: MenuSection | null = null;
  const token =
    /<h[1-6][^>]*class="[^"]*uk-heading-bullet[^"]*"[^>]*>([\s\S]*?)<\/h[1-6]>|<div class="uk-panel[^"]*">\s*<strong>([\s\S]*?)<\/strong>\s*<\/div>|<li class="el-item">([\s\S]*?)<\/li>/g;
  for (const m of html.matchAll(token)) {
    const heading = m[1] ?? m[2];
    if (heading !== undefined) {
      const title = plainText(heading).replace(/:$/, "");
      if (title) {
        current = { title, items: [] };
        sections.push(current);
      }
      continue;
    }
    const li = m[3];
    const name = plainText(li.match(/class="el-title[^"]*"[^>]*>([\s\S]*?)<\/div>/)?.[1]);
    if (!name) continue;
    const meta = plainText(li.match(/class="el-meta[^"]*"[^>]*>([\s\S]*?)<\/div>/)?.[1]);
    const contentHtml = li.match(/class="el-content[^"]*"[^>]*>([\s\S]*?)<\/div>/)?.[1] ?? "";
    const allergens = plainText(Array.from(contentHtml.matchAll(/<sup>([\s\S]*?)<\/sup>/g), (s) => s[1]).join(","));
    const description = plainText(contentHtml.replace(/<sup>[\s\S]*?<\/sup>/g, ""));
    const price = parsePrice(meta);
    if (!current) {
      current = { title: "Speisekarte", items: [] };
      sections.push(current);
    }
    current.items.push({
      name,
      price,
      priceLabel: meta || null,
      description: description || null,
      allergens: allergens || null,
    });
  }
  return sections.filter((s) => s.items.length > 0);
}

export async function fetchMenu(url: string): Promise<MenuSection[] | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; BierApp/1.0)", "Accept-Language": "de-DE,de" },
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const sections = parseMenu(await res.text());
    return sections.length ? sections : null;
  } catch {
    return null;
  }
}

export function formatEuro(value: number): string {
  return `${value.toFixed(2).replace(".", ",")} €`;
}

export type MenuChoice = { label: string; price: number; section: string; description: string | null };

/**
 * Auswaehlbare Gerichte (nur Eintraege mit Preis). Schnitzel stehen auf der
 * Karte nur mit ihrem Namen ("Klassik", "Dijon") - fuer die Bestellung beim
 * Restaurant wird "Schnitzel" davorgesetzt, damit es eindeutig bleibt.
 */
export function menuChoices(sections: MenuSection[]): MenuChoice[] {
  const choices: MenuChoice[] = [];
  const seen = new Set<string>();
  for (const section of sections) {
    const prefix = /^schnitzel/i.test(section.title) ? "Schnitzel " : "";
    for (const item of section.items) {
      if (item.price === null) continue;
      const name = item.name.replace(/^\+\s*/, "Extra: ");
      const label = prefix && !/schnitzel/i.test(name) ? `${prefix}${name}` : name;
      if (seen.has(label)) continue;
      seen.add(label);
      choices.push({ label, price: item.price, section: section.title, description: item.description });
    }
  }
  return choices;
}
