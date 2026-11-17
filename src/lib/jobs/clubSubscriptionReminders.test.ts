import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { runClubSubscriptionReminders } from "./clubSubscriptionReminders";
const mocks = vi.hoisted(() => ({
  $transaction: vi.fn(), $queryRaw: vi.fn(), club: { findMany: vi.fn(), findUnique: vi.fn() },
  clubSubscription: { findUnique: vi.fn() }, clubSubscriptionReminder: { createMany: vi.fn() },
  adminNotification: { create: vi.fn() }, push: vi.fn(), events: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ prisma: mocks }));
vi.mock("@/lib/push/adminService", () => ({ sendPushToClubAdmins: mocks.push }));
vi.mock("@/lib/adminNotificationEvents", () => ({ publishAdminNotificationCreated: mocks.events }));
let reminders: { key: string }[];
const clubId = "00000000-0000-0000-0000-000000000001";
beforeEach(() => {
  vi.resetAllMocks(); reminders = [];
  mocks.club.findMany.mockResolvedValue([{ id: clubId }]);
  mocks.club.findUnique.mockResolvedValue({ billingStatus: "active" });
  mocks.$transaction.mockImplementation(async (fn) => fn(mocks));
  mocks.clubSubscription.findUnique.mockImplementation(async () => ({ mode: "trial", trialEndDate: "2026-10-31", firstBillingMonth: null, fees: [], payments: [], reminders }));
  mocks.clubSubscriptionReminder.createMany.mockImplementation(async ({ data }) => { reminders.push(...data); return { count: data.length }; });
  mocks.push.mockResolvedValue({ total: 0, sent: 0, failed: 0 });
});
describe("persisted subscription reminders", () => {
  it("stores reminders without devices and suppresses duplicate runs", async () => {
    const now = new Date("2026-10-24T10:00:00Z");
    expect(await runClubSubscriptionReminders(now)).toMatchObject({ success: true, reminders: 1 });
    expect(await runClubSubscriptionReminders(now)).toMatchObject({ success: true, reminders: 0 });
    expect(reminders).toHaveLength(1);
    expect(mocks.adminNotification.create).toHaveBeenCalledExactlyOnceWith({ data: expect.objectContaining({ clubId, type: "myteam_message", coachGroupId: null }) });
    expect(mocks.push).toHaveBeenCalledExactlyOnceWith(clubId, expect.objectContaining({ title: "Пробният период за MyTeam изтича" }), null);
    expect(mocks.events).toHaveBeenCalledTimes(1);
  });
  it("never sends before commit, and sends nothing if the transaction fails", async () => {
    mocks.$transaction.mockImplementation(async (fn) => {
      await fn(mocks);
      expect(mocks.push).not.toHaveBeenCalled(); expect(mocks.events).not.toHaveBeenCalled();
      throw new Error("commit failed");
    });
    expect(await runClubSubscriptionReminders(new Date("2026-10-24T10:00:00Z"))).toMatchObject({ success: false, failedClubs: [clubId] });
    expect(mocks.push).not.toHaveBeenCalled();
  });
  it("rechecks activation while holding the lock", async () => {
    mocks.club.findUnique.mockResolvedValue({ billingStatus: "demo" });
    expect(await runClubSubscriptionReminders(new Date("2026-10-24"))).toMatchObject({ reminders: 0 });
    expect(mocks.clubSubscription.findUnique).not.toHaveBeenCalled();
  });
  it("groups old overdue months into one message and persists every month key", async () => {
    mocks.clubSubscription.findUnique.mockImplementation(async () => ({ mode: "paid", trialEndDate: null, firstBillingMonth: "2026-08", fees: [{ effectiveMonth: "2026-08", amount: new Prisma.Decimal(10) }], payments: [], reminders }));
    expect(await runClubSubscriptionReminders(new Date("2026-10-24T10:00:00Z"))).toMatchObject({ reminders: 2, notifiedClubs: 1 });
    expect(reminders.map((r) => r.key)).toEqual(["overdue:2026-08", "overdue:2026-09"]);
    expect(mocks.adminNotification.create.mock.calls[0][0].data.body).toContain("2026-08");
    expect(mocks.adminNotification.create.mock.calls[0][0].data.body).toContain("2026-09");
    expect(mocks.adminNotification.create.mock.calls[0][0].data.body).not.toContain("2026-10");
  });
  it("retains the inbox and reminder ledger when push fails", async () => {
    mocks.push.mockRejectedValue(new Error("push failed"));
    expect(await runClubSubscriptionReminders(new Date("2026-10-24T10:00:00Z"))).toMatchObject({ reminders: 1, pushWarnings: 1 });
    expect(await runClubSubscriptionReminders(new Date("2026-10-24T10:00:00Z"))).toMatchObject({ reminders: 0 });
  });
});

function storedPaid(months = ["2026-10"]) {
  return { mode: "paid", trialEndDate: null, firstBillingMonth: "2026-10",
    fees: [{ effectiveMonth: "2026-10", amount: new Prisma.Decimal(10) }], reminders,
    payments: [{ id: "paid", total: new Prisma.Decimal(10), createdAt: new Date("2026-10-01"), voidedAt: null,
      months: months.map((month) => ({ month, amount: new Prisma.Decimal(10) })) }],
  };
}

describe("paid reminder delivery", () => {
  it("saves each stage once and uses Sofia midnight for expiry", async () => {
    mocks.clubSubscription.findUnique.mockImplementation(async () => storedPaid());
    for (const instant of ["2026-10-24T10:00:00Z", "2026-10-30T10:00:00Z", "2026-10-31T22:00:00Z"]) {
      expect(await runClubSubscriptionReminders(new Date(instant))).toMatchObject({ success: true, reminders: 1 });
      expect(await runClubSubscriptionReminders(new Date(instant))).toMatchObject({ reminders: 0 });
    }
    expect(reminders.map((r) => r.key)).toEqual(["paid:2026-10-31:7", "paid:2026-10-31:1", "paid:2026-10-31:expired"]);
    expect(mocks.adminNotification.create).toHaveBeenCalledTimes(3);
    expect(mocks.push).toHaveBeenLastCalledWith(clubId, expect.objectContaining({ title: "Платеният период за MyTeam изтече" }), null);
  });

  it("reads a renewal after acquiring the club lock", async () => {
    let months = ["2026-10"];
    mocks.$queryRaw.mockImplementation(async () => { months = ["2026-10", "2026-11"]; });
    mocks.clubSubscription.findUnique.mockImplementation(async () => storedPaid(months));
    expect(await runClubSubscriptionReminders(new Date("2026-11-01T10:00:00Z"))).toMatchObject({ reminders: 0 });
    expect(mocks.adminNotification.create).not.toHaveBeenCalled();
  });

  it("does not duplicate a paid stage when workers acquire the lock in sequence", async () => {
    let tail = Promise.resolve();
    mocks.$transaction.mockImplementation((fn) => {
      const result = tail.then(() => fn(mocks));
      tail = result.then(() => undefined);
      return result;
    });
    mocks.clubSubscription.findUnique.mockImplementation(async () => storedPaid());
    const results = await Promise.all([
      runClubSubscriptionReminders(new Date("2026-10-24T10:00:00Z")),
      runClubSubscriptionReminders(new Date("2026-10-24T10:00:00Z")),
    ]);
    expect(results.map((r) => r.reminders).sort()).toEqual([0, 1]);
    expect(mocks.adminNotification.create).toHaveBeenCalledTimes(1);
    expect(mocks.push).toHaveBeenCalledTimes(1);
  });

  it("retains a paid reminder after push failure and does not resend it", async () => {
    mocks.clubSubscription.findUnique.mockImplementation(async () => storedPaid());
    mocks.push.mockRejectedValue(new Error("push failed"));
    const now = new Date("2026-11-01T10:00:00Z");
    expect(await runClubSubscriptionReminders(now)).toMatchObject({ reminders: 1, pushWarnings: 1 });
    expect(await runClubSubscriptionReminders(now)).toMatchObject({ reminders: 0 });
    expect(mocks.adminNotification.create).toHaveBeenCalledTimes(1);
  });
});
