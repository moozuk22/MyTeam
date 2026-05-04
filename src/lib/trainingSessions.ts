import { Prisma } from "@prisma/client";
import { isoDateToUtcMidnight } from "@/lib/training";

type TrainingSessionScope =
  | { type: "club" }
  | { type: "teamGroup"; teamGroup: number }
  | { type: "trainingGroup"; id: string; teamGroups?: number[] }
  | { type: "customGroup"; id: string }
  | { type: "coachGroup"; id: string };

type TrainingFieldSelectionByDate = Record<string, { trainingFieldId: string | null; trainingFieldPieceIds: string[] }>;
type TrainingSessionWriter = {
  trainingSession: {
    deleteMany(args: Prisma.TrainingSessionDeleteManyArgs): Promise<Prisma.BatchPayload>;
    upsert(args: Prisma.TrainingSessionUpsertArgs): Promise<unknown>;
  };
};

export function getTrainingSessionScopeKey(scope: TrainingSessionScope) {
  if (scope.type === "club") return "club";
  if (scope.type === "teamGroup") return `team_group:${scope.teamGroup}`;
  if (scope.type === "trainingGroup") return `training_group:${scope.id}`;
  if (scope.type === "customGroup") return `custom_group:${scope.id}`;
  return `coach_group:${scope.id}`;
}

export function getTrainingSessionScopeData(scope: TrainingSessionScope) {
  return {
    scopeType: scope.type,
    scopeKey: getTrainingSessionScopeKey(scope),
    scopeId: scope.type === "trainingGroup" || scope.type === "customGroup" || scope.type === "coachGroup" ? scope.id : null,
    teamGroup: scope.type === "teamGroup" ? scope.teamGroup : null,
    teamGroups: scope.type === "trainingGroup" ? scope.teamGroups ?? [] : [],
  };
}

export async function syncFutureTrainingSessions(input: {
  tx: TrainingSessionWriter;
  clubId: string;
  scope: TrainingSessionScope;
  trainingDates: string[];
  trainingDateTimes: Record<string, string>;
  trainingDurationMinutes: number;
  trainingFieldId: string | null;
  trainingFieldPieceIds: string[];
  trainingFieldSelections?: TrainingFieldSelectionByDate;
  todayIso: string;
}) {
  const scopeData = getTrainingSessionScopeData(input.scope);
  const futureDates = Array.from(new Set(input.trainingDates.filter((date) => date >= input.todayIso))).sort((a, b) => a.localeCompare(b));

  await input.tx.trainingSession.deleteMany({
    where: {
      clubId: input.clubId,
      scopeKey: scopeData.scopeKey,
      trainingDate: {
        gte: isoDateToUtcMidnight(input.todayIso),
      },
      ...(futureDates.length > 0
        ? {
            NOT: {
              trainingDate: {
                in: futureDates.map((date) => isoDateToUtcMidnight(date)),
              },
            },
          }
        : {}),
    },
  });

  for (const date of futureDates) {
    const fieldSelection = input.trainingFieldSelections?.[date];
    await input.tx.trainingSession.upsert({
      where: {
        clubId_scopeKey_trainingDate: {
          clubId: input.clubId,
          scopeKey: scopeData.scopeKey,
          trainingDate: isoDateToUtcMidnight(date),
        },
      },
      update: {
        ...scopeData,
        trainingTime: input.trainingDateTimes[date] ?? null,
        trainingDurationMinutes: input.trainingDurationMinutes,
        trainingFieldId: fieldSelection?.trainingFieldId ?? input.trainingFieldId,
        trainingFieldPieceIds: fieldSelection?.trainingFieldPieceIds ?? input.trainingFieldPieceIds,
        status: "scheduled",
      },
      create: {
        clubId: input.clubId,
        ...scopeData,
        trainingDate: isoDateToUtcMidnight(date),
        trainingTime: input.trainingDateTimes[date] ?? null,
        trainingDurationMinutes: input.trainingDurationMinutes,
        trainingFieldId: fieldSelection?.trainingFieldId ?? input.trainingFieldId,
        trainingFieldPieceIds: fieldSelection?.trainingFieldPieceIds ?? input.trainingFieldPieceIds,
        status: "scheduled",
      },
    });
  }
}

export async function deleteFutureTrainingSessionsForScope(input: {
  tx: TrainingSessionWriter;
  clubId: string;
  scope: TrainingSessionScope;
  todayIso: string;
}) {
  await input.tx.trainingSession.deleteMany({
    where: {
      clubId: input.clubId,
      scopeKey: getTrainingSessionScopeKey(input.scope),
      trainingDate: {
        gte: isoDateToUtcMidnight(input.todayIso),
      },
    },
  });
}
