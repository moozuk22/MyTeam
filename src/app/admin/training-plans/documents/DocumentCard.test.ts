import { expect, it } from "vitest";
import { deleteQuestion } from "./DocumentCard";

it("warns that a delete removes the plan from its trainings", () => {
  expect(deleteQuestion({ title: "Пресинг", usageCount: 0 })).toBe("Да изтрием ли „Пресинг“?");
  expect(deleteQuestion({ title: "Пресинг", usageCount: 1 }))
    .toBe("Да изтрием ли „Пресинг“? Използва се в 1 тренировка. Изтриването го премахва и от нея.");
  expect(deleteQuestion({ title: "Пресинг", usageCount: 4 }))
    .toBe("Да изтрием ли „Пресинг“? Използва се в 4 тренировки. Изтриването го премахва и от тях.");
});
