import { expect, it } from "vitest";
import { matchesDraft, readDraft } from "./drafts";
import { EMPTY_EXERCISE } from "./model";

const draft = { baseRevision: "2026-11-23T10:00:00.000Z", layout: EMPTY_EXERCISE, title: "План", savedAt: 1 };

it("treats changed requirements as unsaved draft content", () => {
  const saved = { ...draft, requirements: "Пас с два допира." };
  expect(matchesDraft(saved, EMPTY_EXERCISE, "План", "", null, " Пас с два допира. ")).toBe(true);
  expect(matchesDraft(saved, EMPTY_EXERCISE, "План", "", null, "Пас с един допир.")).toBe(false);
  expect(matchesDraft(draft, EMPTY_EXERCISE, "План", "", null, "Стара чернова без изисквания.")).toBe(true);
});

it("rejects a stored draft with invalid requirements", () => {
  expect(readDraft(JSON.stringify({ ...draft, requirements: "Без контакт." }))?.requirements).toBe("Без контакт.");
  expect(readDraft(JSON.stringify({ ...draft, requirements: "а".repeat(701) }))).toBeNull();
  expect(readDraft(JSON.stringify({ ...draft, requirements: 5 }))).toBeNull();
});
