import { prisma } from "@/lib/db";

interface TrainingFieldConflictInput {
  clubId: string;
  trainingDates: string[];
  trainingDateTimes: Record<string, string>;
  trainingDurationMinutes: number;
  trainingFieldId: string | null;
  trainingFieldPieceIds: string[];
  trainingFieldSelections?: Record<string, { trainingFieldId: string | null; trainingFieldPieceIds: string[] }>;
  exclude?: {
    type: "club" | "teamGroup" | "trainingGroup" | "customGroup" | "coachGroup";
    id?: string;
    teamGroup?: number | null;
  };
  excludeTeamGroups?: number[];
}

type ScheduleType = NonNullable<TrainingFieldConflictInput["exclude"]>["type"];

interface ExistingSchedule {
  label: string;
  type: ScheduleType;
  id?: string;
  teamGroup?: number | null;
  teamGroups?: number[];
  trainingDates: string[];
  trainingDateTimes: unknown;
  trainingDurationMinutes: number;
  trainingFieldId: string | null;
  trainingFieldPieceIds: string[];
  trainingFieldSelections: unknown;
}

export interface OccupiedFieldResource {
  date: string;
  fieldId: string;
  pieceIds: string[];
  label: string;
}

interface OccupiedResourcesInput {
  clubId: string;
  trainingDates: string[];
  trainingDateTimes: Record<string, string>;
  trainingDurationMinutes: number;
  exclude?: TrainingFieldConflictInput["exclude"];
  excludeTeamGroups?: number[];
}

function parseTimeToMinutes(value: string): number | null {
  const match = value.trim().match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  if (!match) {
    return null;
  }
  return Number(match[1]) * 60 + Number(match[2]);
}

function normalizeStoredDateTimes(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }
  const result: Record<string, string> = {};
  for (const [date, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === "string" && parseTimeToMinutes(value) !== null) {
      result[date] = value.trim();
    }
  }
  return result;
}

function normalizeStoredFieldSelections(
  raw: unknown,
): Record<string, { trainingFieldId: string | null; trainingFieldPieceIds: string[] }> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }
  const result: Record<string, { trainingFieldId: string | null; trainingFieldPieceIds: string[] }> = {};
  for (const [date, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !value || typeof value !== "object" || Array.isArray(value)) {
      continue;
    }
    const source = value as Record<string, unknown>;
    const trainingFieldId = typeof source.trainingFieldId === "string" && source.trainingFieldId.trim()
      ? source.trainingFieldId.trim()
      : null;
    const trainingFieldPieceIds = Array.isArray(source.trainingFieldPieceIds)
      ? source.trainingFieldPieceIds.map((id) => String(id ?? "").trim()).filter(Boolean)
      : [];
    result[date] = { trainingFieldId, trainingFieldPieceIds };
  }
  return result;
}

function getFieldSelectionForDate(
  schedule: Pick<ExistingSchedule, "trainingFieldId" | "trainingFieldPieceIds" | "trainingFieldSelections">,
  date: string,
) {
  const selections = normalizeStoredFieldSelections(schedule.trainingFieldSelections);
  return selections[date] ?? {
    trainingFieldId: schedule.trainingFieldId,
    trainingFieldPieceIds: schedule.trainingFieldPieceIds,
  };
}

function isSameExcludedSchedule(
  schedule: ExistingSchedule,
  exclude: TrainingFieldConflictInput["exclude"],
): boolean {
  if (!exclude || schedule.type !== exclude.type) {
    return false;
  }
  if (exclude.type === "teamGroup") {
    return schedule.teamGroup === exclude.teamGroup;
  }
  if (exclude.type === "club") {
    return true;
  }
  return Boolean(exclude.id && schedule.id === exclude.id);
}

function isExcludedTeamGroupSchedule(
  schedule: ExistingSchedule,
  excludedTeamGroups: Set<number>,
): boolean {
  if (schedule.type === "teamGroup" && typeof schedule.teamGroup === "number") {
    return excludedTeamGroups.has(schedule.teamGroup);
  }
  if (schedule.type === "trainingGroup" && Array.isArray(schedule.teamGroups)) {
    return schedule.teamGroups.some((teamGroup) => excludedTeamGroups.has(teamGroup));
  }
  return false;
}

function isSameFieldResource(a: {
  trainingFieldId: string | null;
  trainingFieldPieceIds: string[];
}, b: {
  trainingFieldId: string | null;
  trainingFieldPieceIds: string[];
}): boolean {
  if (!a.trainingFieldId || !b.trainingFieldId || a.trainingFieldId !== b.trainingFieldId) {
    return false;
  }

  // Whole-field booking (empty array) conflicts with any other booking on the same field.
  if (a.trainingFieldPieceIds.length === 0 || b.trainingFieldPieceIds.length === 0) {
    return true;
  }

  // Both have specific pieces — conflict if any piece overlaps.
  return a.trainingFieldPieceIds.some((id) => b.trainingFieldPieceIds.includes(id));
}

function overlaps(startA: number, durationA: number, startB: number, durationB: number): boolean {
  return startA < startB + durationB && startB < startA + durationA;
}

function matchTeamGroupsOverlap(a: number[], b: number[]): boolean {
  return a.length === 0 || b.length === 0 || a.some((teamGroup) => b.includes(teamGroup));
}

function formatIsoDateForBgDisplay(isoDate: string): string {
  const match = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return isoDate;
  }
  return `${match[3]}.${match[2]}.${match[1]}`;
}

function formatMinutesAsTime(totalMinutes: number): string {
  const normalized = ((totalMinutes % (24 * 60)) + (24 * 60)) % (24 * 60);
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function formatConflictMessage(input: {
  date: string;
  startMinutes: number;
  durationMinutes: number;
  label: string;
}): string {
  const startTime = formatMinutesAsTime(input.startMinutes);
  const endTime = formatMinutesAsTime(input.startMinutes + input.durationMinutes);
  return `Теренът вече е зает на ${formatIsoDateForBgDisplay(input.date)} от ${startTime} до ${endTime} за ${input.label}.`;
}

function formatTimeConflictMessage(input: {
  date: string;
  startMinutes: number;
  durationMinutes: number;
  label: string;
}): string {
  const startTime = formatMinutesAsTime(input.startMinutes);
  const endTime = formatMinutesAsTime(input.startMinutes + input.durationMinutes);
  return `На ${formatIsoDateForBgDisplay(input.date)} вече има тренировка от ${startTime} до ${endTime} за ${input.label}.`;
}

async function loadSchedules(clubId: string, relevantDates: string[]): Promise<ExistingSchedule[]> {
  const [club, teamSchedules, trainingGroups, customGroups, coachGroups] = await Promise.all([
    prisma.club.findUnique({
      where: { id: clubId },
      select: {
        trainingDates: true,
        trainingDateTimes: true,
        trainingDurationMinutes: true,
        trainingFieldId: true,
        trainingFieldPieceIds: true,
        trainingFieldSelections: true,
      },
    }),
    prisma.clubTrainingGroupSchedule.findMany({
      where: {
        clubId,
        trainingDates: { hasSome: relevantDates },
        trainingFieldId: { not: null },
      },
      select: {
        teamGroup: true,
        trainingDates: true,
        trainingDateTimes: true,
        trainingDurationMinutes: true,
        trainingFieldId: true,
        trainingFieldPieceIds: true,
        trainingFieldSelections: true,
      },
    }),
    prisma.clubTrainingScheduleGroup.findMany({
      where: {
        clubId,
        trainingDates: { hasSome: relevantDates },
        trainingFieldId: { not: null },
      },
      select: {
        id: true,
        name: true,
        teamGroups: true,
        trainingDates: true,
        trainingDateTimes: true,
        trainingDurationMinutes: true,
        trainingFieldId: true,
        trainingFieldPieceIds: true,
        trainingFieldSelections: true,
      },
    }),
    prisma.clubCustomTrainingGroup.findMany({
      where: {
        clubId,
        trainingDates: { hasSome: relevantDates },
        trainingFieldId: { not: null },
      },
      select: {
        id: true,
        name: true,
        trainingDates: true,
        trainingDateTimes: true,
        trainingDurationMinutes: true,
        trainingFieldId: true,
        trainingFieldPieceIds: true,
        trainingFieldSelections: true,
      },
    }),
    prisma.coachGroup.findMany({
      where: {
        clubId,
        trainingDates: { hasSome: relevantDates },
        trainingFieldId: { not: null },
      },
      select: {
        id: true,
        name: true,
        trainingDates: true,
        trainingDateTimes: true,
        trainingDurationMinutes: true,
        trainingFieldId: true,
        trainingFieldPieceIds: true,
        trainingFieldSelections: true,
      },
    }),
  ]);

  const schedules: ExistingSchedule[] = [];

  if (club?.trainingFieldId && club.trainingDates.some((date) => relevantDates.includes(date))) {
    schedules.push({
      label: "клубен график",
      type: "club",
      trainingDates: club.trainingDates,
      trainingDateTimes: club.trainingDateTimes,
      trainingDurationMinutes: club.trainingDurationMinutes,
      trainingFieldId: club.trainingFieldId,
      trainingFieldPieceIds: club.trainingFieldPieceIds,
      trainingFieldSelections: club.trainingFieldSelections,
    });
  }

  for (const schedule of teamSchedules) {
    schedules.push({
      label: `набор ${schedule.teamGroup}`,
      type: "teamGroup",
      teamGroup: schedule.teamGroup,
      trainingDates: schedule.trainingDates,
      trainingDateTimes: schedule.trainingDateTimes,
      trainingDurationMinutes: schedule.trainingDurationMinutes,
      trainingFieldId: schedule.trainingFieldId,
      trainingFieldPieceIds: schedule.trainingFieldPieceIds,
      trainingFieldSelections: schedule.trainingFieldSelections,
    });
  }

  for (const group of trainingGroups) {
    schedules.push({
      label: `сборен отбор ${group.name}`,
      type: "trainingGroup",
      id: group.id,
      teamGroups: group.teamGroups,
      trainingDates: group.trainingDates,
      trainingDateTimes: group.trainingDateTimes,
      trainingDurationMinutes: group.trainingDurationMinutes,
      trainingFieldId: group.trainingFieldId,
      trainingFieldPieceIds: group.trainingFieldPieceIds,
      trainingFieldSelections: group.trainingFieldSelections,
    });
  }

  for (const group of customGroups) {
    schedules.push({
      label: `персонализирана група ${group.name}`,
      type: "customGroup",
      id: group.id,
      trainingDates: group.trainingDates,
      trainingDateTimes: group.trainingDateTimes,
      trainingDurationMinutes: group.trainingDurationMinutes,
      trainingFieldId: group.trainingFieldId,
      trainingFieldPieceIds: group.trainingFieldPieceIds,
      trainingFieldSelections: group.trainingFieldSelections,
    });
  }

  for (const group of coachGroups) {
    schedules.push({
      label: `треньорска група ${group.name}`,
      type: "coachGroup",
      id: group.id,
      trainingDates: group.trainingDates,
      trainingDateTimes: group.trainingDateTimes,
      trainingDurationMinutes: group.trainingDurationMinutes,
      trainingFieldId: group.trainingFieldId,
      trainingFieldPieceIds: group.trainingFieldPieceIds,
      trainingFieldSelections: group.trainingFieldSelections,
    });
  }

  return schedules;
}

async function loadAllSchedules(clubId: string, relevantDates: string[]): Promise<ExistingSchedule[]> {
  const [club, teamSchedules, trainingGroups, customGroups, coachGroups] = await Promise.all([
    prisma.club.findUnique({
      where: { id: clubId },
      select: {
        trainingDates: true,
        trainingDateTimes: true,
        trainingDurationMinutes: true,
        trainingFieldId: true,
        trainingFieldPieceIds: true,
        trainingFieldSelections: true,
      },
    }),
    prisma.clubTrainingGroupSchedule.findMany({
      where: { clubId, trainingDates: { hasSome: relevantDates } },
      select: {
        teamGroup: true,
        trainingDates: true,
        trainingDateTimes: true,
        trainingDurationMinutes: true,
        trainingFieldId: true,
        trainingFieldPieceIds: true,
        trainingFieldSelections: true,
      },
    }),
    prisma.clubTrainingScheduleGroup.findMany({
      where: { clubId, trainingDates: { hasSome: relevantDates } },
      select: {
        id: true,
        name: true,
        teamGroups: true,
        trainingDates: true,
        trainingDateTimes: true,
        trainingDurationMinutes: true,
        trainingFieldId: true,
        trainingFieldPieceIds: true,
        trainingFieldSelections: true,
      },
    }),
    prisma.clubCustomTrainingGroup.findMany({
      where: { clubId, trainingDates: { hasSome: relevantDates } },
      select: {
        id: true,
        name: true,
        trainingDates: true,
        trainingDateTimes: true,
        trainingDurationMinutes: true,
        trainingFieldId: true,
        trainingFieldPieceIds: true,
        trainingFieldSelections: true,
      },
    }),
    prisma.coachGroup.findMany({
      where: { clubId, trainingDates: { hasSome: relevantDates } },
      select: {
        id: true,
        name: true,
        trainingDates: true,
        trainingDateTimes: true,
        trainingDurationMinutes: true,
        trainingFieldId: true,
        trainingFieldPieceIds: true,
        trainingFieldSelections: true,
      },
    }),
  ]);

  const schedules: ExistingSchedule[] = [];

  if (club && club.trainingDates.some((date) => relevantDates.includes(date))) {
    schedules.push({
      label: "клубен график",
      type: "club",
      trainingDates: club.trainingDates,
      trainingDateTimes: club.trainingDateTimes,
      trainingDurationMinutes: club.trainingDurationMinutes,
      trainingFieldId: club.trainingFieldId,
      trainingFieldPieceIds: club.trainingFieldPieceIds,
      trainingFieldSelections: club.trainingFieldSelections,
    });
  }

  for (const schedule of teamSchedules) {
    schedules.push({
      label: `набор ${schedule.teamGroup}`,
      type: "teamGroup",
      teamGroup: schedule.teamGroup,
      trainingDates: schedule.trainingDates,
      trainingDateTimes: schedule.trainingDateTimes,
      trainingDurationMinutes: schedule.trainingDurationMinutes,
      trainingFieldId: schedule.trainingFieldId,
      trainingFieldPieceIds: schedule.trainingFieldPieceIds,
      trainingFieldSelections: schedule.trainingFieldSelections,
    });
  }

  for (const group of trainingGroups) {
    schedules.push({
      label: `сборен отбор ${group.name}`,
      type: "trainingGroup",
      id: group.id,
      teamGroups: group.teamGroups,
      trainingDates: group.trainingDates,
      trainingDateTimes: group.trainingDateTimes,
      trainingDurationMinutes: group.trainingDurationMinutes,
      trainingFieldId: group.trainingFieldId,
      trainingFieldPieceIds: group.trainingFieldPieceIds,
      trainingFieldSelections: group.trainingFieldSelections,
    });
  }

  for (const group of customGroups) {
    schedules.push({
      label: `персонализирана група ${group.name}`,
      type: "customGroup",
      id: group.id,
      trainingDates: group.trainingDates,
      trainingDateTimes: group.trainingDateTimes,
      trainingDurationMinutes: group.trainingDurationMinutes,
      trainingFieldId: group.trainingFieldId,
      trainingFieldPieceIds: group.trainingFieldPieceIds,
      trainingFieldSelections: group.trainingFieldSelections,
    });
  }

  for (const group of coachGroups) {
    schedules.push({
      label: `треньорска група ${group.name}`,
      type: "coachGroup",
      id: group.id,
      trainingDates: group.trainingDates,
      trainingDateTimes: group.trainingDateTimes,
      trainingDurationMinutes: group.trainingDurationMinutes,
      trainingFieldId: group.trainingFieldId,
      trainingFieldPieceIds: group.trainingFieldPieceIds,
      trainingFieldSelections: group.trainingFieldSelections,
    });
  }

  return schedules;
}

export async function assertNoTrainingFieldConflict(input: TrainingFieldConflictInput): Promise<void> {
  const hasAnySelectedField = input.trainingFieldId || Object.values(input.trainingFieldSelections ?? {}).some(
    (selection) => selection.trainingFieldId,
  );
  if (!hasAnySelectedField || input.trainingDates.length === 0) {
    return;
  }

  const relevantDates = Array.from(new Set(input.trainingDates));
  const schedules = await loadSchedules(input.clubId, relevantDates);
  const excludedTeamGroups = new Set(input.excludeTeamGroups ?? []);

  for (const schedule of schedules) {
    if (
      isSameExcludedSchedule(schedule, input.exclude) ||
      isExcludedTeamGroupSchedule(schedule, excludedTeamGroups)
    ) {
      continue;
    }

    const scheduleDateTimes = normalizeStoredDateTimes(schedule.trainingDateTimes);
    for (const date of relevantDates) {
      if (!schedule.trainingDates.includes(date)) {
        continue;
      }
      const inputSelection = input.trainingFieldSelections?.[date] ?? input;
      const scheduleSelection = getFieldSelectionForDate(schedule, date);
      if (!isSameFieldResource(scheduleSelection, inputSelection)) {
        continue;
      }
      const nextStart = parseTimeToMinutes(input.trainingDateTimes[date] ?? "");
      const existingTime = scheduleDateTimes[date] ?? "";
      const existingStart = parseTimeToMinutes(existingTime);
      if (nextStart === null || existingStart === null) {
        continue;
      }
      if (overlaps(nextStart, input.trainingDurationMinutes, existingStart, schedule.trainingDurationMinutes)) {
        throw new Error(formatConflictMessage({
          date,
          startMinutes: existingStart,
          durationMinutes: schedule.trainingDurationMinutes,
          label: schedule.label,
        }));
      }
    }
  }
}

export async function assertNoTrainingTimeConflict(input: {
  clubId: string;
  trainingDates: string[];
  trainingDateTimes: Record<string, string>;
  trainingDurationMinutes: number;
  exclude?: TrainingFieldConflictInput["exclude"];
  excludeTeamGroups?: number[];
  ignoreFieldResourceSchedules?: boolean;
}): Promise<void> {
  if (input.trainingDates.length === 0) return;

  const relevantDates = Array.from(new Set(input.trainingDates));
  const schedules = await loadAllSchedules(input.clubId, relevantDates);
  const excludedTeamGroups = new Set(input.excludeTeamGroups ?? []);

  for (const schedule of schedules) {
    if (
      isSameExcludedSchedule(schedule, input.exclude) ||
      isExcludedTeamGroupSchedule(schedule, excludedTeamGroups)
    ) {
      continue;
    }

    const scheduleDateTimes = normalizeStoredDateTimes(schedule.trainingDateTimes);
    for (const date of relevantDates) {
      if (!schedule.trainingDates.includes(date)) continue;
      if (input.ignoreFieldResourceSchedules && getFieldSelectionForDate(schedule, date).trainingFieldId) {
        continue;
      }
      const nextStart = parseTimeToMinutes(input.trainingDateTimes[date] ?? "");
      const existingStart = parseTimeToMinutes(scheduleDateTimes[date] ?? "");
      if (nextStart === null || existingStart === null) continue;
      if (overlaps(nextStart, input.trainingDurationMinutes, existingStart, schedule.trainingDurationMinutes)) {
        throw new Error(formatTimeConflictMessage({
          date,
          startMinutes: existingStart,
          durationMinutes: schedule.trainingDurationMinutes,
          label: schedule.label,
        }));
      }
    }
  }
}

export async function getOccupiedFieldResources(input: OccupiedResourcesInput): Promise<OccupiedFieldResource[]> {
  if (input.trainingDates.length === 0) {
    return [];
  }

  const relevantDates = Array.from(new Set(input.trainingDates));
  const schedules = await loadSchedules(input.clubId, relevantDates);
  const excludedTeamGroups = new Set(input.excludeTeamGroups ?? []);

  const seen = new Set<string>();
  const resources: OccupiedFieldResource[] = [];

  for (const schedule of schedules) {
    if (
      isSameExcludedSchedule(schedule, input.exclude) ||
      isExcludedTeamGroupSchedule(schedule, excludedTeamGroups)
    ) {
      continue;
    }

    const scheduleDateTimes = normalizeStoredDateTimes(schedule.trainingDateTimes);

    for (const date of relevantDates) {
      if (!schedule.trainingDates.includes(date)) {
        continue;
      }
      const scheduleSelection = getFieldSelectionForDate(schedule, date);
      if (!scheduleSelection.trainingFieldId) {
        continue;
      }
      const nextStart = parseTimeToMinutes(input.trainingDateTimes[date] ?? "");
      const existingStart = parseTimeToMinutes(scheduleDateTimes[date] ?? "");
      if (nextStart === null || existingStart === null) {
        continue;
      }
      if (overlaps(nextStart, input.trainingDurationMinutes, existingStart, schedule.trainingDurationMinutes)) {
        const key = `${date}:${scheduleSelection.trainingFieldId}:${[...scheduleSelection.trainingFieldPieceIds].sort().join(",")}:${schedule.label}`;
        if (!seen.has(key)) {
          seen.add(key);
          resources.push({
            date,
            fieldId: scheduleSelection.trainingFieldId,
            pieceIds: scheduleSelection.trainingFieldPieceIds,
            label: schedule.label,
          });
        }
      }
    }
  }

  return resources;
}

export interface MatchConflictResult {
  blocking: string | null;
  warning: string | null;
}

export async function checkAwayMatchTrainingConflict(input: {
  clubId: string;
  matchDate: string;
  matchTime: string;
  durationMinutes: number;
  teamGroups: number[];
  isHome?: boolean;
  excludeMatchId?: string;
}): Promise<MatchConflictResult> {
  const matchStart = parseTimeToMinutes(input.matchTime);
  if (matchStart === null) return { blocking: null, warning: null };

  const { clubId, matchDate, durationMinutes, teamGroups } = input;
  const isHome = input.isHome === true;

  const [teamSchedules, trainingGroups, customGroups, coachGroups, clubSchedule, existingMatches] = await Promise.all([
    prisma.clubTrainingGroupSchedule.findMany({
      where: { clubId, trainingDates: { has: matchDate } },
      select: { teamGroup: true, trainingTime: true, trainingDateTimes: true, trainingDurationMinutes: true },
    }),
    prisma.clubTrainingScheduleGroup.findMany({
      where: { clubId, trainingDates: { has: matchDate } },
      select: { name: true, teamGroups: true, trainingTime: true, trainingDateTimes: true, trainingDurationMinutes: true },
    }),
    prisma.clubCustomTrainingGroup.findMany({
      where: { clubId, trainingDates: { has: matchDate } },
      select: { name: true, trainingTime: true, trainingDateTimes: true, trainingDurationMinutes: true },
    }),
    prisma.coachGroup.findMany({
      where: { clubId, trainingDates: { has: matchDate } },
      select: { name: true, trainingTime: true, trainingDateTimes: true, trainingDurationMinutes: true },
    }),
    prisma.club.findFirst({
      where: { id: clubId, trainingDates: { has: matchDate } },
      select: { trainingTime: true, trainingDateTimes: true, trainingDurationMinutes: true },
    }),
    prisma.clubMatch.findMany({
      where: {
        clubId,
        matchDate,
        ...(input.excludeMatchId ? { id: { not: input.excludeMatchId } } : {}),
      },
      select: { matchTime: true, durationMinutes: true, opponent: true, isHome: true, teamGroups: true },
    }),
  ]);

  type Entry = { label: string; trainingTime: string | null; trainingDateTimes: unknown; trainingDurationMinutes: number };
  const schedules: Entry[] = [];

  for (const s of teamSchedules) {
    if (!isHome && teamGroups.length > 0 && !teamGroups.includes(s.teamGroup)) continue;
    schedules.push({ label: `набор ${s.teamGroup}`, trainingTime: s.trainingTime, trainingDateTimes: s.trainingDateTimes, trainingDurationMinutes: s.trainingDurationMinutes });
  }

  for (const g of trainingGroups) {
    if (!isHome && teamGroups.length > 0 && g.teamGroups.length > 0 && !g.teamGroups.some((tg) => teamGroups.includes(tg))) continue;
    schedules.push({ label: `сборен отбор ${g.name}`, trainingTime: g.trainingTime, trainingDateTimes: g.trainingDateTimes, trainingDurationMinutes: g.trainingDurationMinutes });
  }

  if (isHome) {
    for (const g of customGroups) {
      schedules.push({ label: `РїРµСЂСЃРѕРЅР°Р»РёР·РёСЂР°РЅР° РіСЂСѓРїР° ${g.name}`, trainingTime: g.trainingTime, trainingDateTimes: g.trainingDateTimes, trainingDurationMinutes: g.trainingDurationMinutes });
    }
    for (const g of coachGroups) {
      schedules.push({ label: `С‚СЂРµРЅСЊРѕСЂСЃРєР° РіСЂСѓРїР° ${g.name}`, trainingTime: g.trainingTime, trainingDateTimes: g.trainingDateTimes, trainingDurationMinutes: g.trainingDurationMinutes });
    }
  }

  if (clubSchedule) {
    schedules.push({ label: "клубна тренировка", trainingTime: clubSchedule.trainingTime, trainingDateTimes: clubSchedule.trainingDateTimes, trainingDurationMinutes: clubSchedule.trainingDurationMinutes });
  }

  let warnLabel: string | null = null;

  for (const sched of schedules) {
    const dateTimes = normalizeStoredDateTimes(sched.trainingDateTimes);
    const trainingTimeStr = dateTimes[matchDate] ?? sched.trainingTime ?? null;
    if (!trainingTimeStr) { warnLabel ??= sched.label; continue; }
    const trainingStart = parseTimeToMinutes(trainingTimeStr);
    if (trainingStart === null) { warnLabel ??= sched.label; continue; }
    if (overlaps(matchStart, durationMinutes, trainingStart, sched.trainingDurationMinutes)) {
      const startTime = formatMinutesAsTime(trainingStart);
      const endTime = formatMinutesAsTime(trainingStart + sched.trainingDurationMinutes);
      return {
        blocking: `Мачът се застъпва с тренировка на ${formatIsoDateForBgDisplay(matchDate)} от ${startTime} до ${endTime} за ${sched.label}.`,
        warning: null,
      };
    }
    warnLabel ??= sched.label;
  }

  for (const match of existingMatches) {
    const existingStart = parseTimeToMinutes(match.matchTime);
    if (existingStart === null) continue;
    if (overlaps(matchStart, durationMinutes, existingStart, match.durationMinutes)) {
      const startTime = formatMinutesAsTime(existingStart);
      const endTime = formatMinutesAsTime(existingStart + match.durationMinutes);
      if (matchTeamGroupsOverlap(teamGroups, match.teamGroups)) {
        return {
          blocking: `Match overlaps with another match for the same team on ${formatIsoDateForBgDisplay(matchDate)} from ${startTime} to ${endTime} against ${match.opponent}.`,
          warning: null,
        };
      }
      if (isHome && match.isHome) {
        return {
          blocking: `Match overlaps with a home match on ${formatIsoDateForBgDisplay(matchDate)} from ${startTime} to ${endTime} against ${match.opponent}.`,
          warning: null,
        };
      }
    }
  }

  if (warnLabel !== null) {
    return { blocking: null, warning: `На ${formatIsoDateForBgDisplay(matchDate)} вече е насрочена тренировка за ${warnLabel}.` };
  }
  return { blocking: null, warning: null };
}

export async function checkTrainingAwayMatchConflict(input: {
  clubId: string;
  trainingDates: string[];
  trainingDateTimes: Record<string, string>;
  durationMinutes: number;
  teamGroups: number[];
  homeMatchesOnly?: boolean;
}): Promise<MatchConflictResult> {
  if (input.trainingDates.length === 0) return { blocking: null, warning: null };

  const { clubId, trainingDates, trainingDateTimes, durationMinutes, teamGroups } = input;

  const matches = await prisma.clubMatch.findMany({
    where: { clubId, matchDate: { in: trainingDates } },
    select: { matchDate: true, matchTime: true, durationMinutes: true, teamGroups: true, opponent: true, isHome: true },
  });

  const relevant = matches.filter((m) =>
    m.isHome || (!input.homeMatchesOnly && matchTeamGroupsOverlap(teamGroups, m.teamGroups)),
  );

  let warnMatch: { date: string; opponent: string } | null = null;

  for (const match of relevant) {
    const trainingTime = trainingDateTimes[match.matchDate];
    if (!trainingTime) { warnMatch ??= { date: match.matchDate, opponent: match.opponent }; continue; }
    const trainingStart = parseTimeToMinutes(trainingTime);
    const matchStart = parseTimeToMinutes(match.matchTime);
    if (trainingStart === null || matchStart === null) { warnMatch ??= { date: match.matchDate, opponent: match.opponent }; continue; }
    if (overlaps(trainingStart, durationMinutes, matchStart, match.durationMinutes)) {
      const startTime = formatMinutesAsTime(matchStart);
      const endTime = formatMinutesAsTime(matchStart + match.durationMinutes);
      return {
        blocking: `Тренировката се застъпва с мач на ${formatIsoDateForBgDisplay(match.matchDate)} от ${startTime} до ${endTime} срещу ${match.opponent}.`,
        warning: null,
      };
    }
    warnMatch ??= { date: match.matchDate, opponent: match.opponent };
  }

  if (warnMatch !== null) {
    return { blocking: null, warning: `На ${formatIsoDateForBgDisplay(warnMatch.date)} вече е насрочен мач срещу ${warnMatch.opponent}.` };
  }
  return { blocking: null, warning: null };
}
