import { randomUUID } from "node:crypto";
import type { TrainingImageTx as Tx } from "./imageStorage";
import { currentCompetitionSeason } from "./document";
import { parseCycle, type CycleContent } from "./microcycle";
import type { FilterGroup } from "./microcycleGroupFilter";

/** A save request. Groups in `addGroups` also use the saved microcycle. Their own microcycle for the week is replaced. */
export type CycleSave = {
  clubId: string; week: string; group: FilterGroup; revision: number; content: CycleContent;
  /** "group" makes a copy for this group when other groups use the same microcycle. "all" changes it for all groups. */
  scope: "group" | "all";
  addGroups: FilterGroup[];
};

export class CycleConflict extends Error {
  constructor() { super("Микроцикълът е променен. Презаредете страницата."); }
}

/** Removes the groups from the microcycles that they use in the week, except `keep`. A microcycle without groups is deleted. */
async function release(tx: Tx, clubId: string, week: string, keys: string[], keep?: string) {
  if (!keys.length) return;
  const old = await tx.trainingMicrocycleGroup.findMany({
    where: { clubId, week, groupKey: { in: keys }, ...(keep ? { cycleId: { not: keep } } : {}) }, select: { cycleId: true, groupKey: true },
  });
  if (!old.length) return;
  // The plan links of these groups are deleted with the group (ON DELETE CASCADE). The plans stay in the library.
  await tx.trainingMicrocycleGroup.deleteMany({ where: { clubId, week, groupKey: { in: old.map(g => g.groupKey) } } });
  await tx.trainingMicrocycle.deleteMany({ where: { clubId, id: { in: [...new Set(old.map(g => g.cycleId))] }, groups: { none: {} } } });
}

async function addGroups(tx: Tx, clubId: string, week: string, cycleId: string, groups: FilterGroup[]) {
  await release(tx, clubId, week, groups.map(g => g.key), cycleId);
  await tx.trainingMicrocycleGroup.createMany({
    data: groups.map(g => ({ cycleId, clubId, week, groupKey: g.key, groupName: g.name })), skipDuplicates: true,
  });
}

/** Saves the microcycle of a group. It returns the microcycle that the group uses after the save. */
export async function saveCycle(tx: Tx, input: CycleSave) {
  const { clubId, week, group, content } = input;
  if (input.revision === 0) {
    const season = currentCompetitionSeason();
    content.season = season.season; content.half = season.halfSeason;
    content.rows = content.rows.map(row => ({ ...row, id: randomUUID() }));
    // The unique key of the group and week rejects a second microcycle (P2002).
    const cycle = await tx.trainingMicrocycle.create({
      data: { clubId, week, content, groups: { create: { groupKey: group.key, groupName: group.name } } },
      select: { id: true, revision: true },
    });
    await addGroups(tx, clubId, week, cycle.id, input.addGroups);
    return { id: cycle.id, revision: cycle.revision, content };
  }
  const usage = await tx.trainingMicrocycleGroup.findUnique({
    where: { clubId_groupKey_week: { clubId, groupKey: group.key, week } },
    select: { cycle: { select: { id: true, revision: true, content: true, groups: { select: { groupKey: true } } } } },
  });
  const previous = usage?.cycle;
  if (!previous || previous.revision !== input.revision) throw new CycleConflict();
  const stored = parseCycle(previous.content);
  content.season = stored.season; content.half = stored.half;
  const existing = new Set(stored.rows.map(row => row.id));
  content.rows = content.rows.map(row => existing.has(row.id) ? row : { ...row, id: randomUUID() });
  let id = previous.id;
  let revision = input.revision + 1;
  if (input.scope === "group" && previous.groups.length > 1) {
    // Copy on write: the group gets its own microcycle. The row IDs stay, so the plan links of the group stay too.
    const copy = await tx.trainingMicrocycle.create({ data: { clubId, week, content }, select: { id: true, revision: true } });
    await tx.trainingMicrocycleGroup.update({
      where: { clubId_groupKey_week: { clubId, groupKey: group.key, week } }, data: { cycleId: copy.id },
    });
    // The other groups keep the microcycle. A change of the revision tells the other open editors to reload.
    const changed = await tx.trainingMicrocycle.updateMany({ where: { id: previous.id, revision: input.revision }, data: { revision: { increment: 1 } } });
    if (!changed.count) throw new CycleConflict();
    id = copy.id; revision = copy.revision;
  } else {
    const changed = await tx.trainingMicrocycle.updateMany({ where: { id, revision: input.revision }, data: { content, revision: { increment: 1 } } });
    if (!changed.count) throw new CycleConflict();
  }
  await tx.trainingSessionDocument.deleteMany({ where: { cycleId: id, rowId: { notIn: content.rows.map(row => row.id) } } });
  await addGroups(tx, clubId, week, id, input.addGroups);
  return { id, revision, content };
}

/** Removes the microcycle from one group. The other groups keep it. The last group deletes it. */
export async function removeCycle(tx: Tx, clubId: string, week: string, groupKey: string, revision: number) {
  const usage = await tx.trainingMicrocycleGroup.findUnique({
    where: { clubId_groupKey_week: { clubId, groupKey, week } }, select: { cycle: { select: { id: true, revision: true } } },
  });
  if (!usage || usage.cycle.revision !== revision) throw new CycleConflict();
  const changed = await tx.trainingMicrocycle.updateMany({ where: { id: usage.cycle.id, revision }, data: { revision: { increment: 1 } } });
  if (!changed.count) throw new CycleConflict();
  await release(tx, clubId, week, [groupKey]);
}
