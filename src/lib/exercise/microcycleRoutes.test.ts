import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ findMany: vi.fn(), saveCycle: vi.fn(), removeCycle: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: { trainingMicrocycleGroup: { findMany: mocks.findMany }, $transaction: (work: (tx: unknown) => unknown) => work("tx") } }));
vi.mock("@/lib/exercise/access", () => ({ authorizeTraining: vi.fn().mockResolvedValue({ roles: ["admin"] }), findTrainingPlanCoachGroup: vi.fn(), UUID_RE: /./ }));
vi.mock("@/lib/exercise/microcycleGroups", () => ({ microcycleGroups: vi.fn().mockResolvedValue({ club: { name: "Club" }, groups: [{ key: "custom:a", name: "А" }, { key: "custom:b", name: "Б" }] }) }));
vi.mock("@/lib/exercise/microcycleStore", async (original) => ({ ...await original(), saveCycle: mocks.saveCycle, removeCycle: mocks.removeCycle }));
import { DELETE, GET, POST } from "@/app/api/admin/clubs/[id]/training-plans/microcycles/route";
import { emptyCycle } from "@/lib/exercise/microcycle";
import { CycleConflict } from "@/lib/exercise/microcycleStore";
beforeEach(() => vi.clearAllMocks());
const context = { params: Promise.resolve({ id: "club" }) };
const get = (week: string) => GET(new NextRequest(`http://localhost/api?week=${week}`), context);
const none = (key: string) => ({ key, cycleId: null });
const send = (method: "POST" | "DELETE", body: Record<string, unknown>) => (method === "POST" ? POST : DELETE)(new NextRequest("http://localhost/api", { method, body: JSON.stringify({ week: "2026-11-16", groupKey: "custom:a", cycleId: "c", revision: 2, content: emptyCycle(), ...body }) }), context);
it("returns server error instead of invalid week when database is unavailable", async () => { mocks.findMany.mockRejectedValue({ code: "P2021" }); const response = await get("2026-11-16"); expect(response.status).toBe(500); expect(await response.json()).toEqual({ error: "Микроциклите не могат да бъдат заредени. Опитайте отново." }); });
it("rejects an invalid date before querying cycles", async () => { expect((await get("2026-02-30")).status).toBe(400); expect(mocks.findMany).not.toHaveBeenCalled(); });
it("accepts the reported week with no saved cycles", async () => { mocks.findMany.mockResolvedValue([]); const response = await get("2026-11-16"); expect(response.status).toBe(200); expect((await response.json()).cycles).toEqual([]); });
it("lists the other groups of a shared microcycle for each group", async () => {
  const cycle = { id: "c", revision: 2, content: emptyCycle(), groups: [{ groupKey: "custom:a", groupName: "А" }, { groupKey: "custom:b", groupName: "Б" }] };
  mocks.findMany.mockResolvedValue([{ groupKey: "custom:a", groupName: "А", cycle, documents: [] }, { groupKey: "custom:b", groupName: "Б", cycle, documents: [] }]);
  const { cycles } = await (await GET(new NextRequest("http://localhost/api?week=2026-11-16&version=2"), context)).json();
  expect(cycles.map((c: { groupKey: string; shared: unknown }) => [c.groupKey, c.shared])).toEqual([["custom:a", [{ key: "custom:b", name: "Б" }]], ["custom:b", [{ key: "custom:a", name: "А" }]]]);
});
it("saves the microcycle for the added groups with the chosen scope", async () => {
  mocks.saveCycle.mockResolvedValue({ id: "c", revision: 3, content: emptyCycle() });
  expect((await send("POST", { addGroups: [{ key: "custom:b", cycleId: "old", revision: 4 }], scope: "group" })).status).toBe(200);
  expect(mocks.saveCycle).toHaveBeenCalledWith("tx", expect.objectContaining({ group: { key: "custom:a", name: "А" }, cycleId: "c", scope: "group",
    addGroups: [{ key: "custom:b", name: "Б", expected: { id: "old", revision: 4 } }] }));
});
it("rejects added groups that are unknown, repeated, or the same group", async () => {
  expect((await send("POST", { addGroups: [none("custom:x")] })).status).toBe(404);
  expect((await send("POST", { addGroups: [none("custom:b"), none("custom:b")] })).status).toBe(400);
  expect((await send("POST", { addGroups: [none("custom:a")] })).status).toBe(400);
  // The expected microcycle of an added group is necessary.
  expect((await send("POST", { addGroups: ["custom:b"] })).status).toBe(400);
  expect((await send("POST", { addGroups: [{ key: "custom:b", cycleId: "old" }] })).status).toBe(400);
  expect((await send("POST", { scope: "other" })).status).toBe(400);
  expect(mocks.saveCycle).not.toHaveBeenCalled();
});
it("requires the opened microcycle for a save or delete of a saved microcycle", async () => {
  expect((await send("POST", { cycleId: undefined })).status).toBe(400);
  expect((await send("DELETE", { cycleId: undefined })).status).toBe(400);
  expect(mocks.saveCycle).not.toHaveBeenCalled();
  expect(mocks.removeCycle).not.toHaveBeenCalled();
});
it("returns a conflict for an old revision", async () => {
  mocks.removeCycle.mockRejectedValue(new CycleConflict());
  expect((await send("DELETE", {})).status).toBe(409);
  expect(mocks.removeCycle).toHaveBeenCalledWith("tx", "club", "2026-11-16", "custom:a", "c", 2);
  mocks.saveCycle.mockRejectedValue(new CycleConflict());
  expect((await send("POST", {})).status).toBe(409);
});
