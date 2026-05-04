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
    upsert(args: Prisma.TrainingSessionUpsertArgs): Promise<{ id: string }>;
  };
  trainingSessionPlayer: {
    deleteMany(args: Prisma.TrainingSessionPlayerDeleteManyArgs): Promise<Prisma.BatchPayload>;
    createMany(args: Prisma.TrainingSessionPlayerCreateManyArgs): Promise<Prisma.BatchPayload>;
    updateMany(args: Prisma.TrainingSessionPlayerUpdateManyArgs): Promise<Prisma.BatchPayload>;
  };
  trainingOptOut: {
    findMany(args: Prisma.TrainingOptOutFindManyArgs): Promise<Array<{ playerId: string; trainingDate: Date; reasonCode: string | null; reasonText: string | null }>>;
  };
  player: {
    findMany(args: Prisma.PlayerFindManyArgs): Promise<Array<{ id: string; fullName: string; teamGroup: number | null }>>;
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
    const session = await input.tx.trainingSession.upsert({
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
      select: { id: true },
    });
    const players = await getExpectedPlayersForScope(input.tx, input.clubId, input.scope);
    const optOuts = players.length > 0
      ? await input.tx.trainingOptOut.findMany({
          where: {
            playerId: { in: players.map((player) => player.id) },
            trainingDate: isoDateToUtcMidnight(date),
          },
          select: { playerId: true, trainingDate: true, reasonCode: true, reasonText: true },
        })
      : [];
    const optOutByPlayerId = new Map(optOuts.map((item) => [item.playerId, item]));
    await input.tx.trainingSessionPlayer.deleteMany({
      where: { trainingSessionId: session.id },
    });
    if (players.length > 0) {
      await input.tx.trainingSessionPlayer.createMany({
        data: players.map((player) => {
          const optOut = optOutByPlayerId.get(player.id);
          return {
            trainingSessionId: session.id,
            playerId: player.id,
            playerName: player.fullName,
            teamGroup: player.teamGroup,
            present: !optOut,
            reasonCode: optOut?.reasonCode ?? null,
            reasonText: optOut?.reasonText ?? null,
          };
        }),
      });
    }
  }
}

async function getExpectedPlayersForScope(
  tx: Pick<TrainingSessionWriter, "player">,
  clubId: string,
  scope: TrainingSessionScope,
) {
  return tx.player.findMany({
    where: {
      clubId,
      isActive: true,
      ...(scope.type === "teamGroup" ? { teamGroup: scope.teamGroup } : {}),
      ...(scope.type === "trainingGroup" ? { teamGroup: { in: scope.teamGroups ?? [] } } : {}),
      ...(scope.type === "customGroup" ? { customTrainingGroups: { some: { groupId: scope.id } } } : {}),
      ...(scope.type === "coachGroup" ? { coachGroupId: scope.id } : {}),
    },
    select: {
      id: true,
      fullName: true,
      teamGroup: true,
    },
    orderBy: { fullName: "asc" },
  });
}

export async function updateTrainingSessionPlayerAttendance(input: {
  tx: Pick<TrainingSessionWriter, "trainingSessionPlayer">;
  clubId: string;
  playerId: string;
  trainingDate: string;
  optedOut: boolean;
  reasonCode?: string | null;
  reasonText?: string | null;
}) {
  await input.tx.trainingSessionPlayer.updateMany({
    where: {
      playerId: input.playerId,
      trainingSession: {
        clubId: input.clubId,
        trainingDate: isoDateToUtcMidnight(input.trainingDate),
      },
    },
    data: {
      present: !input.optedOut,
      reasonCode: input.optedOut ? input.reasonCode ?? null : null,
      reasonText: input.optedOut ? input.reasonText ?? null : null,
    },
  });
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
