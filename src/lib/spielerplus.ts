import { prisma } from "@/lib/db";
import { chromium, type Page } from "playwright-core";
import fs from "fs";

export type SpielerplusSyncResult = {
  ok: boolean;
  message: string;
  matchedPlayers?: string[];
  unmatchedNames?: string[];
};

/**
 * Best-effort Login+Scraping fuer Spielerplus (inoffizielle Nutzung deines
 * eigenen Accounts, keine offizielle API vorhanden). Dieses Modul wurde ohne
 * Zugriff auf die echte Spielerplus-Seite entwickelt (Netzwerk-Policy dieser
 * Umgebung), die Selektoren sind daher Bestwissen/Konvention und muessen
 * ggf. einmalig anhand der echten Seite nachjustiert werden (siehe README,
 * Abschnitt "Spielerplus-Sync"). Schlaegt der Sync fehl, bleibt die manuelle
 * Anwesenheitspflege im Admin-Bereich jederzeit voll nutzbar.
 */
export async function runSpielerplusSync(
  matchId: string
): Promise<SpielerplusSyncResult> {
  const email = process.env.SPIELERPLUS_EMAIL;
  const password = process.env.SPIELERPLUS_PASSWORD;
  const config = await prisma.spielerplusConfig.findUnique({ where: { id: 1 } });
  const teamUrl = config?.teamUrl || process.env.SPIELERPLUS_TEAM_URL;

  if (!email || !password || !teamUrl) {
    const result: SpielerplusSyncResult = {
      ok: false,
      message:
        "Spielerplus-Sync ist nicht konfiguriert. Bitte SPIELERPLUS_EMAIL und " +
        "SPIELERPLUS_PASSWORD als Umgebungsvariable setzen und die Team-URL " +
        "unter Admin > Einstellungen hinterlegen. Bis dahin: Anwesenheit manuell pflegen.",
    };
    await recordResult(result);
    return result;
  }

  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match) {
    return { ok: false, message: "Spiel nicht gefunden." };
  }

  const executablePath = resolveChromiumPath();
  if (!executablePath) {
    const result: SpielerplusSyncResult = {
      ok: false,
      message:
        "Kein Chromium gefunden. Fuer den automatischen Sync muss auf dem Server " +
        "ein Chromium-Browser installiert und PLAYWRIGHT_CHROMIUM_EXECUTABLE " +
        "gesetzt sein. Bis dahin: Anwesenheit manuell pflegen.",
    };
    await recordResult(result);
    return result;
  }

  const browser = await chromium.launch({ executablePath, headless: true });
  try {
    const page = await browser.newPage();
    await loginToSpielerplus(page, email, password);
    const rows = await findMatchAttendance(page, teamUrl, match.date);

    if (!rows) {
      const result: SpielerplusSyncResult = {
        ok: false,
        message:
          "Login war erfolgreich, aber das passende Spiel konnte auf Spielerplus " +
          "nicht gefunden werden (Datum: " +
          match.date.toLocaleDateString("de-DE") +
          "). Bitte Team-URL pruefen oder Anwesenheit manuell eintragen.",
      };
      await recordResult(result);
      return result;
    }

    const players = await prisma.player.findMany({ where: { active: true } });
    const matched: string[] = [];
    const unmatched: string[] = [];

    for (const row of rows) {
      const player = matchPlayerByName(players, row.name);
      if (!player) {
        unmatched.push(row.name);
        continue;
      }
      await prisma.attendance.upsert({
        where: { matchId_playerId: { matchId, playerId: player.id } },
        update: { status: row.status, source: "SPIELERPLUS" },
        create: { matchId, playerId: player.id, status: row.status, source: "SPIELERPLUS" },
      });
      matched.push(player.name);
    }

    const result: SpielerplusSyncResult = {
      ok: true,
      message: `Sync erfolgreich: ${matched.length} Spieler abgeglichen${
        unmatched.length ? `, ${unmatched.length} Namen nicht zugeordnet` : ""
      }.`,
      matchedPlayers: matched,
      unmatchedNames: unmatched,
    };
    await recordResult(result);
    return result;
  } catch (err) {
    const result: SpielerplusSyncResult = {
      ok: false,
      message:
        "Sync fehlgeschlagen: " +
        (err instanceof Error ? err.message : String(err)) +
        ". Anwesenheit kann jederzeit manuell gepflegt werden.",
    };
    await recordResult(result);
    return result;
  } finally {
    await browser.close();
  }
}

function resolveChromiumPath(): string | null {
  const candidates = [
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
    "/opt/pw-browsers/chromium",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/google-chrome",
  ].filter((p): p is string => Boolean(p));

  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) return candidate;
    } catch {
      // ignore
    }
  }
  return null;
}

async function loginToSpielerplus(page: Page, email: string, password: string) {
  await page.goto("https://www.spielerplus.de/login", {
    waitUntil: "domcontentloaded",
    timeout: 30000,
  });

  const emailField = page
    .locator('input[type="email"], input[name*="email" i], input[name*="login" i]')
    .first();
  const passwordField = page.locator('input[type="password"]').first();

  await emailField.fill(email, { timeout: 10000 });
  await passwordField.fill(password, { timeout: 10000 });

  const submit = page
    .locator('button[type="submit"], input[type="submit"]')
    .first();
  await Promise.all([
    page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {}),
    submit.click(),
  ]);

  if (page.url().includes("/login")) {
    throw new Error(
      "Login bei Spielerplus fehlgeschlagen (falsche Zugangsdaten oder geaenderte Login-Seite)"
    );
  }
}

type ScrapedRow = { name: string; status: "ZUSAGE" | "ABSAGE" | "UNKNOWN" };

async function findMatchAttendance(
  page: Page,
  teamUrl: string,
  matchDate: Date
): Promise<ScrapedRow[] | null> {
  await page.goto(teamUrl, { waitUntil: "domcontentloaded", timeout: 30000 });

  const dateStr = matchDate.toLocaleDateString("de-DE");
  const matchLink = page.locator(`a:has-text("${dateStr}")`).first();
  if ((await matchLink.count()) === 0) {
    return null;
  }
  await Promise.all([
    page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {}),
    matchLink.click(),
  ]);

  const rows = page.locator(
    '[class*="participation"] [class*="player"], [class*="attendance"] tr, table tr'
  );
  const count = await rows.count();
  const result: ScrapedRow[] = [];

  for (let i = 0; i < count; i++) {
    const row = rows.nth(i);
    const text = (await row.innerText().catch(() => "")).trim();
    if (!text) continue;

    const name = text.split("\n")[0].trim();
    if (!name || name.length > 60) continue;

    const lower = text.toLowerCase();
    let status: ScrapedRow["status"] = "UNKNOWN";
    if (lower.includes("zusage") || lower.includes("zugesagt")) status = "ZUSAGE";
    else if (lower.includes("absage") || lower.includes("abgesagt")) status = "ABSAGE";

    if (status !== "UNKNOWN") {
      result.push({ name, status });
    }
  }

  return result.length > 0 ? result : null;
}

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function matchPlayerByName<T extends { name: string }>(
  players: T[],
  scrapedName: string
): T | undefined {
  const target = normalizeName(scrapedName);
  return players.find((p) => {
    const candidate = normalizeName(p.name);
    return candidate === target || candidate.includes(target) || target.includes(candidate);
  });
}

async function recordResult(result: SpielerplusSyncResult) {
  await prisma.spielerplusConfig.upsert({
    where: { id: 1 },
    update: { lastSyncAt: new Date(), lastSyncOk: result.ok, lastSyncMsg: result.message },
    create: {
      id: 1,
      lastSyncAt: new Date(),
      lastSyncOk: result.ok,
      lastSyncMsg: result.message,
    },
  });
}
