import { describe, expect, it, vi } from "vitest";
import { blankDocument } from "./document";
import { documentUsages, usageLabel, withoutTrainingNumbers } from "./trainingUsage";

const clubId = "11111111-1111-4111-8111-111111111111";
const first = "22222222-2222-4222-8222-222222222222";
const second = "33333333-3333-4333-8333-333333333333";
const row = (documentId: string, position: bigint | null, number: string | null = "3") => ({
  document_id: documentId, cycle_id: "c", group_key: "custom:g", row_id: "r", week: "2026-11-16", group_name: "Група", number, position,
});

describe("training usages", () => {
  it("does not query the database without plans", async () => {
    const db = { $queryRaw: vi.fn() };
    expect((await documentUsages(db as never, clubId, [])).size).toBe(0);
    expect(db.$queryRaw).not.toHaveBeenCalled();
  });

  it("groups the trainings by plan and gives the training number from the row position", async () => {
    const db = { $queryRaw: vi.fn().mockResolvedValue([row(first, BigInt(2)), row(first, BigInt(1), "4"), row(second, null, null)]) };
    const usages = await documentUsages(db as never, clubId, [first, second, "44444444-4444-4444-8444-444444444444"]);
    expect(db.$queryRaw).toHaveBeenCalledOnce();
    expect(usages.get(first)?.map(usage => [usage.microcycle, usage.sessionNumber])).toEqual([["3", "2"], ["4", "1"]]);
    expect(usages.get(second)).toEqual([{ cycleId: "c", groupKey: "custom:g", rowId: "r", week: "2026-11-16", group: "Група", microcycle: "", sessionNumber: "" }]);
    expect(usages.get("44444444-4444-4444-8444-444444444444")).toEqual([]);
  });

  it("removes only the training numbers from a linked plan", () => {
    const content = blankDocument("Група");
    const numbered = { ...content, session: { ...content.session, title: "План", microcycle: "3", sessionNumber: "2" } };
    expect(withoutTrainingNumbers(numbered).session).toEqual({ ...numbered.session, microcycle: "", sessionNumber: "" });
    expect(numbered.session.microcycle).toBe("3");
  });

  it("names a training with a missing number", () => {
    expect(usageLabel({ microcycle: "3", sessionNumber: "2" })).toBe("Микроцикъл 3, тренировка №2");
    expect(usageLabel({ microcycle: "", sessionNumber: "" })).toBe("Микроцикъл —, тренировка №—");
  });
});
