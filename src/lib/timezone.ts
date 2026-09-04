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

function berlinInstant(y: number, m: number, d: number, hour: number, minute: number): Date {
  const naiveUtc = Date.UTC(y, m - 1, d, hour, minute);
  const offsetMin = berlinOffsetMinutes(new Date(naiveUtc));
  return new Date(naiveUtc - offsetMin * 60_000);
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
  return berlinInstant(y, m, d, hour, minute);
}

/** Mitternacht des aktuellen Tages in Berliner Ortszeit (fuer "naechstes Spiel"-Filter). */
export function startOfBerlinDay(instant: Date = new Date()): Date {
  return withBerlinTime(instant, 0, 0);
}

/**
 * Parst den Wert eines <input type="datetime-local">-Feldes (z.B.
 * "2026-09-07T18:00") als Berliner Ortszeit in einen UTC-Zeitpunkt. Noetig,
 * weil der Server (lokal wie auf Vercel) standardmaessig in UTC laeuft: ein
 * naives `new Date(value)` wuerde die eingegebene Uhrzeit sonst als UTC
 * statt als Berliner Ortszeit interpretieren (z.B. "18:00" wuerde im Sommer
 * faelschlich zu 20:00 Berliner Zeit).
 */
export function parseBerlinDateTimeLocal(value: string): Date {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!match) return new Date(value);
  const [, y, m, d, hh, mm] = match;
  return berlinInstant(Number(y), Number(m), Number(d), Number(hh), Number(mm));
}

/**
 * Gegenstueck zu parseBerlinDateTimeLocal(): formatiert einen Zeitpunkt als
 * Berliner Ortszeit im von <input type="datetime-local"> erwarteten Format,
 * zum Vorbefuellen eines Bearbeiten-Formulars.
 */
export function formatBerlinDateTimeLocal(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BERLIN_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  const hour = get("hour") === "24" ? "00" : get("hour");
  return `${get("year")}-${get("month")}-${get("day")}T${hour}:${get("minute")}`;
}
