import { beforeEach, expect, it, vi } from "vitest";
import { emptyCycle, reuseCycle, type CycleContent } from "./microcycle";
import { CycleConflict, removeCycle, saveCycle, type CycleSave } from "./microcycleStore";
import type { TrainingImageTx } from "./imageStorage";

const row = (id: string, text = "") => ({ id, cells: [text, "", "", "", ""] });
const ROW = "11111111-1111-4111-8111-111111111111";
const stored: CycleContent = { ...emptyCycle(), season: "2026/2027", half: "Есенен", rows: [row(ROW, "Старо")] };
const group = { key: "custom:a", name: "Група А" };
const other = { key: "custom:b", name: "Група Б", expected: null };

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
  clubId: "club", week: "2026-11-23", group, cycleId: "shared", revision: 3, scope: "group", addGroups: [],
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
  tx.trainingMicrocycleGroup.findMany.mockResolvedValueOnce([{ groupKey: other.key, cycle: { id: "old", revision: 2 } }]);
  tx.trainingMicrocycleGroup.deleteMany.mockResolvedValue({ count: 1 });
  await saveCycle(db, input({ addGroups: [{ ...other, expected: { id: "old", revision: 2 } }] }));

  // The revision update locks the replaced microcycle at the checked revision.
  expect(tx.trainingMicrocycle.updateMany).toHaveBeenCalledWith({ where: { id: "old", clubId: "club", revision: 2 }, data: { revision: { increment: 1 } } });
  // Only the checked membership is deleted.
  expect(tx.trainingMicrocycleGroup.deleteMany).toHaveBeenCalledWith({ where: { clubId: "club", week: "2026-11-23", cycleId: "old", groupKey: { in: [other.key] } } });
  // The old microcycle is deleted only when no group uses it.
  expect(tx.trainingMicrocycle.deleteMany).toHaveBeenCalledWith({ where: { clubId: "club", id: { in: ["old"] }, groups: { none: {} } } });
  expect(tx.trainingMicrocycleGroup.createMany).toHaveBeenCalledWith({
    data: [{ cycleId: "shared", clubId: "club", week: "2026-11-23", groupKey: other.key, groupName: other.name }],
  });
});

it("stops when a replaced microcycle changes after the check", async () => {
  usage([group.key]);
  const expected = { id: "old", revision: 2 };
  // Another save changed the microcycle between the check and the lock.
  tx.trainingMicrocycleGroup.findMany.mockResolvedValueOnce([{ groupKey: other.key, cycle: expected }]);
  tx.trainingMicrocycle.updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
  await expect(saveCycle(db, input({ addGroups: [{ ...other, expected }] }))).rejects.toBeInstanceOf(CycleConflict);
  expect(tx.trainingMicrocycleGroup.deleteMany).not.toHaveBeenCalled();
  // The group moved to another microcycle, so the delete finds no membership.
  tx.trainingMicrocycleGroup.findMany.mockResolvedValueOnce([{ groupKey: other.key, cycle: expected }]);
  tx.trainingMicrocycleGroup.deleteMany.mockResolvedValueOnce({ count: 0 });
  await expect(saveCycle(db, input({ addGroups: [{ ...other, expected }] }))).rejects.toBeInstanceOf(CycleConflict);
  expect(tx.trainingMicrocycleGroup.createMany).not.toHaveBeenCalled();
});

it("stops when an added group got another microcycle after the editor loaded the week", async () => {
  usage([group.key]);
  // The editor showed no microcycle for the group, so it gave no replacement warning.
  tx.trainingMicrocycleGroup.findMany.mockResolvedValueOnce([{ groupKey: other.key, cycle: { id: "new-b", revision: 1 } }]);
  await expect(saveCycle(db, input({ addGroups: [other] }))).rejects.toBeInstanceOf(CycleConflict);
  // A changed revision of the expected microcycle also stops the save.
  tx.trainingMicrocycleGroup.findMany.mockResolvedValueOnce([{ groupKey: other.key, cycle: { id: "old", revision: 3 } }]);
  await expect(saveCycle(db, input({ addGroups: [{ ...other, expected: { id: "old", revision: 2 } }] }))).rejects.toBeInstanceOf(CycleConflict);
  // The expected microcycle was deleted.
  tx.trainingMicrocycleGroup.findMany.mockResolvedValueOnce([]);
  await expect(saveCycle(db, input({ addGroups: [{ ...other, expected: { id: "old", revision: 2 } }] }))).rejects.toBeInstanceOf(CycleConflict);
  expect(tx.trainingMicrocycleGroup.deleteMany).not.toHaveBeenCalled();
  expect(tx.trainingMicrocycleGroup.createMany).not.toHaveBeenCalled();
});

it("rejects a save when the group now uses another microcycle with the same revision", async () => {
  usage([group.key, other.key], 3);
  await expect(saveCycle(db, input({ cycleId: "replaced", scope: "all" }))).rejects.toBeInstanceOf(CycleConflict);
  expect(tx.trainingMicrocycle.updateMany).not.toHaveBeenCalled();
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
  tx.trainingMicrocycleGroup.deleteMany.mockResolvedValue({ count: 1 });
  await removeCycle(db, "club", "2026-11-23", group.key, "shared", 3);

  expect(tx.trainingMicrocycleGroup.deleteMany).toHaveBeenCalledWith({ where: { clubId: "club", week: "2026-11-23", groupKey: group.key, cycleId: "shared" } });
  expect(tx.trainingMicrocycle.deleteMany).toHaveBeenCalledWith({ where: { clubId: "club", id: "shared", groups: { none: {} } } });
  tx.trainingMicrocycleGroup.findUnique.mockResolvedValue({ cycle: { id: "shared", revision: 4 } });
  await expect(removeCycle(db, "club", "2026-11-23", group.key, "shared", 3)).rejects.toBeInstanceOf(CycleConflict);
  // A stale delete does not remove a microcycle that replaced the opened one, also at the same revision.
  tx.trainingMicrocycleGroup.findUnique.mockResolvedValue({ cycle: { id: "replaced", revision: 3 } });
  await expect(removeCycle(db, "club", "2026-11-23", group.key, "shared", 3)).rejects.toBeInstanceOf(CycleConflict);
});

it("reuses a past microcycle with new training IDs and the current season", () => {
  let n = 0;
  const reused = reuseCycle({ ...stored, number: "7", format: "11×11" }, { season: "2027/2028", half: "Пролетен" }, () => `id-${++n}`);
  expect(reused).toMatchObject({ number: "7", format: "11×11", season: "2027/2028", half: "Пролетен", rows: [{ id: "id-1", cells: ["Старо", "", "", "", ""] }] });
  expect(reused.rows[0].cells).not.toBe(stored.rows[0].cells);
});
