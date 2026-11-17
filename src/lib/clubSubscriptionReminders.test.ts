import { describe, expect, it } from "vitest";
import { subscriptionReminders } from "./clubSubscriptionReminders";
import type { SubscriptionSnapshot } from "./clubSubscriptionDomain";
const trial = (end: string | null): SubscriptionSnapshot => ({ mode: "trial", trialEndDate: end, firstBillingMonth: null, fees: [], payments: [] });
describe("subscription reminder policy", () => {
  it("skips unlimited trials and trials outside the reminder window", () => {
    expect(subscriptionReminders(trial(null), "2026-10-24")).toEqual([]);
    expect(subscriptionReminders(trial("2026-11-01"), "2026-10-24")).toEqual([]);
  });
  it("uses stable keys for 7-day, 1-day and expired windows, with inclusive end dates", () => {
    expect(subscriptionReminders(trial("2026-10-31"), "2026-10-24")[0].key).toBe("trial:2026-10-31:7");
    expect(subscriptionReminders(trial("2026-10-31"), "2026-10-29")[0].key).toBe("trial:2026-10-31:7");
    expect(subscriptionReminders(trial("2026-10-31"), "2026-10-30")[0].key).toBe("trial:2026-10-31:1");
    expect(subscriptionReminders(trial("2026-10-31"), "2026-10-31")[0].key).toBe("trial:2026-10-31:1");
    expect(subscriptionReminders(trial("2026-10-31"), "2026-11-01")[0].key).toBe("trial:2026-10-31:expired");
  });
  it("starts a new reminder cycle after a trial is extended", () => {
    expect(subscriptionReminders(trial("2026-11-07"), "2026-11-01")[0].key).toBe("trial:2026-11-07:7");
  });
  it("marks only past unpaid calendar months overdue, preserves gaps and excludes active payments", () => {
    const subscription: SubscriptionSnapshot = { ...trial(null), mode: "paid", firstBillingMonth: "2026-12", fees: [{ effectiveMonth: "2026-12", amount: "10.00" }], payments: [{
      id: "p", paidOn: "2026-12-01", createdAt: "2026-12-01", createdBy: "admin", total: "10", note: null, voidedAt: null, voidedBy: null, months: [{ month: "2027-01", amount: "10.00" }],
    }] };
    expect(subscriptionReminders(subscription, "2026-12-31")).toEqual([]);
    expect(subscriptionReminders(subscription, "2027-02-01").map((r) => r.key)).toEqual(["overdue:2026-12"]);
    subscription.payments[0].voidedAt = "2027-02-01";
    expect(subscriptionReminders(subscription, "2027-02-01").map((r) => r.key)).toEqual(["overdue:2026-12", "overdue:2027-01"]);
  });
});

it("never reminds contract clubs even with historical trial dates and unpaid fees", () => {
  expect(subscriptionReminders({ ...trial("2026-10-24"), mode: "contract", firstBillingMonth: "2026-01", fees: [{ effectiveMonth: "2026-01", amount: "10.00" }] }, "2026-10-24")).toEqual([]);
});

const paid = (months = ["2026-10"]): SubscriptionSnapshot => ({
  mode: "paid", trialEndDate: null, firstBillingMonth: "2026-10",
  fees: [{ effectiveMonth: "2026-10", amount: "10.00" }],
  payments: [{ id: "p", paidOn: "2026-10-01", createdAt: "2026-10-01", createdBy: "admin",
    total: "10.00", note: null, voidedAt: null, voidedBy: null,
    months: months.map((month) => ({ month, amount: "10.00" })) }],
});
const keys = (subscription: SubscriptionSnapshot, today: string) => subscriptionReminders(subscription, today).map((r) => r.key);

describe("paid coverage reminders", () => {
  it.each([
    ["2026-10-23", []],
    ["2026-10-24", ["paid:2026-10-31:7"]],
    ["2026-10-29", ["paid:2026-10-31:7"]],
    ["2026-10-30", ["paid:2026-10-31:1"]],
    ["2026-10-31", ["paid:2026-10-31:1"]],
    ["2026-11-01", ["paid:2026-10-31:expired"]],
    ["2026-11-17", ["paid:2026-10-31:expired"]],
    ["2026-12-01", ["paid:2026-10-31:expired", "overdue:2026-11"]],
  ])("uses the current window on %s", (today, expected) => {
    expect(keys(paid(), today)).toEqual(expected);
  });

  it("moves the reminder cycle when coverage is renewed", () => {
    const renewed = paid(["2026-10", "2026-11"]);
    expect(keys(renewed, "2026-10-30")).toEqual([]);
    expect(keys(renewed, "2026-11-01")).toEqual([]);
    expect(keys(renewed, "2026-11-23")).toEqual(["paid:2026-11-30:7"]);
    expect(keys(renewed, "2026-12-01")).toEqual(["paid:2026-11-30:expired"]);
  });

  it("does not extend coverage across unpaid gaps", () => {
    expect(keys(paid(["2026-10", "2026-12"]), "2026-11-01")).toEqual(["paid:2026-10-31:expired"]);
  });

  it("keeps unpaid subscriptions on the overdue schedule without inventing paid coverage", () => {
    expect(keys(paid([]), "2026-10-30")).toEqual([]);
    expect(keys(paid([]), "2026-11-01")).toEqual(["overdue:2026-10"]);
    const voided = paid();
    voided.payments[0].voidedAt = "2026-10-29";
    expect(keys(voided, "2026-10-30")).toEqual([]);
    voided.payments.push({ ...paid().payments[0], id: "replacement" });
    expect(keys(voided, "2026-10-30")).toEqual(["paid:2026-10-31:1"]);
  });

  it("does not warn before the first billing month", () => {
    expect(keys(paid(), "2026-09-30")).toEqual([]);
  });

  it.each([ ["2027-12", "2027-12-24", "2027-12-31"], ["2028-02", "2028-02-22", "2028-02-29"] ])(
    "uses the calendar month end for %s", (month, today, end) => {
      const subscription = paid([month]);
      subscription.firstBillingMonth = month;
      subscription.fees[0].effectiveMonth = month;
      expect(keys(subscription, today)).toEqual([`paid:${end}:7`]);
    },
  );
});
