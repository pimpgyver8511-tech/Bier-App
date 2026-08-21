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
import { syncMatchScheduleFromIcs, importAttendanceFromCsv } from "@/lib/spielerplus";
import { syncBeerDeals } from "@/lib/beerdeals";
import { applyPendingMigrations } from "@/lib/db-setup";
import { RAW_IMPORT_ROWS } from "@/lib/import-data";
import { withBerlinTime } from "@/lib/timezone";

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

export async function renamePlayerAction(playerId: string, newName: string) {
  await requireAdmin();
  const name = newName.trim();
  if (!name) return;
  const player = await prisma.player.findUniqueOrThrow({ where: { id: playerId } });
  if (player.name === name) return;
  // Alter Name bleibt als Alias hinterlegt, damit z.B. der Spielerplus-
  // CSV-Import (der ggf. noch den alten Namen liefert, etwa nach Heirat)
  // den Spieler weiterhin zuordnen kann.
  await prisma.player.update({
    where: { id: playerId },
    data: { name, alias: player.name },
  });
  revalidatePath("/admin/players");
  revalidatePath("/");
}

export async function updatePlayerAliasAction(playerId: string, alias: string) {
  await requireAdmin();
  await prisma.player.update({
    where: { id: playerId },
    data: { alias: alias.trim() || null },
  });
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
  const kastenReason = String(formData.get("kastenReason") ?? "").trim() || null;
  const kastenPlayerIds = formData.getAll("kastenPlayers").map(String).filter(Boolean);
  if (!dateStr) return;

  const match = await prisma.match.create({
    data: { date: new Date(dateStr), opponent, location, isHome },
  });

  const players = await prisma.player.findMany({ where: { active: true } });
  await prisma.attendance.createMany({
    data: players.map((p) => ({ matchId: match.id, playerId: p.id })),
  });

  if (kastenPlayerIds.length > 0) {
    await prisma.kastenAssignment.createMany({
      data: kastenPlayerIds.map((playerId) => ({
        matchId: match.id,
        playerId,
        reason: kastenReason,
        fulfilled: false,
      })),
    });
  }

  revalidatePath("/admin/matches");
  revalidatePath("/admin/history");
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
  status: "ZUSAGE" | "ABSAGE" | "UNSICHER" | "UNKNOWN"
) {
  await requireAdmin();
  await prisma.attendance.upsert({
    where: { matchId_playerId: { matchId, playerId } },
    update: { status, source: "MANUAL" },
    create: { matchId, playerId, status, source: "MANUAL" },
  });
  revalidatePath(`/admin/matches/${matchId}`);
  revalidatePath("/admin/matches");
  revalidatePath("/");
}

export async function importAttendanceCsvAction(matchId: string, formData: FormData) {
  await requireAdmin();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { ok: false, message: "Keine Datei ausgewählt.", matchedCount: 0, unmatchedNames: [] };
  }
  const text = await file.text();
  const result = await importAttendanceFromCsv(matchId, text);
  revalidatePath(`/admin/matches/${matchId}`);
  revalidatePath("/admin/matches");
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
  // Ein Kasten kann nur zugeteilt werden, wenn der Spieler fuer dieses Spiel
  // auch tatsaechlich zugesagt hat.
  const attendances = await prisma.attendance.findMany({
    where: { matchId, playerId: { in: playerIds }, status: "ZUSAGE" },
    select: { playerId: true },
  });
  const attendingIds = new Set(attendances.map((a) => a.playerId));
  const eligiblePlayerIds = playerIds.filter((id) => attendingIds.has(id));

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    for (const playerId of eligiblePlayerIds) {
      // Hat der Spieler schon einen wirklich offenen (unerfuellten, keinem
      // kuenftigen Spiel zugeordneten) Kasten, wird der diesem Spiel
      // zugeordnet, statt einen zusaetzlichen neuen anzulegen - er baut damit
      // eine bestehende Schuld ab, statt eine weitere aufzubauen.
      const existingPending = await tx.kastenAssignment.findFirst({
        where: {
          playerId,
          fulfilled: false,
          OR: [{ matchId: null }, { match: { date: { lte: now } } }],
        },
        orderBy: { createdAt: "asc" },
      });
      if (existingPending) {
        await tx.kastenAssignment.update({
          where: { id: existingPending.id },
          data: { matchId },
        });
      } else {
        await tx.kastenAssignment.create({
          data: { matchId, playerId, reason: reason || null },
        });
      }
    }
  });
  revalidatePath(`/admin/matches/${matchId}`);
  revalidatePath("/admin/matches");
  revalidatePath("/admin/history");
  revalidatePath("/");
}

export async function deleteAssignmentAction(assignmentId: string) {
  await requireAdmin();
  const assignment = await prisma.kastenAssignment.delete({
    where: { id: assignmentId },
  });
  if (assignment.matchId) revalidatePath(`/admin/matches/${assignment.matchId}`);
  revalidatePath("/admin/matches");
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

export async function setAssignmentDateAction(assignmentId: string, dateStr: string) {
  await requireAdmin();
  if (!dateStr) return;
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return;

  const existing = await prisma.kastenAssignment.findUniqueOrThrow({
    where: { id: assignmentId },
  });

  // dateStr kommt aus einem reinen <input type="date"> (Kalendertag ohne
  // Uhrzeit) und soll den Kalendertag in Berliner Ortszeit treffen. Ein
  // exakter Zeitpunkt-Abgleich (wie zuvor) fand nie ein bereits per
  // ICS/Spielerplus synchronisiertes Spiel (die haben eine echte Anstosszeit,
  // z.B. 19:00), wodurch fuer denselben Tag ein zweites, leeres Spiel um
  // 00:00 UTC angelegt wurde - Zusagen/Kasten liefen dann auseinander.
  // Deshalb hier auf den ganzen Kalendertag suchen statt auf die exakte Uhrzeit.
  const dayStart = withBerlinTime(new Date(Date.UTC(y, m - 1, d)), 0, 0);
  const dayEnd = withBerlinTime(new Date(Date.UTC(y, m - 1, d)), 23, 59);

  let match = await prisma.match.findFirst({
    where: { date: { gte: dayStart, lte: dayEnd } },
    orderBy: { date: "asc" },
  });
  if (!match) {
    match = await prisma.match.create({ data: { date: dayStart } });
  }

  // Sobald ein Spieltag in der Vergangenheit gesetzt wird (egal ob neu
  // verknuepft oder ein bestehendes Datum geaendert), ist das erkennbar ein
  // rueckwirkend erfasster, schon erledigter Kasten - automatisch als
  // erledigt markieren statt eine zusaetzliche manuelle Bestaetigung zu
  // verlangen. Der Status bleibt danach ganz normal ueber den Badge
  // manuell umschaltbar, falls doch mal ein Kasten trotz vergangenem Datum
  // noch nicht geliefert wurde.
  const isPastDate = dayStart.getTime() < Date.now();
  const shouldAutoFulfill = isPastDate && !existing.fulfilled;

  const updated = await prisma.kastenAssignment.update({
    where: { id: assignmentId },
    data: {
      matchId: match.id,
      ...(shouldAutoFulfill ? { fulfilled: true, fulfilledAt: dayStart } : {}),
    },
  });
  revalidatePath("/admin/history");
  revalidatePath("/admin/matches");
  revalidatePath("/");
  return { fulfilled: updated.fulfilled };
}

export async function addManualKastenAction(playerId: string, reason: string) {
  await requireAdmin();
  await prisma.kastenAssignment.create({
    data: {
      playerId,
      reason: reason.trim() || null,
      fulfilled: false,
    },
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

export async function updateIcsUrlAction(formData: FormData) {
  await requireAdmin();
  const icsUrl = String(formData.get("icsUrl") ?? "").trim() || null;
  await prisma.spielerplusConfig.upsert({
    where: { id: 1 },
    update: { icsUrl },
    create: { id: 1, icsUrl },
  });
  revalidatePath("/admin/settings");
}

export async function syncMatchScheduleAction() {
  await requireAdmin();
  const result = await syncMatchScheduleFromIcs();
  revalidatePath("/admin/matches");
  revalidatePath("/admin/settings");
  revalidatePath("/");
  return result;
}

export async function syncBeerDealsAction() {
  await requireAdmin();
  const result = await syncBeerDeals();
  revalidatePath("/");
  return result;
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
  reasons: string[]
) {
  await requireAdmin();
  const row = await prisma.kastenImportRow.findUniqueOrThrow({ where: { id: rowId } });
  const cleanReasons = reasons.map((r) => r.trim()).filter(Boolean);
  const finalReasons = cleanReasons.length > 0 ? cleanReasons.slice(0, 10) : [null];

  if (row.source === "SEITE3") {
    if (!row.resolvedDate) throw new Error("Kein Datum fuer diese Zeile hinterlegt.");
    let match = await prisma.match.findFirst({ where: { date: row.resolvedDate } });
    if (!match) {
      match = await prisma.match.create({ data: { date: row.resolvedDate } });
    }
    await prisma.kastenAssignment.createMany({
      data: finalReasons.map((reason) => ({
        matchId: match!.id,
        playerId,
        reason,
        fulfilled: true,
        fulfilledAt: row.resolvedDate!,
      })),
    });
  } else if (row.source === "GUTHABEN") {
    await prisma.kastenAssignment.createMany({
      data: finalReasons.map((reason) => ({
        playerId,
        reason,
        fulfilled: true,
        fulfilledAt: new Date(),
      })),
    });
  } else {
    // OFFEN: noch nicht eingeloeste Alt-Schuld, kein Spieltag bekannt
    await prisma.kastenAssignment.createMany({
      data: finalReasons.map((reason) => ({
        playerId,
        reason,
        fulfilled: false,
      })),
    });
  }

  await prisma.kastenImportRow.delete({ where: { id: rowId } });
  revalidatePath("/admin/import");
  revalidatePath("/admin/history");
  revalidatePath("/");
}

export async function ignoreImportRowAction(rowId: string) {
  await requireAdmin();
  await prisma.kastenImportRow.delete({ where: { id: rowId } });
  revalidatePath("/admin/import");
}
