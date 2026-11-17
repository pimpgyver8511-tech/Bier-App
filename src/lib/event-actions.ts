"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/auth";
import { importEventParticipantsFromCsv } from "@/lib/events";
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

export async function updateEventInfoAction(eventId: string, formData: FormData) {
  await requireAdmin();
  const restaurant = String(formData.get("restaurant") ?? "").trim().slice(0, 120);
  const invitation = String(formData.get("invitation") ?? "")
    .replace(/\r\n/g, "\n")
    .trim()
    .slice(0, 2000);
  await prisma.teamEvent.update({
    where: { id: eventId },
    data: { restaurant: restaurant || null, invitation: invitation || null },
  });
  refresh(eventId);
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
 * Uebersicht. Preise werden bewusst nicht berechnet (rechnet das Restaurant).
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
  await prisma.eventParticipant.update({
    where: { id: participantId },
    data: {
      dish: cleaned.length ? cleaned.join(" + ") : null,
      dishPrice: null,
      note: note.trim().slice(0, 300) || null,
    },
  });
  refresh(participant.eventId);
  return { ok: true };
}
