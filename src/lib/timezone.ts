const BERLIN_TZ = "Europe/Berlin";

function berlinOffsetMinutes(utcGuess: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: BERLIN_TZ,
    timeZoneName: "shortOffset",
  }).formatToParts(utcGuess);
  const offsetStr = parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT+1";
  const match = offsetStr.match(/GMT([+-]\d+)/);
  return (match ? parseInt(match[1], 10) : 1) * 60;
}

/**
 * Ersetzt die Uhrzeit eines Zeitpunkts durch die angegebene Uhrzeit in
 * Berliner Ortszeit, behaelt aber das Kalenderdatum (ebenfalls in Berliner
 * Ortszeit) bei. DST-sicher ueber Intl statt fester Stunden-Offsets, da
 * Server (lokal wie auf Vercel) standardmaessig in UTC laufen.
 */
export function withBerlinTime(instant: Date, hour: number, minute: number): Date {
  const dateParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BERLIN_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const y = Number(dateParts.find((p) => p.type === "year")!.value);
  const m = Number(dateParts.find((p) => p.type === "month")!.value);
  const d = Number(dateParts.find((p) => p.type === "day")!.value);

  const naiveUtc = Date.UTC(y, m - 1, d, hour, minute);
  const offsetMin = berlinOffsetMinutes(new Date(naiveUtc));
  return new Date(naiveUtc - offsetMin * 60_000);
}

/** Mitternacht des aktuellen Tages in Berliner Ortszeit (fuer "naechstes Spiel"-Filter). */
export function startOfBerlinDay(instant: Date = new Date()): Date {
  return withBerlinTime(instant, 0, 0);
}
