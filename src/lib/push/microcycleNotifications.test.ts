import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ findMany: vi.fn(), save: vi.fn(), send: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: { clubCustomTrainingGroup: { findMany: mocks.findMany } } }));
vi.mock("@/lib/push/adminHistory", () => ({ saveAdminNotificationHistory: mocks.save }));
vi.mock("@/lib/push/adminService", () => ({ sendPushToClubAdmins: mocks.send }));
import { microcycleUrl, notifyNewMicrocycle } from "./microcycleNotifications";
import { groupTarget } from "@/lib/exercise/trainingSession";
const A = "11111111-1111-4111-8111-111111111111", B = "22222222-2222-4222-8222-222222222222", C = "33333333-3333-4333-8333-333333333333";
beforeEach(() => { vi.clearAllMocks(); mocks.save.mockResolvedValue({}); mocks.send.mockResolvedValue({ total: 0, sent: 0, failed: 0, deactivated: 0 }); });

it("sends one notification to each coach group with a link to its first group", async () => {
  mocks.findMany.mockResolvedValue([
    { id: B, name: "Група 10", coachGroupId: "coach-1" },
    { id: A, name: "Група 2", coachGroupId: "coach-1" },
    { id: C, name: "Вратари", coachGroupId: "coach-2" },
  ]);
  await notifyNewMicrocycle("club", "2026-11-16", [`custom:${A}`, `custom:${B}`, `custom:${C}`, "training:x"]);
  // Team groups have no coach group, so the query asks only for custom groups with a coach group.
  expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { clubId: "club", id: { in: [A, B, C] }, coachGroupId: { not: null } } }));
  expect(mocks.save).toHaveBeenCalledTimes(2);
  const first = mocks.save.mock.calls[0][0];
  expect(first).toMatchObject({ clubId: "club", coachGroupId: "coach-1", type: "training_microcycle" });
  expect(first.payload.title).toBe("Нов микроцикъл");
  expect(first.payload.body).toBe("Група 2, Група 10 · 16 – 22 ноември 2026 г.");
  expect(first.payload.url).toBe(microcycleUrl("club", "coach-1", "2026-11-16", `custom:${A}`));
  expect(mocks.send).toHaveBeenCalledWith("club", first.payload, "coach-1");
  expect(mocks.send).toHaveBeenCalledWith("club", expect.objectContaining({ body: "Вратари · 16 – 22 ноември 2026 г." }), "coach-2");
});

it("does not query the database without custom groups", async () => {
  await notifyNewMicrocycle("club", "2026-11-16", ["training:x"]);
  expect(mocks.findMany).not.toHaveBeenCalled();
});

it("continues with the next coach group after a failure", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.findMany.mockResolvedValue([{ id: A, name: "А", coachGroupId: "coach-1" }, { id: C, name: "В", coachGroupId: "coach-2" }]);
  mocks.save.mockRejectedValueOnce(new Error("down"));
  await notifyNewMicrocycle("club", "2026-11-16", [`custom:${A}`, `custom:${C}`]);
  expect(mocks.send).toHaveBeenCalledTimes(1);
  expect(mocks.send).toHaveBeenCalledWith("club", expect.anything(), "coach-2");
});

it("builds a link that the microcycle page reads back", () => {
  const url = new URL(microcycleUrl("club", "coach-1", "2026-11-16", `custom:${A}`), "http://localhost");
  expect(url.pathname).toBe("/admin/training-plans/microcycles");
  expect(url.searchParams.get("coachGroupId")).toBe("coach-1");
  expect(groupTarget(Object.fromEntries(url.searchParams))).toEqual({ groupKey: `custom:${A}`, week: "2026-11-16" });
  expect(groupTarget({ groupKey: `custom:${A}`, week: "2026-11-17" })).toBeNull();
  expect(groupTarget({ groupKey: "custom:x", week: "2026-11-16" })).toBeNull();
});

it("does not throw when the groups cannot be loaded", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.findMany.mockRejectedValue(new Error("down"));
  await expect(notifyNewMicrocycle("club", "2026-11-16", [`custom:${A}`])).resolves.toBeUndefined();
  expect(mocks.save).not.toHaveBeenCalled();
});
