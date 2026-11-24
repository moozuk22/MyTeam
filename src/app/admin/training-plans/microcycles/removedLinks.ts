const linkCount = (count: number) => count === 1 ? "1 връзка" : `${count} връзки`;
const removal = (count: number) => count === 1 ? "връзката ще бъде премахната" : "връзките ще бъдат премахнати";

/** The question before a save removes the plan links of deleted trainings. The server gives the number of links. */
export function removedLinksQuestion(count: number) {
  return `Изтритите тренировки имат ${linkCount(count)} към план-конспекти. При запис ${removal(count)}. План-конспектите остават в библиотеката.`;
}

/** The question before a delete of the microcycle removes the plan links of the group. The server gives the number of links. */
export function deletedCycleLinksQuestion(count: number) {
  return `Тренировките на микроцикъла имат ${linkCount(count)} към план-конспекти. При изтриване ${removal(count)}. План-конспектите остават в библиотеката.`;
}

/** The question before a save that also replaces the microcycle of other groups. The number includes the links of both. */
export function replacedLinksQuestion(count: number) {
  return `Записът премахва ${linkCount(count)} към план-конспекти на изтрити тренировки или на заменени микроцикли. План-конспектите остават в библиотеката.`;
}
