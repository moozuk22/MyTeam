import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { PUT } from "./route";

const mocks = vi.hoisted(() => ({ find: vi.fn(), update: vi.fn(), groupUpdate: vi.fn(), transaction: vi.fn(), members: vi.fn(), fields: vi.fn(), history: vi.fn(), push: vi.fn(), publish: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: {
  trainingSession: { findFirst: mocks.find, update: mocks.update },
  coachGroup: { update: mocks.groupUpdate },
  player: { findMany: mocks.members }, field: { findMany: mocks.fields }, $transaction: mocks.transaction,
} }));
vi.mock("@/lib/adminAuth", () => ({ verifyAdminToken: vi.fn().mockResolvedValue({ roles: ["admin"] }) }));
vi.mock("@/lib/push/history", () => ({ saveMemberNotificationHistory: mocks.history }));
vi.mock("@/lib/push/service", () => ({ sendPushToMember: mocks.push }));
vi.mock("@/lib/trainingAttendanceEvents", () => ({ publishTrainingAttendanceUpdated: mocks.publish }));

const row = { id: "session", scopeId: "group", trainingDate: new Date("2026-11-12T00:00:00Z"), trainingTime: "19:00", trainingDurationMinutes: 60, trainingFieldId: null, trainingFieldPieceIds: [], recurrenceId: null, status: "scheduled", note: "Old description" };
const save = (note: string) => PUT(new NextRequest("http://localhost/training-attendance", { method: "PUT", headers: { cookie: "admin_session=token", "Content-Type": "application/json" }, body: JSON.stringify({ trainingSessionId: row.id, note }) }), { params: Promise.resolve({ id: "club" }) });

describe("session description editor notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.find.mockResolvedValue({ ...row });
    mocks.update.mockResolvedValue({});
    mocks.groupUpdate.mockResolvedValue({});
    mocks.transaction.mockImplementation(async (callback) => callback({ trainingSession: { update: mocks.update }, coachGroup: { update: mocks.groupUpdate } }));
    mocks.members.mockResolvedValue([{ id: "player", cards: [{ cardCode: "CARD" }] }]);
    mocks.fields.mockResolvedValue([]);
    mocks.history.mockResolvedValue({});
    mocks.push.mockResolvedValue({});
  });

  it("sends the edited description through history and push after saving", async () => {
    expect((await save("  Bring water  ")).status).toBe(200);
    expect(mocks.update).toHaveBeenCalledWith({ where: { id: row.id }, data: { note: "Bring water" } });
    expect(mocks.push).toHaveBeenCalledOnce();
    const payload = mocks.push.mock.calls[0][1];
    expect(payload.body).toContain("Bring water");
    expect(payload.body).not.toContain(row.note);
    expect(payload.data.trainingSessionId).toBe(row.id);
    expect(mocks.history).toHaveBeenCalledWith("player", "training_reminder", payload);
    expect(mocks.update.mock.invocationCallOrder[0]).toBeLessThan(mocks.history.mock.invocationCallOrder[0]);
    expect(mocks.publish).toHaveBeenCalledWith("club", "2026-11-12");
  });

  it("does not notify for an unchanged description", async () => {
    expect((await save(row.note)).status).toBe(200);
    expect(mocks.push).not.toHaveBeenCalled();
    expect(mocks.history).not.toHaveBeenCalled();
  });

  it("notifies when the description is cleared without including the old text", async () => {
    expect((await save("")).status).toBe(200);
    expect(mocks.update).toHaveBeenCalledWith({ where: { id: row.id }, data: { note: null } });
    expect(mocks.push).toHaveBeenCalledOnce();
    expect(mocks.push.mock.calls[0][1].body).not.toContain(row.note);
  });

  it("does not save or notify for a session outside the requested club", async () => {
    mocks.find.mockResolvedValue(null);
    expect((await save("New description")).status).toBe(404);
    expect(mocks.find.mock.calls[0][0].where).toEqual({ id: row.id, clubId: "club", scopeType: "coachGroup" });
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.push).not.toHaveBeenCalled();
  });
});
