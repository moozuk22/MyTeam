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
