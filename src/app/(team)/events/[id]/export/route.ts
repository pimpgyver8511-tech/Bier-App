import { isAdmin } from "@/lib/auth";
import { buildOrderCsv, getEventWithParticipants } from "@/lib/events";

/** Bestellliste als CSV (oeffnet sich direkt in Excel) - nur fuer den Admin. */
export async function GET(_request: Request, ctx: RouteContext<"/events/[id]/export">) {
  if (!(await isAdmin())) return new Response("Nicht angemeldet", { status: 401 });
  const { id } = await ctx.params;
  const event = await getEventWithParticipants(id);
  if (!event) return new Response("Nicht gefunden", { status: 404 });
  const date = event.date.toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });
  const fileName = `Essensbestellung-${event.title.replace(/[^\p{L}\p{N}]+/gu, "-")}-${date}.csv`;
  return new Response(buildOrderCsv(event.participants), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      "Cache-Control": "no-store",
    },
  });
}
