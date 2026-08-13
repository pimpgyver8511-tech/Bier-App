"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import {
  checkPassword,
  createAdminSession,
  destroyAdminSession,
  isAdmin,
} from "@/lib/auth";
import { buildAssignmentSuggestion } from "@/lib/kasten";
import { runSpielerplusSync } from "@/lib/spielerplus";

async function requireAdmin() {
  if (!(await isAdmin())) {
    throw new Error("Nicht angemeldet");
  }
}

// ---------- Auth ----------

export async function loginAction(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  if (!checkPassword(password)) {
    redirect("/admin?error=1");
  }
  await createAdminSession();
  redirect("/admin");
}

export async function logoutAction() {
  await destroyAdminSession();
  redirect("/");
}

// ---------- Players ----------

export async function createPlayerAction(formData: FormData) {
  await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  await prisma.player.create({ data: { name } });
  revalidatePath("/admin/players");
  revalidatePath("/");
}

export async function togglePlayerActiveAction(playerId: string, active: boolean) {
  await requireAdmin();
  await prisma.player.update({ where: { id: playerId }, data: { active } });
  revalidatePath("/admin/players");
  revalidatePath("/");
}

export async function deletePlayerAction(playerId: string) {
  await requireAdmin();
  await prisma.player.delete({ where: { id: playerId } });
  revalidatePath("/admin/players");
  revalidatePath("/");
}

// ---------- Matches ----------

export async function createMatchAction(formData: FormData) {
  await requireAdmin();
  const dateStr = String(formData.get("date") ?? "");
  const opponent = String(formData.get("opponent") ?? "").trim() || null;
  const location = String(formData.get("location") ?? "").trim() || null;
  const isHome = formData.get("isHome") === "on";
  if (!dateStr) return;

  const match = await prisma.match.create({
    data: { date: new Date(dateStr), opponent, location, isHome },
  });

  const players = await prisma.player.findMany({ where: { active: true } });
  await prisma.attendance.createMany({
    data: players.map((p) => ({ matchId: match.id, playerId: p.id })),
  });

  revalidatePath("/admin/matches");
  revalidatePath("/");
  redirect(`/admin/matches/${match.id}`);
}

export async function deleteMatchAction(matchId: string) {
  await requireAdmin();
  await prisma.match.delete({ where: { id: matchId } });
  revalidatePath("/admin/matches");
  revalidatePath("/");
}

// ---------- Attendance ----------

export async function setAttendanceAction(
  matchId: string,
  playerId: string,
  status: "ZUSAGE" | "ABSAGE" | "UNKNOWN"
) {
  await requireAdmin();
  await prisma.attendance.upsert({
    where: { matchId_playerId: { matchId, playerId } },
    update: { status, source: "MANUAL" },
    create: { matchId, playerId, status, source: "MANUAL" },
  });
  revalidatePath(`/admin/matches/${matchId}`);
  revalidatePath("/");
}

export async function syncSpielerplusAction(matchId: string) {
  await requireAdmin();
  const result = await runSpielerplusSync(matchId);
  revalidatePath(`/admin/matches/${matchId}`);
  revalidatePath("/admin/settings");
  revalidatePath("/");
  return result;
}

// ---------- Kasten-Zuweisung ----------

export async function confirmAssignmentAction(
  matchId: string,
  playerIds: string[],
  reason: string
) {
  await requireAdmin();
  await prisma.$transaction(
    playerIds.map((playerId) =>
      prisma.kastenAssignment.create({
        data: { matchId, playerId, reason: reason || null },
      })
    )
  );
  revalidatePath(`/admin/matches/${matchId}`);
  revalidatePath("/admin/history");
  revalidatePath("/");
}

export async function deleteAssignmentAction(assignmentId: string) {
  await requireAdmin();
  const assignment = await prisma.kastenAssignment.delete({
    where: { id: assignmentId },
  });
  revalidatePath(`/admin/matches/${assignment.matchId}`);
  revalidatePath("/admin/history");
  revalidatePath("/");
}

export async function toggleAssignmentFulfilledAction(
  assignmentId: string,
  fulfilled: boolean
) {
  await requireAdmin();
  await prisma.kastenAssignment.update({
    where: { id: assignmentId },
    data: { fulfilled, fulfilledAt: fulfilled ? new Date() : null },
  });
  revalidatePath("/admin/history");
  revalidatePath("/");
}

export async function updateAssignmentReasonAction(
  assignmentId: string,
  reason: string
) {
  await requireAdmin();
  await prisma.kastenAssignment.update({
    where: { id: assignmentId },
    data: { reason: reason || null },
  });
  revalidatePath("/admin/history");
  revalidatePath("/");
}

export async function getSuggestionAction(matchId: string) {
  await requireAdmin();
  return buildAssignmentSuggestion(matchId);
}

// ---------- Settings ----------

export async function updateSettingsAction(formData: FormData) {
  await requireAdmin();
  const cooldownWeeks = Number(formData.get("cooldownWeeks") ?? 6);
  const kastenPerMatch = Number(formData.get("kastenPerMatch") ?? 2);
  await prisma.settings.upsert({
    where: { id: 1 },
    update: { cooldownWeeks, kastenPerMatch },
    create: { id: 1, cooldownWeeks, kastenPerMatch },
  });
  revalidatePath("/admin/settings");
}

export async function updateSpielerplusUrlAction(formData: FormData) {
  await requireAdmin();
  const teamUrl = String(formData.get("teamUrl") ?? "").trim() || null;
  await prisma.spielerplusConfig.upsert({
    where: { id: 1 },
    update: { teamUrl },
    create: { id: 1, teamUrl },
  });
  revalidatePath("/admin/settings");
}
