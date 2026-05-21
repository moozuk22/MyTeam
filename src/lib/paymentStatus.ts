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

export function normalizeToDayStart(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0));
}

export function isCurrentMonthWaived(waivedDates: Date[], now = new Date()): boolean {
  const current = toMonthKey(toYearMonth(now));
  return waivedDates.some((date) => toMonthKey(toYearMonth(date)) === current);
}

export function resolveRollingThirtyDayStatus(input: {
  paidDates: Date[];
  firstBillingDate?: Date | null;
  now?: Date;
}): "paid" | "overdue" {
  const now = input.now ?? new Date();
  const validPaidDates = input.paidDates
    .filter((date) => !Number.isNaN(date.getTime()))
    .sort((a, b) => b.getTime() - a.getTime());

  if (validPaidDates.length > 0) {
    const latestPaidStart = validPaidDates[0];
    const paidUntil = new Date(latestPaidStart.getTime() + 30 * 24 * 60 * 60 * 1000);

    if (now < paidUntil) return "paid";
    return "overdue";
  }

  const firstBillingDate = input.firstBillingDate;
  if (!firstBillingDate) return "paid";
  if (now < firstBillingDate) return "paid";
  return "overdue";
}

export function getRollingThirtyDayPaymentWindow(input: {
  paidDates: Date[];
  now?: Date;
}): { latestPaidStart: Date; paidUntil: Date; remainingDays: number } | null {
  const now = input.now ?? new Date();
  const latestPaidStart = input.paidDates
    .filter((date) => !Number.isNaN(date.getTime()))
    .sort((a, b) => b.getTime() - a.getTime())[0];

  if (!latestPaidStart) return null;

  const paidUntil = new Date(latestPaidStart.getTime() + 30 * 24 * 60 * 60 * 1000);
  const remainingMs = paidUntil.getTime() - now.getTime();
  const remainingDays = remainingMs > 0 ? Math.ceil(remainingMs / (24 * 60 * 60 * 1000)) : 0;

  return {
    latestPaidStart,
    paidUntil,
    remainingDays,
  };
}

export function resolvePaymentStatus(input: {
  workflow?: "calendar_month" | "rolling_30_days" | "training_credits" | "training_credits_30_days" | string | null;
  paidDates: Date[];
  waivedDates: Date[];
  remainingTrainingCredits?: number | null;
  firstBillingMonth?: YearMonth | null;
  firstBillingDate?: Date | null;
  now?: Date;
}): "paid" | "warning" | "overdue" {
  if (input.workflow === "training_credits") {
    return (input.remainingTrainingCredits ?? 0) > 0 ? "paid" : "overdue";
  }

  if (input.workflow === "training_credits_30_days") {
    if ((input.remainingTrainingCredits ?? 0) <= 0) return "overdue";
    const activeWindow = getRollingThirtyDayPaymentWindow({
      paidDates: input.paidDates,
      now: input.now,
    });
    return activeWindow && activeWindow.remainingDays > 0 ? "paid" : "overdue";
  }

  if (input.workflow === "rolling_30_days") {
    return resolveRollingThirtyDayStatus({
      paidDates: input.paidDates,
      firstBillingDate: input.firstBillingDate,
      now: input.now,
    });
  }

  return resolveStatusFromSettledMonths({
    paidDates: input.paidDates,
    waivedDates: input.waivedDates,
    firstBillingMonth: input.firstBillingMonth,
    now: input.now,
  });
}

export function resolveStatusFromSettledMonths(input: {
  paidDates: Date[];
  waivedDates: Date[];
  firstBillingMonth?: YearMonth | null;
  now?: Date;
}): "paid" | "warning" | "overdue" {
  const now = input.now ?? new Date();
  const currentYM = toYearMonth(now);
  const previousYM = addMonths(currentYM, -1);
  const settled = new Set<string>([
    ...input.paidDates.map((date) => toMonthKey(toYearMonth(date))),
    ...input.waivedDates.map((date) => toMonthKey(toYearMonth(date))),
  ]);

  const { firstBillingMonth } = input;

  if (firstBillingMonth !== undefined) {
    if (firstBillingMonth === null) return "paid";
    if (compareYearMonth(currentYM, firstBillingMonth) < 0) return "paid";
    if (settled.has(toMonthKey(currentYM))) return "paid";
    if (compareYearMonth(currentYM, firstBillingMonth) === 0) return "warning";
    if (settled.has(toMonthKey(previousYM))) return "warning";
    if (compareYearMonth(previousYM, firstBillingMonth) < 0) return "warning";
    return "overdue";
  }

  if (settled.has(toMonthKey(currentYM))) {
    return "paid";
  }
  if (settled.has(toMonthKey(previousYM))) {
    return "warning";
  }
  return "overdue";
}

export function getFirstUnpaidYM(
  paymentLogs: Date[],
  waivers: Date[],
  firstBillingMonth: YearMonth | null,
): YearMonth | null {
  if (firstBillingMonth === null) return null;

  const settledSet = new Set<string>([
    ...paymentLogs.map((d) => toMonthKey(toYearMonth(d))),
    ...waivers.map((d) => toMonthKey(toYearMonth(d))),
  ]);

  if (paymentLogs.length === 0) return firstBillingMonth;

  const sorted = [...paymentLogs].sort((a, b) => a.getTime() - b.getTime());
  const lastPaid = toYearMonth(sorted[sorted.length - 1]);
  let cursor = addMonths(lastPaid, 1);

  while (settledSet.has(toMonthKey(cursor))) {
    cursor = addMonths(cursor, 1);
  }

  if (compareYearMonth(cursor, firstBillingMonth) < 0) {
    return firstBillingMonth;
  }

  return cursor;
}
