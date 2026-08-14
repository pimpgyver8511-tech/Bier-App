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
import { applyPendingMigrations } from "@/lib/db-setup";
import { RAW_IMPORT_ROWS } from "@/lib/import-data";

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
  const existing = await prisma.player.findUnique({ where: { name } });
  if (existing) return;
  await prisma.player.create({ data: { name } });
  revalidatePath("/admin/players");
  revalidatePath("/");
}

export async function bulkImportPlayersAction(formData: FormData) {
  await requireAdmin();
  const raw = String(formData.get("names") ?? "");
  const names = Array.from(
    new Set(
      raw
        .split("\n")
        .map((n) => n.trim())
        .filter(Boolean)
    )
  );

  for (const name of names) {
    await prisma.player.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

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
  if (assignment.matchId) revalidatePath(`/admin/matches/${assignment.matchId}`);
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

export async function runDbSetupAction() {
  await requireAdmin();
  const result = await applyPendingMigrations();
  revalidatePath("/admin/settings");
  revalidatePath("/admin/import");
  return result;
}

// ---------- Kasten-Historie-Import ----------

export async function loadImportRowsAction() {
  await requireAdmin();

  const players = await prisma.player.findMany();
  const playerByName = new Map(players.map((p) => [p.name, p.id]));

  await prisma.kastenImportRow.deleteMany({});
  await prisma.kastenImportRow.createMany({
    data: RAW_IMPORT_ROWS.map((row) => {
      const suggestedPlayerId = row.suggestedPlayerName
        ? playerByName.get(row.suggestedPlayerName) ?? null
        : null;
      return {
        source: row.source,
        rawDate: row.rawDate ?? null,
        resolvedDate: row.resolvedDate ? new Date(row.resolvedDate) : null,
        nickname: row.nickname,
        reason: row.reason || null,
        count: row.count ?? 1,
        suggestedPlayerId,
        playerId: suggestedPlayerId,
      };
    }),
  });

  revalidatePath("/admin/import");
}

export async function confirmImportRowAction(
  rowId: string,
  playerId: string,
  reason: string,
  count: number
) {
  await requireAdmin();
  const row = await prisma.kastenImportRow.findUniqueOrThrow({ where: { id: rowId } });
  const safeCount = Math.max(1, Math.min(10, Math.floor(count) || 1));
  const trimmedReason = reason.trim() || null;

  if (row.source === "SEITE3") {
    if (!row.resolvedDate) throw new Error("Kein Datum fuer diese Zeile hinterlegt.");
    let match = await prisma.match.findFirst({ where: { date: row.resolvedDate } });
    if (!match) {
      match = await prisma.match.create({ data: { date: row.resolvedDate } });
    }
    await prisma.kastenAssignment.createMany({
      data: Array.from({ length: safeCount }, () => ({
        matchId: match!.id,
        playerId,
        reason: trimmedReason,
        fulfilled: true,
        fulfilledAt: row.resolvedDate!,
      })),
    });
  } else if (row.source === "GUTHABEN") {
    await prisma.kastenAssignment.createMany({
      data: Array.from({ length: safeCount }, () => ({
        playerId,
        reason: trimmedReason,
        fulfilled: true,
        fulfilledAt: new Date(),
      })),
    });
  } else {
    // OFFEN: noch nicht eingeloeste Alt-Schuld, kein Spieltag bekannt
    await prisma.kastenAssignment.createMany({
      data: Array.from({ length: safeCount }, () => ({
        playerId,
        reason: trimmedReason,
        fulfilled: false,
      })),
    });
  }

  await prisma.kastenImportRow.delete({ where: { id: rowId } });
  revalidatePath("/admin/import");
  revalidatePath("/admin/history");
  revalidatePath("/verlauf");
  revalidatePath("/");
}

export async function ignoreImportRowAction(rowId: string) {
  await requireAdmin();
  await prisma.kastenImportRow.delete({ where: { id: rowId } });
  revalidatePath("/admin/import");
}
