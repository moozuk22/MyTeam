import { prisma } from "@/lib/db";
import { isEligibleForMembership } from "@/lib/attendanceEligibility";
import { trainingRequiresCheckIn } from "@/lib/trainingAttendanceDefaults";

export type LimitedSessionWriter = Pick<typeof prisma, "$queryRaw" | "trainingSession" | "trainingSessionPlayer" | "club" | "player">;

export function getLimitedTrainingSessionId(scopeKey: string): string | null {
  return /^(?:coach|custom)_group:[0-9a-f-]{36}:session:([0-9a-f-]{36})$/i.exec(scopeKey)?.[1] ?? null;
}

export async function resolveLimitedTrainingSessionId(clubId: string, scopeKey: string, trainingDate?: Date) {
  const id = getLimitedTrainingSessionId(scopeKey);
  if (id) return id;
  if (!/^coach_group:[0-9a-f-]{36}$/i.test(scopeKey) || !trainingDate) return null;
  const original = await prisma.trainingSession.findFirst({ where: { clubId, scopeKey, scopeType: "coachGroup", trainingDate }, orderBy: { createdAt: "asc" }, select: { id: true } });
  return original?.id ?? null;
}

export async function setLimitedSessionAttendance(clubId: string, scopeKey: string, playerIds: string[], present: boolean, trainingDate?: Date, tx?: LimitedSessionWriter): Promise<boolean> {
  const trainingSessionId = await resolveLimitedTrainingSessionId(clubId, scopeKey, trainingDate);
  if (!trainingSessionId) return false;
  if (!tx) return prisma.$transaction((client) => setLimitedSessionAttendance(clubId, scopeKey, playerIds, present, trainingDate, client));
  await tx.$queryRaw`SELECT id FROM training_sessions WHERE id = ${trainingSessionId}::uuid FOR UPDATE`;
  const customOccurrence = scopeKey.startsWith("custom_group:");
  const session = await tx.trainingSession.findFirst({
    where: {
      id: trainingSessionId, clubId,
      ...(customOccurrence ? { scopeKey, status: "scheduled", removedFromSchedule: false } : {}),
    },
    select: {
      scopeId: true, trainingDate: true, trainingTime: true, rosterLockedAt: true,
      players: { where: { playerId: { in: playerIds } }, select: { playerId: true } },
    },
  });
  if (!session) return true;
  const allowedPlayerIds = session.rosterLockedAt ? session.players.flatMap((row) => row.playerId ? [row.playerId] : []) : playerIds;
  if (allowedPlayerIds.length === 0) return true;
  const club = await tx.club.findUniqueOrThrow({ where: { id: clubId }, select: { paymentWorkflow: true } });
  const requiresCheckIn = trainingRequiresCheckIn(club.paymentWorkflow);
  const players = await tx.player.findMany({
    where: {
      clubId, id: { in: allowedPlayerIds }, isActive: true,
      ...(customOccurrence && !session.rosterLockedAt ? { customTrainingGroups: { some: { groupId: session.scopeId! } } } : {}),
    },
    select: { id: true, fullName: true, teamGroup: true, createdAt: true, attendanceStartedAt: true, attendanceMemberships: true },
  });
  const eligible = customOccurrence && !session.rosterLockedAt
    ? players.filter((player) => isEligibleForMembership(player, session.trainingDate.toISOString().slice(0, 10), session.trainingTime, scopeKey))
    : players;
  if (!session.rosterLockedAt && eligible.length) await tx.trainingSessionPlayer.createMany({ data: eligible.map((p) => ({ trainingSessionId, playerId: p.id, playerName: p.fullName, teamGroup: p.teamGroup, present: !requiresCheckIn })), skipDuplicates: true });
  // Reservation changes must not record or reverse credit-based attendance.
  if (requiresCheckIn) return true;
  const attendancePlayerIds = customOccurrence && !session.rosterLockedAt ? eligible.map(({ id }) => id) : allowedPlayerIds;
  if (attendancePlayerIds.length) await tx.trainingSessionPlayer.updateMany({ where: { trainingSessionId, playerId: { in: attendancePlayerIds }, trainingSession: { clubId } }, data: { present, reasonCode: present ? null : "limited_event", reasonText: null } });
  return true;
}
