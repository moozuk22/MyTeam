import { beforeEach, expect, it, vi } from "vitest";
import { emptyCycle, reuseCycle, type CycleContent } from "./microcycle";
import { CycleConflict, removeCycle, saveCycle, type CycleSave } from "./microcycleStore";
import type { TrainingImageTx } from "./imageStorage";

const row = (id: string, text = "") => ({ id, cells: [text, "", "", "", ""] });
const ROW = "11111111-1111-4111-8111-111111111111";
const stored: CycleContent = { ...emptyCycle(), season: "2026/2027", half: "Есенен", rows: [row(ROW, "Старо")] };
const group = { key: "custom:a", name: "Група А" };
const other = { key: "custom:b", name: "Група Б" };

const tx = {
  trainingMicrocycle: { create: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn() },
  trainingMicrocycleGroup: { findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn(), deleteMany: vi.fn(), createMany: vi.fn() },
  trainingSessionDocument: { deleteMany: vi.fn() },
};
const db = tx as unknown as TrainingImageTx;

function usage(groups: string[], revision = 3) {
  tx.trainingMicrocycleGroup.findUnique.mockResolvedValue({ cycle: { id: "shared", revision, content: stored, groups: groups.map(groupKey => ({ groupKey })) } });
}
const input = (values: Partial<CycleSave>): CycleSave => ({
  clubId: "club", week: "2026-11-23", group, revision: 3, scope: "group", addGroups: [],
  content: { ...stored, rows: [row(ROW, "Ново")] }, ...values,
});

beforeEach(() => {
  vi.resetAllMocks();
  tx.trainingMicrocycle.updateMany.mockResolvedValue({ count: 1 });
  tx.trainingMicrocycleGroup.findMany.mockResolvedValue([]);
});

it("gives the group its own copy when it changes a shared microcycle for itself", async () => {
  usage([group.key, other.key]);
  tx.trainingMicrocycle.create.mockResolvedValue({ id: "copy", revision: 1 });
  const saved = await saveCycle(db, input({ scope: "group" }));

  expect(saved).toMatchObject({ id: "copy", revision: 1 });
  expect(tx.trainingMicrocycle.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ content: expect.objectContaining({ rows: [row(ROW, "Ново")] }) }) }));
  expect(tx.trainingMicrocycleGroup.update).toHaveBeenCalledWith(expect.objectContaining({ data: { cycleId: "copy" } }));
  // The other group keeps the old text. Only its revision changes.
  expect(tx.trainingMicrocycle.updateMany).toHaveBeenCalledWith({ where: { id: "shared", revision: 3 }, data: { revision: { increment: 1 } } });
  expect(tx.trainingSessionDocument.deleteMany).toHaveBeenCalledWith({ where: { cycleId: "copy", rowId: { notIn: [ROW] } } });
});

it("changes the shared microcycle for all its groups", async () => {
  usage([group.key, other.key]);
  const saved = await saveCycle(db, input({ scope: "all" }));

  expect(saved).toMatchObject({ id: "shared", revision: 4 });
  expect(tx.trainingMicrocycle.create).not.toHaveBeenCalled();
  expect(tx.trainingMicrocycle.updateMany).toHaveBeenCalledWith({ where: { id: "shared", revision: 3 },
    data: { content: expect.objectContaining({ rows: [row(ROW, "Ново")] }), revision: { increment: 1 } } });
});

it("does not copy a microcycle that only one group uses", async () => {
  usage([group.key]);
  expect(await saveCycle(db, input({ scope: "group" }))).toMatchObject({ id: "shared", revision: 4 });
  expect(tx.trainingMicrocycle.create).not.toHaveBeenCalled();
});

it("rejects a save from an old revision", async () => {
  usage([group.key, other.key], 4);
  await expect(saveCycle(db, input({}))).rejects.toBeInstanceOf(CycleConflict);
  expect(tx.trainingMicrocycle.create).not.toHaveBeenCalled();
});

it("adds groups and replaces their own microcycle of the week", async () => {
  usage([group.key]);
  tx.trainingMicrocycleGroup.findMany.mockResolvedValue([{ cycleId: "old", groupKey: other.key }]);
  await saveCycle(db, input({ addGroups: [other] }));

  expect(tx.trainingMicrocycleGroup.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { clubId: "club", week: "2026-11-23", groupKey: { in: [other.key] }, cycleId: { not: "shared" } } }));
  expect(tx.trainingMicrocycleGroup.deleteMany).toHaveBeenCalledWith({ where: { clubId: "club", week: "2026-11-23", groupKey: { in: [other.key] } } });
  // The old microcycle is deleted only when no group uses it.
  expect(tx.trainingMicrocycle.deleteMany).toHaveBeenCalledWith({ where: { clubId: "club", id: { in: ["old"] }, groups: { none: {} } } });
  expect(tx.trainingMicrocycleGroup.createMany).toHaveBeenCalledWith({
    data: [{ cycleId: "shared", clubId: "club", week: "2026-11-23", groupKey: other.key, groupName: other.name }], skipDuplicates: true,
  });
});

it("creates one microcycle for the group and the added groups", async () => {
  tx.trainingMicrocycle.create.mockResolvedValue({ id: "new", revision: 1 });
  const saved = await saveCycle(db, input({ revision: 0, addGroups: [other] }));

  expect(saved).toMatchObject({ id: "new", revision: 1 });
  expect(tx.trainingMicrocycle.create.mock.calls[0][0].data.groups).toEqual({ create: { groupKey: group.key, groupName: group.name } });
  expect(tx.trainingMicrocycleGroup.createMany.mock.calls[0][0].data).toEqual([expect.objectContaining({ cycleId: "new", groupKey: other.key })]);
});

it("removes the microcycle only from the selected group", async () => {
  tx.trainingMicrocycleGroup.findUnique.mockResolvedValue({ cycle: { id: "shared", revision: 3 } });
  tx.trainingMicrocycleGroup.findMany.mockResolvedValue([{ cycleId: "shared", groupKey: group.key }]);
  await removeCycle(db, "club", "2026-11-23", group.key, 3);

  expect(tx.trainingMicrocycleGroup.deleteMany).toHaveBeenCalledWith({ where: { clubId: "club", week: "2026-11-23", groupKey: { in: [group.key] } } });
  expect(tx.trainingMicrocycle.deleteMany).toHaveBeenCalledWith({ where: { clubId: "club", id: { in: ["shared"] }, groups: { none: {} } } });
  tx.trainingMicrocycleGroup.findUnique.mockResolvedValue({ cycle: { id: "shared", revision: 4 } });
  await expect(removeCycle(db, "club", "2026-11-23", group.key, 3)).rejects.toBeInstanceOf(CycleConflict);
});

it("reuses a past microcycle with new training IDs and the current season", () => {
  let n = 0;
  const reused = reuseCycle({ ...stored, number: "7", format: "11×11" }, { season: "2027/2028", half: "Пролетен" }, () => `id-${++n}`);
  expect(reused).toMatchObject({ number: "7", format: "11×11", season: "2027/2028", half: "Пролетен", rows: [{ id: "id-1", cells: ["Старо", "", "", "", ""] }] });
  expect(reused.rows[0].cells).not.toBe(stored.rows[0].cells);
});
