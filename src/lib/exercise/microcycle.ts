export const cycleColumns = ["Загрявка", "Фаза №1", "Фаза №2", "Фаза №3", "Физическа подготовка"];
export type CycleContent = { format: string; age: string; season: string; half: string; number: string; saturday: string; sunday: string; rows: string[][] };
export const emptyCycle = (): CycleContent => ({ format: "", age: "", season: "", half: "", number: "", saturday: "", sunday: "", rows: [] });
export function monday(date: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Невалидна дата.");
  const d = new Date(`${date}T00:00:00Z`);
  if (!Number.isFinite(d.getTime()) || d.toISOString().slice(0, 10) !== date) throw new Error("Невалидна дата.");
  d.setUTCDate(d.getUTCDate() - (d.getUTCDay() + 6) % 7);
  return d.toISOString().slice(0, 10);
}
export function shiftWeek(week: string, days: number) { const d = new Date(`${week}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); }
export function parseCycle(raw: unknown): CycleContent {
  if (!raw || typeof raw !== "object") throw new Error("Невалиден микроцикъл.");
  const value = raw as Record<string, unknown>;
  const result = emptyCycle();
  for (const key of ["format", "age", "season", "half", "number", "saturday", "sunday"] as const) {
    if (typeof value[key] !== "string" || value[key].length > 2000) throw new Error("Текстът е твърде дълъг или невалиден.");
    result[key] = value[key];
  }
  if (!Array.isArray(value.rows) || value.rows.length > 30 || value.rows.some(row => !Array.isArray(row) || row.length !== 5 || row.some(cell => typeof cell !== "string" || cell.length > 4000))) throw new Error("Невалидни тренировки (до 30 реда).");
  result.rows = value.rows as string[][];
  return result;
}
const weekDay = new Intl.DateTimeFormat("bg-BG", { day: "numeric", month: "long", timeZone: "UTC" });
const weekDayYear = new Intl.DateTimeFormat("bg-BG", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
/** Formats a Monday week key as a readable Bulgarian Monday–Sunday range. */
export function formatWeekRange(week: string) {
  const start = new Date(`${week}T00:00:00Z`);
  const end = new Date(`${shiftWeek(week, 6)}T00:00:00Z`);
  const sameMonth = start.getUTCMonth() === end.getUTCMonth();
  const sameYear = start.getUTCFullYear() === end.getUTCFullYear();
  const from = sameMonth ? String(start.getUTCDate()) : sameYear ? weekDay.format(start) : weekDayYear.format(start);
  return `${from} – ${weekDayYear.format(end).replace(/\s*г\.$/, "")} г.`;
}
/** Formats a Monday week key as "09.11.2026 г. – 15.11.2026 г." for the printed sheet. */
export function formatWeekDates(week: string) {
  const dots = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)} г.`;
  return `${dots(week)} – ${dots(shiftWeek(week, 6))}`;
}
