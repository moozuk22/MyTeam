import { expect, it } from "vitest";
import { isReportMonthActive } from "./paymentReportActivity";
import { buildYearlyPaymentReport } from "./yearlyPaymentReport";

const player = {
  isActive: false,
  reportActivity: [{ from: "2026-01", until: "2026-04" }],
  firstBillingMonth: "2026-01-01T00:00:00Z",
  paymentWorkflow: "calendar_month",
  paymentLogs: [{ paidFor: "2026-03-01T00:00:00Z", paidAt: "2026-03-05T12:00:00Z", amount: "30.00", currency: "EUR" }],
  paymentWaivers: [],
};
it("keeps March and excludes April after removal", () => {
  expect(isReportMonthActive(player, 2026, 2)).toBe(true);
  expect(isReportMonthActive(player, 2026, 3)).toBe(false);
  expect(buildYearlyPaymentReport(player, 2026, new Date("2026-05-15T12:00:00Z"))).toMatchObject({ dueCount: 3, paidDueCount: 1, missingCount: 2 });
});
it("includes the removal month only when chosen and preserves reactivation gaps", () => {
  const included = { ...player, reportActivity: [{ from: "2026-01", until: "2026-05" }, { from: "2026-07", until: null }] };
  expect(isReportMonthActive(included, 2026, 3)).toBe(true);
  expect(isReportMonthActive(included, 2026, 4)).toBe(false);
  expect(isReportMonthActive(included, 2026, 6)).toBe(true);
});
it("keeps only paid months when old inactive dates are unknown", () => {
  const legacy = { ...player, reportActivity: null };
  expect(isReportMonthActive(legacy, 2026, 2)).toBe(true);
  expect(isReportMonthActive(legacy, 2026, 3)).toBe(false);
  expect(buildYearlyPaymentReport(legacy, 2026, new Date("2026-05-15T12:00:00Z"))).toMatchObject({ dueCount: 1, missingCount: 0 });
});
it("retains an advance payment outside active months without charging an inactive month", () => {
  const advance = { ...player, paymentLogs: [...player.paymentLogs, { paidFor: "2026-04-01T00:00:00Z", paidAt: "2026-03-05T12:00:00Z", amount: "30.00", currency: "EUR" }] };
  const result = buildYearlyPaymentReport(advance, 2026, new Date("2026-05-15T12:00:00Z"));
  expect(result.months[3]).toMatchObject({ status: "paid", due: false });
  expect(result.totalAmountLabel).toBe("60.00 EUR");
});

it("uses Sofia month boundaries for yearly dues", () => {
  const active = { ...player, isActive: true, reportActivity: [{ from: "2026-01", until: null }] };
  const result = buildYearlyPaymentReport(active, 2026, new Date("2026-03-31T21:30:00Z"));
  expect(result.dueCount).toBe(4);
  expect(result.months[3]).toMatchObject({ due: true, status: "unpaid" });
});
