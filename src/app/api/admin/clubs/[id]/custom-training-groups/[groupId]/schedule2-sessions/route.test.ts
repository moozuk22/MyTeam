import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE, PATCH, POST } from "./route";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(), group: vi.fn(), updateGroup: vi.fn(), transaction: vi.fn(), find: vi.fn(),
  create: vi.fn(), update: vi.fn(), remove: vi.fn(), deleteLimit: vi.fn(), createLimit: vi.fn(),
  deleteNote: vi.fn(), roster: vi.fn(), publish: vi.fn(),
}));
vi.mock("@/lib/adminAuth", () => ({ verifyAdminToken: mocks.auth }));
vi.mock("@/lib/db", () => ({ prisma: { $transaction: mocks.transaction } }));
vi.mock("@/lib/trainingFieldConflicts", () => ({
  assertNoTrainingTimeConflict: vi.fn(), assertNoTrainingFieldConflict: vi.fn(),
}));
vi.mock("@/lib/trainingSessions", () => ({
  getExpectedPlayersForScope: mocks.roster, removeTrainingSessionsPreservingHistory: mocks.remove,
}));
vi.mock("@/lib/trainingAttendanceEvents", () => ({ publishTrainingAttendanceUpdated: mocks.publish }));
vi.mock("@/lib/push/coachTrainingNotifications", () => ({ notifySchedule2CustomTrainingChanges: async () => undefined }));

const clubId = "b5d54111-4d5a-4d88-9ffa-8724a0328d47";
const groupId = "130b47c1-e129-4228-b725-6516d62d9497";
const date = "2026-11-11";
const session = { date, time: "17:00", duration: 60 };
const baseScope = `custom_group:${groupId}`;
const params = Promise.resolve({ id: clubId, groupId });

function request(method: string, body: unknown) {
  return new NextRequest("http://localhost/schedule2-sessions", {
    method, headers: { cookie: "admin_session=test" }, body: JSON.stringify(body),
  });
}

describe("Schedule 2 custom-group occurrences", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-10T10:00:00Z"));
    mocks.auth.mockResolvedValue({ roles: ["admin"] });
    mocks.group.mockResolvedValue({
      trainingDates: [], trainingWeekdays: [3, 5], trainingWindowDays: 60,
      trainingDateTimes: { "2026-11-13": "16:00" }, trainingFieldSelections: {}, club: { paymentWorkflow: "membership" },
    });
    mocks.roster.mockResolvedValue([{ id: "player", fullName: "Player", teamGroup: 2015 }]);
    mocks.transaction.mockImplementation(async (work) => work({
      $queryRaw: vi.fn(),
      clubCustomTrainingGroup: { findFirst: mocks.group, update: mocks.updateGroup },
      field: { count: vi.fn().mockResolvedValue(0) },
      trainingSession: { findFirst: mocks.find, create: mocks.create, update: mocks.update },
      limitedTrainingEvent: { create: mocks.createLimit, deleteMany: mocks.deleteLimit },
      trainingNote: { deleteMany: mocks.deleteNote },
      trainingOptOut: { findMany: vi.fn().mockResolvedValue([]) },
    }));
  });
  afterEach(() => vi.useRealTimers());

  it("creates separate sessions for the same custom roster and date", async () => {
    expect((await POST(request("POST", { sessions: [session] }), { params })).status).toBe(200);
    expect((await POST(request("POST", { sessions: [{ ...session, time: "18:30", maxSpots: 4 }] }), { params })).status).toBe(200);
    const [first, second] = mocks.create.mock.calls.map(([{ data }]) => data);
    expect(first.id).not.toBe(second.id);
    expect(first).toMatchObject({ scopeId: groupId, scopeKey: `${baseScope}:session:${first.id}`, trainingTime: "17:00" });
    expect(second).toMatchObject({
      scopeId: groupId, scopeKey: `${baseScope}:session:${second.id}`, trainingTime: "18:30",
      players: { createMany: { data: [{ playerId: "player", present: false }] } },
    });
    expect(mocks.createLimit).toHaveBeenCalledWith({ data: expect.objectContaining({ scopeKey: second.scopeKey, maxSpots: 4 }) });
    expect(mocks.updateGroup).not.toHaveBeenCalled();
  });

  it("edits one weekday occurrence without replacing the recurring schedule", async () => {
    expect((await PATCH(request("PATCH", { sessionId: null, sessions: [session] }), { params })).status).toBe(200);
    expect(mocks.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      scopeKey: baseScope, occurrenceKey: "", trainingDate: new Date(date), trainingTime: session.time,
    }) });
    const [edit] = mocks.updateGroup.mock.calls[0];
    expect(edit.data).not.toHaveProperty("trainingDates");
    expect(edit.data).not.toHaveProperty("trainingWeekdays");
    expect(edit.data.trainingDateTimes).toEqual({ [date]: session.time, "2026-11-13": "16:00" });
  });

  it("rejects an omitted target and a removed occurrence without touching any data", async () => {
    expect((await DELETE(request("DELETE", { date }), { params })).status).toBe(400);
    const sessionId = "7b9416cd-4604-4a31-b131-3503a6f10ba6";
    expect((await DELETE(request("DELETE", { date, sessionId }), { params })).status).toBe(404);
    expect(mocks.find).toHaveBeenCalledWith({ where: expect.objectContaining({
      id: sessionId, clubId, scopeId: groupId, scopeKey: `${baseScope}:session:${sessionId}`,
    }) });
    expect(mocks.remove).not.toHaveBeenCalled();
    expect(mocks.deleteLimit).not.toHaveBeenCalled();
  });

  it("deletes only the specified occurrence and its registrations", async () => {
    const sessionId = "7b9416cd-4604-4a31-b131-3503a6f10ba6";
    const scopeKey = `${baseScope}:session:${sessionId}`;
    mocks.find.mockResolvedValue({ id: sessionId, status: "scheduled" });
    expect((await DELETE(request("DELETE", { date, sessionId }), { params })).status).toBe(200);
    expect(mocks.remove).toHaveBeenCalledWith(expect.anything(), { id: sessionId, clubId, scopeKey });
    expect(mocks.deleteLimit).toHaveBeenCalledWith({ where: { clubId, scopeKey, trainingDate: new Date(date) } });
    expect(mocks.updateGroup).not.toHaveBeenCalled();
  });
});
