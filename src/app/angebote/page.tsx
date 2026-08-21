import { isAdmin } from "@/lib/auth";
import { redirect } from "next/navigation";
import { BeerDealsCard } from "@/components/BeerDealsCard";
import { getAllBeerDeals, getBeerDealsConfig } from "@/lib/beerdeals";

export default async function BeerDealsPage() {
  if (!(await isAdmin())) redirect("/admin");

  let beerDeals: Awaited<ReturnType<typeof getAllBeerDeals>> = [];
  let beerDealsConfig: Awaited<ReturnType<typeof getBeerDealsConfig>> = null;
  try {
    [beerDeals, beerDealsConfig] = await Promise.all([getAllBeerDeals(), getBeerDealsConfig()]);
  } catch {
    // Tabelle evtl. noch nicht eingerichtet (siehe Admin > Einstellungen)
  }

  return (
    <BeerDealsCard
      deals={beerDeals}
      lastSyncAt={beerDealsConfig?.lastSyncAt ?? null}
      lastSyncOk={beerDealsConfig?.lastSyncOk ?? false}
      lastSyncMsg={beerDealsConfig?.lastSyncMsg ?? null}
    />
  );
}
