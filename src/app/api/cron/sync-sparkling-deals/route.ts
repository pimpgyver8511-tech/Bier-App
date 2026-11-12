import { NextResponse } from "next/server";
import { syncSparklingDeals } from "@/lib/sparklingdeals";

/**
 * Taeglich per Vercel Cron (siehe vercel.json) - eigener Lauf statt im
 * Bier-Cron, damit ein langsamer/fehlschlagender Sekt-Sync die
 * Bierangebote nicht beeinflusst. Gleiches CRON_SECRET-Schema wie die
 * anderen Cron-Routen.
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const result = await syncSparklingDeals();
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
