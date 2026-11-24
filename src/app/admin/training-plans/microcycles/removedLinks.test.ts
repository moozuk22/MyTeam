import { expect, it } from "vitest";
import { deletedCycleLinksQuestion, removedLinksQuestion, replacedLinksQuestion } from "./removedLinks";

it("gives the number of plan links that the deleted trainings lose", () => {
  expect(removedLinksQuestion(1)).toBe("Изтритите тренировки имат 1 връзка към план-конспекти. При запис връзката ще бъде премахната. План-конспектите остават в библиотеката.");
  expect(removedLinksQuestion(3)).toBe("Изтритите тренировки имат 3 връзки към план-конспекти. При запис връзките ще бъдат премахнати. План-конспектите остават в библиотеката.");
});

it("gives the number of plan links that a deleted microcycle removes", () => {
  expect(deletedCycleLinksQuestion(1)).toBe("Тренировките на микроцикъла имат 1 връзка към план-конспекти. При изтриване връзката ще бъде премахната. План-конспектите остават в библиотеката.");
  expect(deletedCycleLinksQuestion(5)).toBe("Тренировките на микроцикъла имат 5 връзки към план-конспекти. При изтриване връзките ще бъдат премахнати. План-конспектите остават в библиотеката.");
});

it("gives the number of plan links that a save with replaced microcycles removes", () => {
  expect(replacedLinksQuestion(1)).toBe("Записът премахва 1 връзка към план-конспекти на изтрити тренировки или на заменени микроцикли. План-конспектите остават в библиотеката.");
  expect(replacedLinksQuestion(4)).toBe("Записът премахва 4 връзки към план-конспекти на изтрити тренировки или на заменени микроцикли. План-конспектите остават в библиотеката.");
});
