import { describe, expect, it } from "vitest";
import { groupCycles, resolveTraining, type TrainingOptions } from "./trainingOptions";

const group = "custom:77777777-7777-4777-8777-777777777777";
const other = "custom:88888888-8888-4888-8888-888888888888";
const row = (n: number) => `00000000-0000-4000-8000-00000000000${n}`;
const options: TrainingOptions = {
  groups: [{ key: group, name: "U12" }, { key: other, name: "U14" }],
  cycles: [
    { id: "a", groupKey: group, week: "2026-11-09", number: "3", rows: [row(1), row(2)] },
    { id: "b", groupKey: group, week: "2026-11-16", number: "3", rows: [row(3)] },
    { id: "c", groupKey: group, week: "2026-11-02", number: "2", rows: [] },
    { id: "d", groupKey: other, week: "2026-11-16", number: "5", rows: [row(4)] },
  ],
};

describe("training options", () => {
  it("lists the microcycles of one group, the latest week first", () => {
    expect(groupCycles(options, group).map(cycle => cycle.id)).toEqual(["b", "a", "c"]);
    expect(groupCycles(options, undefined)).toEqual([]);
  });

  it("finds the training of the latest week with that microcycle number", () => {
    expect(resolveTraining(options, group, "3", "1")).toEqual({
      cycle: options.cycles[1], target: { cycleId: "b", rowId: row(3), week: "2026-11-16", groupKey: group },
    });
  });

  it("uses the chosen week when two weeks have the same number", () => {
    expect(resolveTraining(options, group, " 03 ", "2", "a").target).toEqual({ cycleId: "a", rowId: row(2), week: "2026-11-09", groupKey: group });
  });

  it("warns about a microcycle that the group does not have", () => {
    const choice = resolveTraining(options, group, "5", "1");
    expect(choice.target).toBeUndefined();
    expect(choice.microcycleWarning).toBe("Няма микроцикъл „5“ за групата. Проверете номера.");
  });

  it("warns about a training number that the microcycle does not have", () => {
    expect(resolveTraining(options, group, "3", "4", "a")).toEqual({
      cycle: options.cycles[0], sessionWarning: "Няма тренировка №4 в микроцикъл 3. Тренировките са от 1 до 2.",
    });
    expect(resolveTraining(options, group, "2", "1").sessionWarning).toBe("Няма тренировка №1 в микроцикъл 2. Тренировките са 0.");
  });

  it("does not warn about empty fields or before the options load", () => {
    expect(resolveTraining(options, group, "", "")).toEqual({});
    expect(resolveTraining(options, group, "3", "").sessionWarning).toBeUndefined();
    expect(resolveTraining(undefined, group, "9", "9")).toEqual({});
    expect(resolveTraining(options, undefined, "9", "9")).toEqual({});
  });
});
