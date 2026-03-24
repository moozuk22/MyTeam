export type YearMonth = {
  year: number;
  month: number;
};

export function toYearMonth(date: Date): YearMonth {
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() };
}

export function addMonths(ym: YearMonth, count: number): YearMonth {
  const d = new Date(Date.UTC(ym.year, ym.month + count, 1, 0, 0, 0, 0));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() };
}

export function compareYearMonth(a: YearMonth, b: YearMonth): number {
  if (a.year !== b.year) {
    return a.year - b.year;
  }
  return a.month - b.month;
}

export function toMonthKey(ym: YearMonth): string {
  return `${ym.year}-${ym.month}`;
}

export function normalizeToMonthStart(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 0, 0, 0, 0));
}

export function isCurrentMonthWaived(waivedDates: Date[], now = new Date()): boolean {
  const current = toMonthKey(toYearMonth(now));
  return waivedDates.some((date) => toMonthKey(toYearMonth(date)) === current);
}

export function resolveStatusFromSettledMonths(input: {
  paidDates: Date[];
  waivedDates: Date[];
  now?: Date;
}): "paid" | "warning" | "overdue" {
  const now = input.now ?? new Date();
  const currentYM = toYearMonth(now);
  const previousYM = addMonths(currentYM, -1);
  const settled = new Set<string>([
    ...input.paidDates.map((date) => toMonthKey(toYearMonth(date))),
    ...input.waivedDates.map((date) => toMonthKey(toYearMonth(date))),
  ]);

  if (settled.has(toMonthKey(currentYM))) {
    return "paid";
  }
  if (settled.has(toMonthKey(previousYM))) {
    return "warning";
  }
  return "overdue";
}
