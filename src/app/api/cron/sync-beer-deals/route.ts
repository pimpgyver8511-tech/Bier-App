import { NextResponse } from "next/server";
import { syncBeerDeals } from "@/lib/beerdeals";

/**
 * Wird woechentlich von einem Vercel Cron Job aufgerufen (siehe vercel.json),
 * damit die Bierkasten-Angebote automatisch aktuell bleiben. Gleiches
 * CRON_SECRET-Schutzschema wie /api/cron/sync-spielplan.
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const result = await syncBeerDeals();
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
