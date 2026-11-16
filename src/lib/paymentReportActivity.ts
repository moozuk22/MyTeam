export type ReportActivityInput = {
  isActive?: boolean;
  reportActivity?: unknown;
  paymentLogs: Array<{ paidFor: string }>;
};

// Month indices are zero-based. Period ends are exclusive.
export function isReportMonthActive(player: ReportActivityInput, year: number, month: number): boolean {
  const key = `${year}-${String(month + 1).padStart(2, "0")}`;
  if (Array.isArray(player.reportActivity)) {
    return player.reportActivity.some((period: unknown) => {
      if (!period || typeof period !== "object") return false;
      const { from, until } = period as { from?: unknown; until?: unknown };
      return typeof from === "string" && from <= key && (until === null || (typeof until === "string" && key < until));
    });
  }
  // Old inactive players have no status dates. Only a payment establishes a month.
  return player.isActive !== false || hasPayment(player, year, month);
}

function hasPayment(player: ReportActivityInput, year: number, month: number) {
  return player.paymentLogs.some(({ paidFor }) => {
    const date = new Date(paidFor);
    return date.getUTCFullYear() === year && date.getUTCMonth() === month;
  });
}
