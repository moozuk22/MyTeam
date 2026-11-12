import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { DELETE, GET, POST } from "@/app/api/members/[cardCode]/training/route";
import { DELETE as cancelRegistration } from "@/app/api/members/[cardCode]/training/register/route";

const db = vi.hoisted(() => ({
  $transaction: vi.fn(), $queryRaw: vi.fn(),
  card: { findFirst: vi.fn() }, player: { findFirst: vi.fn(), findMany: vi.fn(), findUnique: vi.fn() },
  club: { findUniqueOrThrow: vi.fn() },
  clubCustomTrainingGroup: { findUnique: vi.fn() },
  trainingSession: { findFirst: vi.fn(), findMany: vi.fn() },
  trainingSessionPlayer: { upsert: vi.fn(), createMany: vi.fn(), updateMany: vi.fn() },
  limitedTrainingEvent: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn() },
  limitedTrainingRegistration: { findMany: vi.fn(), deleteMany: vi.fn() },
  trainingOptOut: { findMany: vi.fn(), upsert: vi.fn() },
  trainingNote: { findMany: vi.fn() },
}));
const push = vi.hoisted(() => ({ send: vi.fn(), save: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: db }));
vi.mock("@/lib/push/adminService", () => ({ sendPushToClubAdmins: push.send }));
vi.mock("@/lib/push/adminHistory", () => ({ saveAdminNotificationHistory: push.save }));
vi.mock("@/lib/push/service", () => ({ sendPushToMember: vi.fn() }));
vi.mock("@/lib/trainingAttendanceEvents", () => ({ publishTrainingAttendanceUpdated: vi.fn() }));

const groupId = "10000000-0000-4000-8000-000000000001";
const sessionId = "10000000-0000-4000-8000-000000000002";
const scopeKey = `custom_group:${groupId}:session:${sessionId}`;
const date = "2026-10-19";
const dateUtc = new Date(`${date}T00:00:00Z`);
const params = { params: Promise.resolve({ cardCode: "CARD" }) };
const base = "http://localhost/api/members/CARD/training";
const schedule = { trainingDates: [], trainingWeekdays: [], trainingTime: "18:00", trainingWindowDays: 1,
  trainingDurationMinutes: 60, trainingFieldId: null, trainingFieldPieceIds: [] };
const group = { ...schedule, id: groupId, name: "Custom group", coachGroupId: "owner" };
const player = {
  id: "player", clubId: "club", fullName: "Player", teamGroup: null,
  club: { ...schedule, trainingGroupMode: "custom_group", paymentWorkflow: "calendar_month", sports: [] },
  customTrainingGroups: [{ group }],
  coachGroups: [{ ...schedule, id: "other", trainingDates: [date] }],
};
const session = { id: sessionId, scopeType: "customGroup", occurrenceKey: sessionId, scopeId: groupId, scopeKey,
  trainingDate: dateUtc, trainingTime: "18:00", trainingDurationMinutes: 60, trainingFieldId: null,
  trainingFieldPieceIds: [], rosterLockedAt: null, players: [] };

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-12T12:00:00Z"));
  db.$transaction.mockImplementation((callback) => callback(db));
  db.card.findFirst.mockResolvedValue({ playerId: "player", cardCode: "CARD", player });
  db.club.findUniqueOrThrow.mockResolvedValue(player.club);
  db.player.findFirst.mockResolvedValue({ attendanceMemberships: [{ scopeKey: `custom_group:${groupId}`, joinedAt: null, leftAt: null }] });
  db.trainingSession.findFirst.mockResolvedValue(session);
  db.clubCustomTrainingGroup.findUnique.mockResolvedValue(group);
  db.limitedTrainingEvent.findFirst.mockResolvedValue({ id: "event", scopeKey, maxSpots: 1 });
  db.limitedTrainingRegistration.findMany.mockResolvedValue([]);
});
afterEach(() => vi.useRealTimers());

it.each([["POST", POST], ["DELETE", DELETE]] as const)("routes %s attendance notifications to the custom group's coach", async (method, handler) => {
  const response = await handler(new NextRequest(base, { method, body: JSON.stringify({ trainingSessionId: sessionId, reasonCode: "sick" }) }), params);
  expect(response.status).toBe(200);
  expect(push.send).toHaveBeenCalledWith("club", expect.anything(), "owner");
  expect(push.save).toHaveBeenCalledWith(expect.objectContaining({ coachGroupId: "owner" }));
});

it("blocks ordinary attendance from bypassing a Schedule 2 reservation", async () => {
  db.limitedTrainingEvent.findUnique.mockResolvedValue({ id: "event" });
  const response = await DELETE(new NextRequest(base, { method: "DELETE", body: JSON.stringify({ trainingSessionId: sessionId }) }), params);
  expect(response.status).toBe(403);
  expect(db.trainingSessionPlayer.upsert).not.toHaveBeenCalled();
});

it("does not create a recurring session on a one-off date beyond the group's window", async () => {
  db.card.findFirst.mockResolvedValue({
    playerId: "player", cardCode: "CARD",
    player: { ...player, coachGroups: [], customTrainingGroups: [{ group: { ...group, trainingWeekdays: [1] } }] },
  });
  db.trainingSession.findMany.mockResolvedValueOnce([session]).mockResolvedValue([]);
  db.trainingOptOut.findMany.mockResolvedValue([]);
  db.trainingNote.findMany.mockResolvedValue([]);
  db.limitedTrainingEvent.findMany.mockResolvedValue([]);
  const response = await GET(new NextRequest(base), params);
  expect(response.status).toBe(200);
  const { dates } = await response.json();
  expect(dates.find((item: { date: string }) => item.date === date).sessions).toEqual([expect.objectContaining({ id: sessionId })]);
});

it.each([true, false])("keeps the roster unchanged when cancelling a missing reservation (group member %s)", async (belongsToGroup) => {
  if (!belongsToGroup) db.card.findFirst.mockResolvedValue({ playerId: "player", player: { ...player, customTrainingGroups: [] } });
  const response = await cancelRegistration(new NextRequest(`${base}/register`, {
    method: "DELETE", body: JSON.stringify({ trainingDate: date, limitedEventId: "event" }),
  }), params);
  expect(response.status).toBe(belongsToGroup ? 200 : 403);
  expect(db.limitedTrainingRegistration.deleteMany).not.toHaveBeenCalled();
  expect(db.trainingSessionPlayer.createMany).not.toHaveBeenCalled();
  expect(db.trainingOptOut.upsert).not.toHaveBeenCalled();
  expect(push.save).not.toHaveBeenCalled();
});

it("cancels a confirmed reservation and promotes the first waitlisted member in the same transaction", async () => {
  const membership = { scopeKey: `custom_group:${groupId}`, joinedAt: null, leftAt: null };
  db.limitedTrainingRegistration.findMany.mockResolvedValue([{ playerId: "player" }, { playerId: "next" }]);
  db.player.findMany.mockImplementation(async ({ where }) =>
    where.id.in.map((id: string) => ({ id, fullName: id, teamGroup: null, attendanceMemberships: [membership] })),
  );
  const response = await cancelRegistration(new NextRequest(`${base}/register`, {
    method: "DELETE", body: JSON.stringify({ trainingDate: date, limitedEventId: "event" }),
  }), params);
  expect(response.status).toBe(200);
  expect(db.$transaction).toHaveBeenCalledOnce();
  expect(db.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(db.limitedTrainingRegistration.deleteMany.mock.invocationCallOrder[0]);
  expect(db.trainingSessionPlayer.updateMany).toHaveBeenNthCalledWith(1, {
    where: { trainingSessionId: sessionId, playerId: { in: ["player"] }, trainingSession: { clubId: "club" } },
    data: { present: false, reasonCode: "limited_event", reasonText: null },
  });
  expect(db.trainingSessionPlayer.updateMany).toHaveBeenNthCalledWith(2, {
    where: { trainingSessionId: sessionId, playerId: { in: ["next"] }, trainingSession: { clubId: "club" } },
    data: { present: true, reasonCode: null, reasonText: null },
  });
});
