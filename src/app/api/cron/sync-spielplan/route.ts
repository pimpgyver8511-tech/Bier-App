import { NextResponse } from "next/server";
import { syncMatchScheduleFromIcs } from "@/lib/spielerplus";

/**
 * Wird woechentlich von einem Vercel Cron Job aufgerufen (siehe vercel.json),
 * damit der Spielplan automatisch aktuell bleibt. Vercel schickt bei
 * Cron-Aufrufen automatisch "Authorization: Bearer $CRON_SECRET", sofern
 * die Env-Var CRON_SECRET im Projekt gesetzt ist - das schuetzt den Endpunkt
 * vor fremden Aufrufen, ohne dass es einer eingeloggten Session bedarf.
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const result = await syncMatchScheduleFromIcs();
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
