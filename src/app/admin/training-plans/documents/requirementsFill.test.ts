import { expect, it } from "vitest";
import { requirementsFill } from "./requirementsFill";

it("fills an empty section with the exercise requirements", () => {
  expect(requirementsFill("", "Пас с два допира.")).toBe("fill");
  expect(requirementsFill("  ", "Пас с два допира.")).toBe("fill");
});

it("keeps the section text when the exercise has no requirements or the same text", () => {
  expect(requirementsFill("Моят текст", "")).toBe("skip");
  expect(requirementsFill("", "  ")).toBe("skip");
  expect(requirementsFill("Пас с два допира. ", " Пас с два допира.")).toBe("skip");
});

it("asks before it replaces different text that the coach entered", () => {
  expect(requirementsFill("Моят текст", "Пас с два допира.")).toBe("ask");
});
