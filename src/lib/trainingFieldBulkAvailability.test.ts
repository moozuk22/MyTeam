import { beforeEach, expect, it, vi } from "vitest";
import { assertNoTrainingFieldConflict, assertNoTrainingTimeConflict, getOccupiedFieldResources } from "./trainingFieldConflicts";
import { applyTrainingFieldToDates } from "./trainingFieldPicker";

const db = vi.hoisted(() => ({
  club: { findUnique: vi.fn() }, clubTrainingGroupSchedule: { findMany: vi.fn() },
  clubTrainingScheduleGroup: { findMany: vi.fn() }, clubCustomTrainingGroup: { findMany: vi.fn() },
  coachGroup: { findMany: vi.fn() }, trainingSession: { findMany: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ prisma: db }));
const dates = ["2026-10-13", "2026-10-14"];
beforeEach(() => {
  vi.clearAllMocks();
  db.club.findUnique.mockResolvedValue(null);
  db.clubTrainingGroupSchedule.findMany.mockResolvedValue([]);
  db.clubTrainingScheduleGroup.findMany.mockResolvedValue([]);
  db.clubCustomTrainingGroup.findMany.mockResolvedValue([]);
  db.coachGroup.findMany.mockResolvedValue([{ id: "group", name: "Group" }]);
  db.trainingSession.findMany.mockImplementation(async (query) => query.where.status === "cancelled" ? [] : dates.map((date, index) => ({
    id: `session-${index}`, scopeId: "group", scopeKey: "coach_group:group", trainingDate: new Date(`${date}T00:00:00Z`),
    trainingTime: index ? "18:00" : "09:00", trainingDurationMinutes: 60, trainingFieldId: "field", trainingFieldPieceIds: ["north"],
  })));
});
it("checks each selected day's own time before applying the same section", async () => {
  const occupied = await getOccupiedFieldResources({ clubId: "club", trainingDates: dates, trainingDateTimes: { [dates[0]]: "18:00", [dates[1]]: "18:30" }, trainingDurationMinutes: 60 });
  expect(occupied.map((resource) => resource.date)).toEqual([dates[1]]);
  expect(applyTrainingFieldToDates({}, dates, { trainingFieldId: "field", trainingFieldPieceIds: ["north"] }, occupied).conflictingDates).toEqual([dates[1]]);
  expect(applyTrainingFieldToDates({}, dates, { trainingFieldId: "field", trainingFieldPieceIds: ["south"] }, occupied).selections).not.toBeNull();
});
it("allows back-to-back trainings but blocks overlap introduced by a longer duration", async () => {
  const input = { clubId: "club", trainingDates: dates, trainingDateTimes: { [dates[0]]: "10:00", [dates[1]]: "17:00" }, trainingDurationMinutes: 60 };
  expect(await getOccupiedFieldResources(input)).toEqual([]);
  expect((await getOccupiedFieldResources({ ...input, trainingDurationMinutes: 90 })).map((resource) => resource.date)).toEqual([dates[1]]);
});

it.each([120, 30])("uses an edited recurring session duration of %i minutes only on its own date", async (duration) => {
  db.clubCustomTrainingGroup.findMany.mockResolvedValue([{
    id: "group", name: "Group", trainingDates: dates, trainingDateTimes: {}, trainingTime: "18:00",
    trainingDurationMinutes: 60, trainingFieldId: "field", trainingFieldPieceIds: [],
  }]);
  db.trainingSession.findMany.mockImplementation(async ({ where }) => where.status === "scheduled"
    && where.OR.some((scope: { scopeType: string; occurrenceKey?: string }) => scope.scopeType === "customGroup" && scope.occurrenceKey === undefined)
    ? [{
      scopeType: "customGroup", occurrenceKey: "", scopeKey: "custom_group:group",
      trainingDate: new Date(`${dates[0]}T00:00:00Z`), trainingDurationMinutes: duration,
    }]
    : []);
  const startTime = duration === 120 ? "19:30" : "18:45";
  const input = { clubId: "club", trainingDates: dates, trainingDateTimes: { [dates[0]]: startTime, [dates[1]]: startTime },
    trainingDurationMinutes: 30, trainingFieldId: "field", trainingFieldPieceIds: [] };
  const conflictingDate = dates[duration === 120 ? 0 : 1];
  const freeDate = dates[duration === 120 ? 1 : 0];
  expect((await getOccupiedFieldResources(input)).map(({ date }) => date)).toEqual([conflictingDate]);
  for (const check of [assertNoTrainingTimeConflict, assertNoTrainingFieldConflict]) {
    await expect(check({ ...input, trainingDates: [conflictingDate] })).rejects.toThrow();
    await expect(check({ ...input, trainingDates: [freeDate] })).resolves.toBeUndefined();
  }
});
