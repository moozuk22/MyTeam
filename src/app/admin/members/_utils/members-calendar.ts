import { getTodayIsoDate } from "./members-page-utils";

export function getMonthKeyFromIsoDate(date: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date.slice(0, 7) : getTodayIsoDate().slice(0, 7);
}

export function addMonthsToMonthKey(monthKey: string, delta: number) {
  const [year, month] = monthKey.split("-").map((value) => Number.parseInt(value, 10));
  const base = new Date(
    Date.UTC(Number.isInteger(year) ? year : 1970, Number.isInteger(month) ? month - 1 : 0, 1),
  );
  base.setUTCMonth(base.getUTCMonth() + delta);
  return `${base.getUTCFullYear()}-${String(base.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function getCalendarDatesForMonth(monthKey: string) {
  const [year, month] = monthKey.split("-").map((value) => Number.parseInt(value, 10));
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return [];
  }
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return Array.from(
    { length: daysInMonth },
    (_, index) => `${year}-${String(month).padStart(2, "0")}-${String(index + 1).padStart(2, "0")}`,
  );
}
