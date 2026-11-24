import type { SessionTarget } from "./trainingSession";

/** One microcycle of a coach group, with the IDs of its trainings in order. */
export type CycleOption = { id: string; groupKey: string; week: string; number: string; rows: string[] };
export type TrainingOptions = { groups: { key: string; name: string }[]; cycles: CycleOption[] };
export type TrainingChoice = {
  /** The microcycle that the text identifies. */
  cycle?: CycleOption;
  /** The training that the text identifies. */
  target?: SessionTarget;
  microcycleWarning?: string;
  sessionWarning?: string;
};

const sameNumber = (left: string, right: string) => {
  const a = left.trim(), b = right.trim();
  if (!a || !b) return false;
  return /^\d+$/.test(a) && /^\d+$/.test(b) ? Number(a) === Number(b) : a.toLocaleLowerCase("bg") === b.toLocaleLowerCase("bg");
};

/** The microcycles of a group, the latest week first. */
export function groupCycles(options: TrainingOptions | undefined, groupKey: string | undefined) {
  if (!options || !groupKey) return [];
  return options.cycles.filter(cycle => cycle.groupKey === groupKey).sort((a, b) => b.week.localeCompare(a.week));
}

/**
 * Finds the training that the "Микроцикъл" and "Тренировка №" text identifies.
 * When more than one week has the same microcycle number, the preferred cycle wins, then the latest week.
 */
export function resolveTraining(options: TrainingOptions | undefined, groupKey: string | undefined, microcycle: string, sessionNumber: string,
  preferredCycle?: string): TrainingChoice {
  if (!options || !groupKey) return {};
  const matches = groupCycles(options, groupKey).filter(cycle => sameNumber(cycle.number, microcycle));
  const cycle = matches.find(item => item.id === preferredCycle) ?? matches[0];
  const text = microcycle.trim();
  if (!cycle) return text ? { microcycleWarning: `Няма микроцикъл „${text}“ за групата. Проверете номера.` } : {};
  const number = sessionNumber.trim();
  const index = /^\d+$/.test(number) ? Number(number) - 1 : -1;
  const rowId = cycle.rows[index];
  if (!rowId) return {
    cycle,
    sessionWarning: number
      ? `Няма тренировка №${number} в микроцикъл ${cycle.number.trim()}. Тренировките са ${cycle.rows.length ? `от 1 до ${cycle.rows.length}` : "0"}.`
      : undefined,
  };
  return { cycle, target: { cycleId: cycle.id, rowId, week: cycle.week, groupKey } };
}
