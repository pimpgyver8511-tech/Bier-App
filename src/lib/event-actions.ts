"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/auth";
import { importEventParticipantsFromCsv } from "@/lib/events";
import { fetchMenu, menuChoices } from "@/lib/menu";
import { parseBerlinDateTimeLocal } from "@/lib/timezone";

async function requireAdmin() {
  if (!(await isAdmin())) throw new Error("Nicht angemeldet");
}

function refresh(eventId?: string) {
  revalidatePath("/events");
  revalidatePath("/");
  if (eventId) revalidatePath("/events/[id]", "page");
}

export async function createEventAction(formData: FormData) {
  await requireAdmin();
  const title = String(formData.get("title") ?? "").trim();
  const dateStr = String(formData.get("date") ?? "");
  if (!title || !dateStr) return;
  const location = String(formData.get("location") ?? "").trim() || null;
  const event = await prisma.teamEvent.create({
    data: { title, date: parseBerlinDateTimeLocal(dateStr), location },
  });
  refresh();
  redirect(`/events/${event.id}`);
}

export async function deleteEventAction(eventId: string) {
  await requireAdmin();
  await prisma.teamEvent.delete({ where: { id: eventId } });
  refresh();
  redirect("/events");
}

export async function updateEventMealSettingsAction(eventId: string, formData: FormData) {
  await requireAdmin();
  const menuUrl = String(formData.get("menuUrl") ?? "").trim();
  if (menuUrl && !/^https?:\/\//i.test(menuUrl)) return;
  await prisma.teamEvent.update({
    where: { id: eventId },
    data: {
      mealOrder: formData.get("mealOrder") === "on",
      menuUrl: menuUrl || null,
      orderLocked: formData.get("orderLocked") === "on",
    },
  });
  refresh(eventId);
}

export async function addEventParticipantAction(eventId: string, formData: FormData) {
  await requireAdmin();
  const playerId = String(formData.get("playerId") ?? "");
  const guestName = String(formData.get("name") ?? "").trim();
  let name = guestName;
  let linkedPlayer: string | null = null;
  if (playerId) {
    const player = await prisma.player.findUnique({ where: { id: playerId } });
    if (!player) return;
    name = player.name;
    linkedPlayer = player.id;
  }
  if (!name) return;
  const exists = await prisma.eventParticipant.findFirst({
    where: { eventId, OR: [{ name: { equals: name, mode: "insensitive" } }, ...(linkedPlayer ? [{ playerId: linkedPlayer }] : [])] },
  });
  if (!exists) {
    await prisma.eventParticipant.create({ data: { eventId, name, playerId: linkedPlayer, source: "MANUAL" } });
  }
  refresh(eventId);
}

export async function removeEventParticipantAction(participantId: string) {
  await requireAdmin();
  const p = await prisma.eventParticipant.delete({ where: { id: participantId } });
  refresh(p.eventId);
}

export async function importEventCsvAction(eventId: string, formData: FormData) {
  await requireAdmin();
  const file = formData.get("file");
  if (!(file instanceof File)) return { ok: false, message: "Keine Datei ausgewählt." };
  const result = await importEventParticipantsFromCsv(eventId, await file.text());
  refresh(eventId);
  return result;
}

export type MealChoiceResult = { ok: boolean; message?: string };

/**
 * Essenswahl eines Teilnehmers - ohne Login, wie die restliche Team-
 * Uebersicht. Die Preise werden serverseitig aus der Speisekarte ermittelt,
 * nicht vom Browser uebernommen.
 */
export async function saveMealChoiceAction(
  participantId: string,
  dishes: string[],
  note: string
): Promise<MealChoiceResult> {
  const participant = await prisma.eventParticipant.findUnique({
    where: { id: participantId },
    include: { event: true },
  });
  if (!participant || !participant.event.mealOrder) return { ok: false, message: "Nicht gefunden." };
  if (participant.event.orderLocked && !(await isAdmin())) {
    return { ok: false, message: "Die Bestellung ist bereits abgeschlossen." };
  }
  const cleaned = dishes.map((d) => d.trim().slice(0, 120)).filter(Boolean).slice(0, 3);
  const choices = participant.event.menuUrl ? menuChoices((await fetchMenu(participant.event.menuUrl)) ?? []) : [];
  let price = 0;
  let priceKnown = cleaned.length > 0;
  for (const dish of cleaned) {
    const choice = choices.find((c) => c.label === dish);
    if (choice) price += choice.price;
    else priceKnown = false;
  }
  await prisma.eventParticipant.update({
    where: { id: participantId },
    data: {
      dish: cleaned.length ? cleaned.join(" + ") : null,
      dishPrice: priceKnown ? Math.round(price * 100) / 100 : null,
      note: note.trim().slice(0, 300) || null,
    },
  });
  refresh(participant.eventId);
  return { ok: true };
}
