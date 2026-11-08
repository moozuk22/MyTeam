import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { PUT } from "@/app/api/admin/clubs/[id]/coach-groups/[groupId]/schedule/route";

const mocks = vi.hoisted(() => ({
  coachGroup: { findFirst: vi.fn(), findUnique: vi.fn(), findUniqueOrThrow: vi.fn() },
  field: { count: vi.fn(), findFirst: vi.fn() },
  trainingSession: { count: vi.fn(), findMany: vi.fn() },
  limitedTrainingEvent: { findMany: vi.fn(), updateMany: vi.fn() },
  $queryRaw: vi.fn(), $transaction: vi.fn(),
  read: vi.fn(), write: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ prisma: mocks }));
vi.mock("@/lib/adminAuth", () => ({ verifyAdminToken: vi.fn().mockResolvedValue({ roles: ["admin"] }) }));
vi.mock("@/lib/coachTrainingSchedule", async (original) => ({
  ...await original<typeof import("@/lib/coachTrainingSchedule")>(),
  readCoachTrainings: mocks.read, writeCoachTrainings: mocks.write,
}));
vi.mock("@/lib/trainingFieldConflicts", () => ({ assertNoTrainingFieldConflict: vi.fn() }));
vi.mock("@/lib/coachTrainingLimits", () => ({ parseCoachTrainingLimits: () => [], applyCoachTrainingLimits: vi.fn() }));
vi.mock("@/lib/push/coachTrainingNotifications", () => ({ notifyCoachTrainingChanges: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/trainingAttendanceEvents", () => ({ publishTrainingAttendanceUpdated: vi.fn() }));
const clubId = "10000000-0000-4000-8000-000000000001";
const groupId = "10000000-0000-4000-8000-000000000002";
const fieldId = "10000000-0000-4000-8000-000000000003";
const id = "10000000-0000-4000-8000-000000000004";
const legacy = { id, date: "2026-11-09", trainingTime: "18:00", trainingDurationMinutes: 60, trainingFieldId: null, trainingFieldPieceIds: [], recurrenceId: null, status: "scheduled", note: "" };
const version = new Date("2026-11-08T10:00:00Z");
async function save(trainings: unknown[]) {
  return PUT(new NextRequest("http://localhost/schedule", { method: "PUT", headers: { cookie: "admin_session=test" }, body: JSON.stringify({ trainings, version: version.toISOString() }) }), { params: Promise.resolve({ id: clubId, groupId }) });
}
beforeEach(() => {
  vi.clearAllMocks(); vi.useFakeTimers(); vi.setSystemTime(version);
  mocks.coachGroup.findFirst.mockResolvedValue({ id: groupId, clubId, updatedAt: version, trainingRecurrences: [] });
  mocks.coachGroup.findUnique.mockResolvedValue({ updatedAt: version });
  mocks.coachGroup.findUniqueOrThrow.mockResolvedValue({ updatedAt: version });
  mocks.field.count.mockResolvedValue(1);
  mocks.field.findFirst.mockResolvedValue({ id: fieldId, pieces: [] });
  mocks.read.mockResolvedValue([legacy]);
  mocks.trainingSession.count.mockResolvedValue(0);
  mocks.trainingSession.findMany.mockResolvedValue([]);
  mocks.limitedTrainingEvent.findMany.mockResolvedValue([]);
  mocks.$transaction.mockImplementation(async (callback) => callback(mocks));
});
afterEach(() => vi.useRealTimers());
it("saves a selected field while preserving another unchanged legacy session without a field", async () => {
  const response = await save([legacy, { ...legacy, id: fieldId, trainingTime: "20:00", trainingFieldId: fieldId }]);
  expect(await response.json()).not.toHaveProperty("error");
  expect(response.status).toBe(200);
  expect(mocks.write).toHaveBeenCalled();
});
it("allows cancelling a legacy session without choosing a field", async () => {
  expect((await save([{ ...legacy, status: "cancelled" }])).status).toBe(200);
});
it.each([
  { ...legacy, id: fieldId },
  { ...legacy, date: "2026-11-10" },
  { ...legacy, trainingTime: "19:00" },
  { ...legacy, trainingDurationMinutes: 90 },
])("still requires a field for a new or rescheduled session: %j", async (training) => {
  const response = await save([training]);
  expect(response.status).toBe(400);
  expect(await response.json()).toEqual({ error: "Изберете терен за всяка тренировка." });
  expect(mocks.write).not.toHaveBeenCalled();
});
it("does not allow clearing an existing field", async () => {
  mocks.read.mockResolvedValue([{ ...legacy, trainingFieldId: fieldId }]);
  expect((await save([legacy])).status).toBe(400);
});
