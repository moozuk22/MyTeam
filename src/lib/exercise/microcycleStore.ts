import { randomUUID } from "node:crypto";
import type { TrainingImageTx as Tx } from "./imageStorage";
import { currentCompetitionSeason } from "./document";
import { parseCycle, type CycleContent } from "./microcycle";
import type { FilterGroup } from "./microcycleGroupFilter";

/**
 * A group that also gets the saved microcycle. `expected` is the microcycle that the editor showed for the group
 * (null when the group had none). The save stops when the group now has a different microcycle.
 */
export type AddedGroup = FilterGroup & { expected: { id: string; revision: number } | null };

/** A save request. Groups in `addGroups` also use the saved microcycle. Their own microcycle for the week is replaced. */
export type CycleSave = {
  clubId: string; week: string; group: FilterGroup; revision: number; content: CycleContent;
  /** The microcycle that the editor opened. It is necessary when `revision` is more than 0. */
  cycleId?: string;
  /** "group" makes a copy for this group when other groups use the same microcycle. "all" changes it for all groups. */
  scope: "group" | "all";
  addGroups: AddedGroup[];
  /** The number of plan links (of removed trainings and replaced microcycles) that the user accepted to remove. A higher number stops the save again. */
  confirmedLinks?: number;
};

export class CycleConflict extends Error {
  constructor() { super("Микроцикълът е променен. Презаредете страницата."); }
}

/** The save or delete removes plan links, and the user did not accept their removal. The transaction rolls back. */
export class RemovedLinks extends Error {
  constructor(readonly count: number) { super("Изтритите тренировки имат план-конспекти."); }
}

/** Removes one group from the microcycle that it uses in the week. A microcycle without groups is deleted. */
async function release(tx: Tx, clubId: string, week: string, groupKey: string, cycleId: string) {
  // The plan links of the group are deleted with the group (ON DELETE CASCADE). The plans stay in the library.
  const removed = await tx.trainingMicrocycleGroup.deleteMany({ where: { clubId, week, groupKey, cycleId } });
  if (!removed.count) throw new CycleConflict();
  await tx.trainingMicrocycle.deleteMany({ where: { clubId, id: cycleId, groups: { none: {} } } });
}

type GroupPlan = { replaced: Map<string, string[]>; joined: AddedGroup[]; links: number };

/**
 * Checks the groups that get the microcycle `cycleId` and locks each microcycle that they replace.
 * Each change of the groups of a microcycle also increments its revision. The conditional revision update locks a
 * replaced microcycle, so a save of another user cannot change its groups between the check and the replacement.
 * `links` is the number of plan links that the replacement removes.
 */
async function lockAddedGroups(tx: Tx, clubId: string, week: string, cycleId: string, groups: AddedGroup[]): Promise<GroupPlan> {
  const plan: GroupPlan = { replaced: new Map(), joined: [], links: 0 };
  if (!groups.length) return plan;
  // Another user can give a group a microcycle (and plan links) after this editor loaded the week.
  // The replacement warning was then not shown, so the save stops.
  const current = await tx.trainingMicrocycleGroup.findMany({
    where: { clubId, week, groupKey: { in: groups.map(g => g.key) } }, select: { groupKey: true, cycle: { select: { id: true, revision: true } } },
  });
  const revisions = new Map<string, number>();
  for (const group of groups) {
    const actual = current.find(item => item.groupKey === group.key)?.cycle;
    if (actual?.id === cycleId) continue;
    if (!actual ? group.expected !== null : actual.id !== group.expected?.id || actual.revision !== group.expected.revision) throw new CycleConflict();
    if (actual) {
      revisions.set(actual.id, actual.revision);
      plan.replaced.set(actual.id, [...plan.replaced.get(actual.id) ?? [], group.key]);
    }
    plan.joined.push(group);
  }
  for (const [id, revision] of revisions) {
    const changed = await tx.trainingMicrocycle.updateMany({ where: { id, clubId, revision }, data: { revision: { increment: 1 } } });
    if (!changed.count) throw new CycleConflict();
  }
  // A coach can link a plan without a change of the revision. The count after the lock includes these links.
  for (const [id, keys] of plan.replaced)
    plan.links += await tx.trainingSessionDocument.count({ where: { cycleId: id, groupKey: { in: keys } } });
  return plan;
}

/** Moves the groups of a locked plan to the microcycle `cycleId`. */
async function joinGroups(tx: Tx, clubId: string, week: string, cycleId: string, plan: GroupPlan) {
  for (const [id, keys] of plan.replaced) {
    // The plan links of these groups are deleted with the group (ON DELETE CASCADE). The plans stay in the library.
    const removed = await tx.trainingMicrocycleGroup.deleteMany({ where: { clubId, week, cycleId: id, groupKey: { in: keys } } });
    if (removed.count !== keys.length) throw new CycleConflict();
  }
  if (plan.replaced.size) await tx.trainingMicrocycle.deleteMany({ where: { clubId, id: { in: [...plan.replaced.keys()] }, groups: { none: {} } } });
  if (!plan.joined.length) return;
  // A group that got a microcycle after the check gives a unique key error (P2002), and the save rolls back.
  await tx.trainingMicrocycleGroup.createMany({
    data: plan.joined.map(g => ({ cycleId, clubId, week, groupKey: g.key, groupName: g.name })),
  });
}

/** Stops the save when it removes more plan links than the user accepted. A link made after the confirmation is not removed silently. */
function checkLinks(input: CycleSave, linked: number) {
  if (linked > (input.confirmedLinks ?? 0)) throw new RemovedLinks(linked);
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
    const plan = await lockAddedGroups(tx, clubId, week, cycle.id, input.addGroups);
    checkLinks(input, plan.links);
    await joinGroups(tx, clubId, week, cycle.id, plan);
    return { id: cycle.id, revision: cycle.revision, content };
  }
  const usage = await tx.trainingMicrocycleGroup.findUnique({
    where: { clubId_groupKey_week: { clubId, groupKey: group.key, week } },
    select: { cycle: { select: { id: true, revision: true, content: true, groups: { select: { groupKey: true } } } } },
  });
  const previous = usage?.cycle;
  // Another user can replace the microcycle of the group with one at the same revision. The ID shows the change.
  if (!previous || previous.id !== input.cycleId || previous.revision !== input.revision) throw new CycleConflict();
  const stored = parseCycle(previous.content);
  content.season = stored.season; content.half = stored.half;
  const existing = new Set(stored.rows.map(row => row.id));
  content.rows = content.rows.map(row => existing.has(row.id) ? row : { ...row, id: randomUUID() });
  let id = previous.id;
  let revision = input.revision + 1;
  if (input.scope === "group" && previous.groups.length > 1) {
    // Copy on write: the group gets its own microcycle. The row IDs stay, so the plan links of the group stay too.
    // The other groups keep the microcycle. A change of the revision tells the other open editors to reload.
    // It also locks the microcycle before the group moves, so a plan link to the old microcycle waits for this save.
    const changed = await tx.trainingMicrocycle.updateMany({ where: { id: previous.id, revision: input.revision }, data: { revision: { increment: 1 } } });
    if (!changed.count) throw new CycleConflict();
    const copy = await tx.trainingMicrocycle.create({ data: { clubId, week, content }, select: { id: true, revision: true } });
    await tx.trainingMicrocycleGroup.update({
      where: { clubId_groupKey_week: { clubId, groupKey: group.key, week } }, data: { cycleId: copy.id },
    });
    id = copy.id; revision = copy.revision;
  } else {
    const changed = await tx.trainingMicrocycle.updateMany({ where: { id, revision: input.revision }, data: { content, revision: { increment: 1 } } });
    if (!changed.count) throw new CycleConflict();
  }
  // The plan links of removed trainings are deleted. The plans stay in the library.
  const removedRows = { cycleId: id, rowId: { notIn: content.rows.map(row => row.id) } };
  const linked = await tx.trainingSessionDocument.count({ where: removedRows });
  // The user confirms one number: the links of removed trainings and the links of replaced microcycles.
  const plan = await lockAddedGroups(tx, clubId, week, id, input.addGroups);
  checkLinks(input, linked + plan.links);
  await tx.trainingSessionDocument.deleteMany({ where: removedRows });
  await joinGroups(tx, clubId, week, id, plan);
  return { id, revision, content };
}

/** Removes the microcycle from one group. The other groups keep it. The last group deletes it. */
/** `confirmedLinks` is the number of plan links of the group that the user accepted to remove. A higher number stops the delete. */
export async function removeCycle(tx: Tx, clubId: string, week: string, groupKey: string, cycleId: string, revision: number, confirmedLinks = 0) {
  const usage = await tx.trainingMicrocycleGroup.findUnique({
    where: { clubId_groupKey_week: { clubId, groupKey, week } }, select: { cycle: { select: { id: true, revision: true } } },
  });
  if (!usage || usage.cycle.id !== cycleId || usage.cycle.revision !== revision) throw new CycleConflict();
  const changed = await tx.trainingMicrocycle.updateMany({ where: { id: usage.cycle.id, revision }, data: { revision: { increment: 1 } } });
  if (!changed.count) throw new CycleConflict();
  const linked = await tx.trainingSessionDocument.count({ where: { cycleId: usage.cycle.id, groupKey } });
  if (linked > confirmedLinks) throw new RemovedLinks(linked);
  await release(tx, clubId, week, groupKey, usage.cycle.id);
}
