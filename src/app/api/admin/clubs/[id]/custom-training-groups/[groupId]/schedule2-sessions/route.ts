import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { verifyAdminToken } from "@/lib/adminAuth";
import { isEligibleForMembership, isEligibleForTraining } from "@/lib/attendanceEligibility";
import type { CoachTraining } from "@/lib/coachTrainingSchedule";
import { prisma } from "@/lib/db";
import { notifySchedule2CustomTrainingChanges } from "@/lib/push/coachTrainingNotifications";
import { hasTrustedSchedule2Origin } from "@/lib/requestOrigin";
import { getConfiguredTrainingDates, getTodayIsoDateInTimeZone, isIsoDate, isoDateToUtcMidnight } from "@/lib/training";
import { trainingRequiresCheckIn } from "@/lib/trainingAttendanceDefaults";
import { publishTrainingAttendanceUpdated } from "@/lib/trainingAttendanceEvents";
import { assertNoTrainingFieldConflict, assertNoTrainingTimeConflict } from "@/lib/trainingFieldConflicts";
import { parseTrainingFieldSelection, verifyTrainingFieldSelection } from "@/lib/trainingFields";
import { TRAINING_SELECTION_WINDOW_DAYS } from "@/lib/trainingScheduleWindow";
import { getExpectedPlayersForScope, removeTrainingSessionsPreservingHistory } from "@/lib/trainingSessions";

const TIME_ZONE = "Europe/Sofia";
const UUID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
type Context = { params: Promise<{ id: string; groupId: string }> };

class ScheduleError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function getDate(value: unknown) {
  const date = typeof value === "string" ? value : "";
  if (!isIsoDate(date)) throw new ScheduleError("Невалидна дата за тренировка.");
  const today = getTodayIsoDateInTimeZone(TIME_ZONE);
  const dayOffset = (isoDateToUtcMidnight(date).getTime() - isoDateToUtcMidnight(today).getTime()) / 86_400_000;
  if (dayOffset < 0 || dayOffset >= TRAINING_SELECTION_WINDOW_DAYS) throw new ScheduleError("Датата е извън периода за планиране.");
  return date;
}

function parseSession(value: unknown) {
  const item = object(value);
  const date = getDate(item.date);
  const time = typeof item.time === "string" ? item.time : "";
  const duration = Number(item.duration);
  const note = typeof item.note === "string" ? item.note.trim() : "";
  const spots = item.maxSpots == null ? null : Number(item.maxSpots);
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time) || !Number.isInteger(duration) || duration < 1 || duration > 1440 ||
      (spots !== null && (!Number.isInteger(spots) || spots < 1 || spots > 200))) {
    throw new ScheduleError("Невалиден час, продължителност или брой места.");
  }
  try {
    return { date, time, duration, note, spots, field: parseTrainingFieldSelection({
      trainingFieldId: item.trainingFieldId, trainingFieldPieceIds: item.trainingFieldPieceIds,
    }) };
  } catch {
    throw new ScheduleError("Невалиден терен или позиция.");
  }
}

async function mutate(request: NextRequest, context: Context, operation: "create" | "edit" | "delete") {
  const token = request.cookies.get("admin_session")?.value;
  const session = token ? await verifyAdminToken(token) : null;
  if (!session?.roles.includes("admin")) {
    return NextResponse.json({ error: "Нямате достъп до График 2." }, { status: 403 });
  }
  if (!hasTrustedSchedule2Origin(request)) {
    return NextResponse.json({ error: "Адресът на сайта не е разрешен за промени в График 2." }, { status: 403 });
  }
  const { id: clubId, groupId } = await context.params;
  if (!UUID.test(clubId) || !UUID.test(groupId)) return NextResponse.json({ error: "Невалидна група." }, { status: 400 });
  const baseScope = `custom_group:${groupId}`;
  try {
    const body = object(await request.json().catch(() => null));
    if (operation !== "create" && body.sessionId !== null && (typeof body.sessionId !== "string" || !UUID.test(body.sessionId))) {
      throw new ScheduleError("Изберете конкретна тренировка.");
    }
    const sessionId = typeof body.sessionId === "string" ? body.sessionId : null;
    const scopeKey = sessionId ? `${baseScope}:session:${sessionId}` : baseScope;
    const items = operation === "delete" ? [] : body.sessions;
    if (!Array.isArray(items) || items.length > TRAINING_SELECTION_WINDOW_DAYS ||
        (operation === "create" && items.length === 0) || (operation === "edit" && items.length !== 1)) {
      throw new ScheduleError("Изберете валидни дати за тренировки.");
    }
    const changes = items.map(parseSession);
    const dates = operation === "delete" ? [getDate(body.date)] : changes.map((item) => item.date);
    if (new Set(dates).size !== dates.length) throw new ScheduleError("Изберете всяка дата само веднъж.");

    const { before, after } = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM clubs WHERE id = ${clubId}::uuid FOR UPDATE`;
      const group = await tx.clubCustomTrainingGroup.findFirst({
        where: { id: groupId, clubId, club: { trainingGroupMode: "custom_group" } },
        include: { club: { select: { paymentWorkflow: true } } },
      });
      if (!group) throw new ScheduleError("Персонализираната група не е намерена.", 404);
      const trainingDate = isoDateToUtcMidnight(dates[0]);
      const legacy = {
        clubId, scopeKey: baseScope, scopeId: groupId, scopeType: "customGroup", trainingDate, occurrenceKey: "",
      };
      if (operation !== "create") {
        await tx.$queryRaw`SELECT id FROM training_sessions WHERE club_id = ${clubId}::uuid AND scope_key = ${scopeKey} AND training_date = ${trainingDate} FOR UPDATE`;
      }
      const existing = operation === "create" ? null : await tx.trainingSession.findFirst({
        where: { clubId, trainingDate, scopeKey, occurrenceKey: sessionId ?? "", ...(sessionId ? { id: sessionId, scopeId: groupId } : {}) },
      });
      const legacyConfigured = !sessionId && getConfiguredTrainingDates({
        trainingDates: group.trainingDates, weekdays: group.trainingWeekdays,
        windowDays: group.trainingWindowDays, timeZone: TIME_ZONE,
      }).includes(dates[0]);
      if (operation !== "create" && (existing?.status === "cancelled" || existing?.removedFromSchedule ||
          (sessionId ? !existing : !legacyConfigured))) {
        throw new ScheduleError("Тренировката вече не е в графика.", 404);
      }
      const legacyId = `${dates[0]}-custom-${groupId}`;
      const previous: CoachTraining = {
        id: existing?.id ?? legacyId, date: dates[0],
        trainingTime: existing?.trainingTime ?? String(object(group.trainingDateTimes)[dates[0]] ?? group.trainingTime ?? ""),
        trainingDurationMinutes: existing?.trainingDurationMinutes ?? group.trainingDurationMinutes,
        trainingFieldId: existing?.trainingFieldId ?? group.trainingFieldId,
        trainingFieldPieceIds: existing?.trainingFieldPieceIds ?? group.trainingFieldPieceIds,
        recurrenceId: null, status: "scheduled", note: existing?.note ?? "",
      };
      const after: CoachTraining[] = [];
      if (operation === "delete") {
        await tx.limitedTrainingEvent.deleteMany({ where: { clubId, scopeKey, trainingDate } });
        await tx.trainingNote.deleteMany({ where: { clubId, scopeKey, trainingDate } });
        if (sessionId) await removeTrainingSessionsPreservingHistory(tx, { id: sessionId, clubId, scopeKey });
        else if (existing) await tx.trainingSession.update({ where: { id: existing.id }, data: { status: "cancelled" } });
        else await tx.trainingSession.create({ data: { ...legacy, status: "cancelled" } });
        return { before: [previous], after };
      }

      const hasFields = await tx.field.count({ where: { clubId }, take: 1 }) > 0;
      if (hasFields && changes.some(({ field }) => !field.trainingFieldId)) throw new ScheduleError("Изберете терен.");
      const exclude = operation === "edit"
        ? { type: "customGroup" as const, id: groupId, sessionId: sessionId ?? undefined }
        : undefined;
      const conflict = {
        clubId, trainingDates: dates,
        trainingDateTimes: Object.fromEntries(changes.map(({ date, time }) => [date, time])),
        trainingDurationMinutes: changes[0].duration,
        trainingDurationsByDate: Object.fromEntries(changes.map(({ date, duration }) => [date, duration])),
        exclude,
      };
      try {
        const selections = new Map(changes.map(({ field }) => [JSON.stringify(field), field]));
        for (const field of selections.values()) await verifyTrainingFieldSelection(clubId, field, tx);
        if (hasFields) await assertNoTrainingFieldConflict({
          ...conflict, ...changes[0].field,
          trainingFieldSelections: Object.fromEntries(changes.map(({ date, field }) => [date, field])),
        }, tx);
        await assertNoTrainingTimeConflict({ ...conflict, ignoreFieldResourceSchedules: hasFields }, tx);
      } catch (error) {
        if (error instanceof Error && !("code" in error)) throw new ScheduleError(error.message);
        throw error;
      }
      const roster = operation === "create" || !existing
        ? await getExpectedPlayersForScope(tx, clubId, { type: "customGroup", id: groupId })
        : [];
      const requiresCheckIn = trainingRequiresCheckIn(group.club.paymentWorkflow);
      for (const change of changes) {
        const data = {
          trainingTime: change.time, trainingDurationMinutes: change.duration, ...change.field, note: change.note || null,
        };
        if (operation === "edit") {
          if (existing) {
            const now = new Date();
            const started = !isEligibleForTraining(now, change.date, existing.trainingTime);
            await tx.trainingSession.update({
              where: { id: existing.id },
              data: { ...data, ...(started && !existing.rosterLockedAt ? { rosterLockedAt: now } : {}) },
            });
          } else {
            const eligible = roster.filter((player) => isEligibleForMembership(player, change.date, change.time, baseScope));
            const optOuts = eligible.length ? await tx.trainingOptOut.findMany({
              where: { playerId: { in: eligible.map(({ id }) => id) }, trainingDate },
            }) : [];
            const optOutByPlayer = new Map(optOuts.map((entry) => [entry.playerId, entry]));
            await tx.trainingSession.create({ data: {
              ...legacy, ...data,
              players: { createMany: { data: eligible.map((player) => {
                const optedOut = optOutByPlayer.get(player.id);
                return {
                  playerId: player.id, playerName: player.fullName, teamGroup: player.teamGroup,
                  present: !requiresCheckIn && !optedOut,
                  reasonCode: optedOut?.reasonCode ?? null, reasonText: optedOut?.reasonText ?? null,
                };
              }) } },
            } });
          }
          if (!sessionId) {
            await tx.clubCustomTrainingGroup.update({ where: { id: groupId }, data: {
              trainingDateTimes: { ...object(group.trainingDateTimes) as Record<string, string>, [change.date]: change.time },
              trainingFieldSelections: { ...object(group.trainingFieldSelections) as Record<string, typeof change.field>, [change.date]: change.field },
            } });
            if (change.note) {
              await tx.trainingNote.upsert({
                where: { clubId_trainingDate_scopeKey: { clubId, trainingDate, scopeKey } },
                create: { clubId, trainingDate, scopeKey, note: change.note }, update: { note: change.note },
              });
            } else await tx.trainingNote.deleteMany({ where: { clubId, trainingDate, scopeKey } });
          }
          after.push({ ...previous, ...data, note: change.note });
          continue;
        }
        const id = randomUUID();
        const date = isoDateToUtcMidnight(change.date);
        const occurrenceScope = `${baseScope}:session:${id}`;
        const eligible = roster.filter((player) => isEligibleForMembership(player, change.date, change.time, baseScope));
        await tx.trainingSession.create({ data: {
          ...legacy, ...data, id, scopeKey: occurrenceScope, occurrenceKey: id, trainingDate: date,
          players: { createMany: { data: eligible.map((player) => ({
            playerId: player.id, playerName: player.fullName, teamGroup: player.teamGroup,
            present: !change.spots && !requiresCheckIn,
            reasonCode: change.spots && !requiresCheckIn ? "limited_event" : null,
          })) } },
        } });
        if (change.spots) await tx.limitedTrainingEvent.create({ data: {
          clubId, scopeKey: occurrenceScope, scopeId: groupId, trainingDate: date, maxSpots: change.spots,
        } });
        after.push({ ...data, id, date: change.date, recurrenceId: null, status: "scheduled", note: change.note });
      }
      return { before: operation === "edit" ? [previous] : [], after };
    }, { timeout: 15000 });
    for (const date of dates) publishTrainingAttendanceUpdated(clubId, date);
    await notifySchedule2CustomTrainingChanges(clubId, groupId, before, after)
      .catch((error) => console.error("Schedule 2 training notification failed:", error));
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof ScheduleError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("Schedule 2 session update failed:", error);
    return NextResponse.json({ error: "Промяната в графика не бе запазена." }, { status: 500 });
  }
}

export const POST = (request: NextRequest, context: Context) => mutate(request, context, "create");
export const PATCH = (request: NextRequest, context: Context) => mutate(request, context, "edit");
export const DELETE = (request: NextRequest, context: Context) => mutate(request, context, "delete");
