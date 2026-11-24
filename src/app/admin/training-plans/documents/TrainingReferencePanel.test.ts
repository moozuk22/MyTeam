import { expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import TrainingReferencePanel, { mergeReferences } from "./TrainingReferencePanel";
import type { TrainingReference } from "@/lib/exercise/trainingSession";

const reference = (cells: string[], microcycle = "15", sessionNumber = "1"): TrainingReference => ({
  cells, microcycle, sessionNumber, group: "", season: "", halfSeason: "", documentId: null, occupied: false,
});

it("shows the same instructions once for all groups", () => {
  const entries = mergeReferences([
    { group: "Група 1", reference: reference(["А", "Б", "", "", ""]) },
    { group: "Група 2", reference: reference(["А ", "Б", "", "", ""], "14", "3") },
  ]);
  expect(entries).toHaveLength(1);
  expect(entries[0]).toMatchObject({ groups: ["Група 1", "Група 2"], labels: ["Микроцикъл 15, тренировка №1", "Микроцикъл 14, тренировка №3"] });
});

it("shows different instructions, loading groups, and groups without a training separately", () => {
  const entries = mergeReferences([
    { group: "Група 1", reference: reference(["А", "", "", "", ""]) },
    { group: "Група 2", reference: reference(["В", "", "", "", ""]) },
    { group: "Група 3", reference: reference(["А", "", "", "", ""]) },
    { group: "Група 4" },
    { group: "Група 5", missing: true },
  ]);
  expect(entries.map(entry => entry.groups)).toEqual([["Група 1", "Група 3"], ["Група 2"], ["Група 4"], ["Група 5"]]);
  expect(entries[3].missing).toBe(true);
});

it("shows the instructions of an extra group when the main group has no training", () => {
  const html = renderToStaticMarkup(createElement(TrainingReferencePanel, {
    error: "", refresh: () => {}, changed: false, group: "Група 1", missing: true,
    others: [{ group: "Група 2", reference: reference(["Пасове", "", "", "", ""]) }],
  }));
  expect(html).toContain("Няма избрана тренировка за групата.");
  expect(html).toContain("Пасове");
  expect(html).not.toContain("aria-busy");
});
