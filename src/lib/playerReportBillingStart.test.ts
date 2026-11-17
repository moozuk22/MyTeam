import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { PUT } from "@/app/api/admin/members/[id]/route";
import { isReportMonthActive } from "./paymentReportActivity";
import { buildYearlyPaymentReport } from "./yearlyPaymentReport";

const mocks = vi.hoisted(() => ({ find: vi.fn(), transaction: vi.fn() }));
vi.mock("@/lib/adminAuth", () => ({ verifyAdminToken: vi.fn(async () => ({ roles: ["admin"] })) }));
vi.mock("@/lib/memberEvents", () => ({ publishMemberUpdated: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: { player: { findUnique: mocks.find }, $transaction: mocks.transaction } }));
const clubId = "00000000-0000-4000-8000-000000000001";
const id = "00000000-0000-4000-8000-000000000002";
const migration = "prisma/migrations/20261117010000_report_billing_start_corrections/migration.sql";
const now = new Date("2026-12-15T12:00:00Z");
let db: PGlite;
type Period = { from: string; until: string | null; billingStart?: boolean };

beforeEach(async () => {
  vi.clearAllMocks();
  db = new PGlite();
  await db.exec(`
    CREATE TABLE _prisma_migrations(migration_name text, started_at timestamptz, rolled_back_at timestamptz);
    INSERT INTO _prisma_migrations VALUES ('20261116230000_player_report_history','2026-11-01T12:00:00Z',NULL);
    CREATE TABLE clubs(id uuid PRIMARY KEY, payment_workflow text DEFAULT 'calendar_month');
    CREATE TABLE players(id uuid PRIMARY KEY, club_id uuid REFERENCES clubs(id), full_name text,
      team_group int, is_active boolean DEFAULT true, first_billing_month timestamptz,
      created_at timestamptz DEFAULT '2026-09-10T12:00:00Z');
    CREATE TABLE payment_logs(id uuid DEFAULT gen_random_uuid(), player_id uuid REFERENCES players(id) ON DELETE CASCADE,
      paid_for timestamptz, paid_at timestamptz DEFAULT '2026-03-05T12:00:00Z', amount numeric, currency text DEFAULT 'EUR');
    CREATE TABLE payment_waivers(player_id uuid REFERENCES players(id) ON DELETE CASCADE, waived_for timestamptz);
    CREATE TABLE "_PlayerCoachGroups"("A" uuid,"B" uuid);
    CREATE TABLE club_custom_training_group_players(group_id uuid,player_id uuid);
    INSERT INTO clubs(id) VALUES ('${clubId}');
  `);
  await db.exec(readFileSync("prisma/migrations/20261116230000_player_report_history/migration.sql", "utf8"));
}, 20000);
afterEach(async () => { await db.close(); });

async function insert(active = true) {
  await db.query(`INSERT INTO players(id,club_id,full_name,is_active,first_billing_month)
    VALUES ($1,$2,'Състезател',$3,'2026-09-01')`, [id, clubId, active]);
}
async function report() {
  const row = (await db.query<{report_activity: Period[] | null; first_billing_month: Date; is_active: boolean}>(
    "SELECT report_activity, first_billing_month, is_active FROM players WHERE id=$1", [id])).rows[0];
  return {
    id, fullName: "Състезател", isActive: row.is_active, reportActivity: row.report_activity,
    firstBillingMonth: row.first_billing_month?.toISOString() ?? null, paymentWorkflow: "calendar_month",
    paymentLogs: (await db.query<{paidFor: string; paidAt: string; amount: string; currency: string}>(
      `SELECT paid_for::text AS "paidFor", paid_at::text AS "paidAt", amount::text AS amount, currency
       FROM payment_logs WHERE player_id=$1`, [id])).rows,
    paymentWaivers: [],
  };
}
async function setPeriods(periods: Period[]) {
  await db.query("UPDATE players SET report_activity=$1::jsonb WHERE id=$2", [JSON.stringify(periods), id]);
}
async function correct(value: string | null) {
  await db.query("UPDATE players SET first_billing_month=$1 WHERE id=$2", [value, id]);
}

it("updates reports through the member PUT workflow and retains the correction after deletion", async () => {
  await db.exec(readFileSync(migration, "utf8"));
  await insert();
  await db.query("INSERT INTO payment_logs(player_id,paid_for,amount) VALUES ($1,'2026-03-01',30)", [id]);
  const player = { id, clubId, images: [], coachGroups: [], paymentAmount: null,
    club: { billingStatus: "active", paymentWorkflow: "calendar_month", defaultPaymentAmount: null } };
  mocks.find.mockResolvedValue(player);
  mocks.transaction.mockImplementation(async (fn) => db.transaction(async (tx) => fn({
    $queryRaw: vi.fn(),
    player: {
      findUniqueOrThrow: async () => player,
      update: async ({ data }: { data: { firstBillingMonth: Date } }) => {
        await tx.query("UPDATE players SET first_billing_month=$1 WHERE id=$2", [data.firstBillingMonth, id]);
        return { ...player, cards: [], paymentLogs: [] };
      },
    },
  })));
  const response = await PUT(new NextRequest(`http://localhost/api/admin/members/${id}`, {
    method: "PUT", headers: { cookie: "admin_session=test", "content-type": "application/json" },
    body: JSON.stringify({ fullName: "Състезател", firstBillingMonth: "2026-01" }),
  }), { params: Promise.resolve({ id }) });
  expect(response.status).toBe(200);
  const live = await report();
  expect(isReportMonthActive(live, 2026, 0)).toBe(true);
  expect(isReportMonthActive(live, 2026, 2)).toBe(true);
  expect(buildYearlyPaymentReport(live, 2026, now)).toMatchObject({ dueCount: 12, paidDueCount: 1, totalAmountLabel: "30.00 EUR" });
  await db.query("DELETE FROM players WHERE id=$1", [id]);
  const archived = (await db.query<{report: typeof live}>("SELECT report FROM player_report_archives WHERE id=$1", [id])).rows[0].report;
  expect(archived.firstBillingMonth).toContain("2026-01");
  expect(isReportMonthActive(archived, 2026, 0)).toBe(true);
  expect(buildYearlyPaymentReport(archived, 2026, now).totalAmountLabel).toBe("30.00 EUR");
  expect(archived.reportActivity?.[0]).toMatchObject({ from: "2026-01", billingStart: true });
});

it("corrects the first period in both directions without changing inactive gaps", async () => {
  await db.exec(readFileSync(migration, "utf8"));
  await insert();
  await setPeriods([{ from: "2026-09", until: "2026-10", billingStart: true }, { from: "2026-12", until: null }]);
  await correct("2026-01-01");
  let player = await report();
  expect(player.reportActivity).toEqual([{ from: "2026-01", until: "2026-10", billingStart: true }, { from: "2026-12", until: null }]);
  expect(isReportMonthActive(player, 2026, 9)).toBe(false);
  expect(isReportMonthActive(player, 2026, 10)).toBe(false);
  expect(buildYearlyPaymentReport(player, 2026, now).dueCount).toBe(10);
  await correct("2026-11-01");
  player = await report();
  expect(player.reportActivity?.[0]).toEqual({ from: "2026-11", until: "2026-10", billingStart: true });
  expect(isReportMonthActive(player, 2026, 10)).toBe(false);
  expect(buildYearlyPaymentReport(player, 2026, now).dueCount).toBe(1);
  await correct("2026-01-01");
  expect(buildYearlyPaymentReport(await report(), 2026, now).dueCount).toBe(10);
});

it("updates an inactive player's known first period and keeps its removal boundary", async () => {
  await db.exec(readFileSync(migration, "utf8"));
  await insert();
  await db.query("UPDATE players SET is_active=false,report_include_removal_month=false WHERE id=$1", [id]);
  const before = (await report()).reportActivity!;
  await correct("2026-01-01");
  expect((await report()).reportActivity).toEqual([{ ...before[0], from: "2026-01" }]);
  await db.query("UPDATE players SET is_active=true WHERE id=$1", [id]);
  const restored = (await report()).reportActivity!;
  await correct("2026-02-01");
  expect((await report()).reportActivity).toEqual([{ ...restored[0], from: "2026-02" }, restored[1]]);
});

it("preserves an intervening inactive gap across earlier and later corrections", async () => {
  await db.exec(readFileSync(migration, "utf8"));
  await insert();
  await correct("2026-03-01");
  await setPeriods([{ from: "2026-03", until: "2026-04", billingStart: true }, { from: "2026-07", until: null }]);
  await correct("2026-01-01");
  const player = await report();
  expect(player.reportActivity).toEqual([{ from: "2026-01", until: "2026-04", billingStart: true }, { from: "2026-07", until: null }]);
  expect(buildYearlyPaymentReport(player, 2026, now).dueCount).toBe(9);
  for (const month of [3, 4, 5]) expect(isReportMonthActive(player, 2026, month)).toBe(false);
  await correct("2026-02-01");
  const later = await report();
  expect(isReportMonthActive(later, 2026, 0)).toBe(false);
  expect(buildYearlyPaymentReport(later, 2026, now).dueCount).toBe(8);
  expect(later.reportActivity?.[1]).toEqual({ from: "2026-07", until: null });
});

it("handles billing correction and status changes in one update", async () => {
  await db.exec(readFileSync(migration, "utf8"));
  await insert();
  await db.query("UPDATE players SET first_billing_month='2026-01-01',is_active=false WHERE id=$1", [id]);
  const removed = (await report()).reportActivity!;
  expect(removed[0]).toMatchObject({ from: "2026-01", until: expect.any(String) });
  await db.query("UPDATE players SET first_billing_month='2026-02-01',is_active=true WHERE id=$1", [id]);
  expect((await report()).reportActivity).toEqual([{ ...removed[0], from: "2026-02" }, { from: expect.any(String), until: null }]);
  await correct("2026-02-01");
  expect((await report()).reportActivity).toHaveLength(2);
});

it("does not mark an open current-month restoration as a billing-start period", async () => {
  await insert(false);
  await db.query("UPDATE players SET first_billing_month=date_trunc('month', CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Sofia') WHERE id=$1", [id]);
  await db.query("UPDATE players SET is_active=true WHERE id=$1", [id]);
  const before = (await report()).reportActivity;
  expect(before).toHaveLength(1);
  await db.exec(readFileSync("prisma/migrations/20261117010000_report_billing_start_corrections/migration.sql", "utf8"));
  expect((await report()).reportActivity).toEqual(before);
  await correct("2026-01-01");
  expect(isReportMonthActive(await report(), 2026, 0)).toBe(false);
});

it("repairs prior billing-start corrections without changing their inactive gaps", async () => {
  await insert();
  await correct("2026-01-01");
  await db.query("UPDATE players SET report_activity=$1::jsonb", [JSON.stringify([
    { from: "2026-09", until: "2026-10" }, { from: "2026-12", until: null },
  ])]);
  await db.exec(readFileSync("prisma/migrations/20261117010000_report_billing_start_corrections/migration.sql", "utf8"));
  let player = await report();
  expect(player.reportActivity).toEqual([
    { from: "2026-01", until: "2026-10", billingStart: true }, { from: "2026-12", until: null },
  ]);
  await correct("2026-02-01");
  player = await report();
  expect(player.reportActivity).toEqual([
    { from: "2026-02", until: "2026-10", billingStart: true }, { from: "2026-12", until: null },
  ]);
});

it.each([false, true])("does not infer dues for legacy history after correction, restored=%s", async (restored) => {
  await insert(false);
  await db.query("INSERT INTO payment_logs(player_id,paid_for,amount) VALUES ($1,'2026-09-01',30)", [id]);
  await db.exec(readFileSync(migration, "utf8"));
  if (restored) await db.query("UPDATE players SET is_active=true WHERE id=$1", [id]);
  const periods = (await report()).reportActivity;
  await db.exec(readFileSync("prisma/migrations/20261117010000_report_billing_start_corrections/migration.sql", "utf8"));
  await correct("2026-01-01");
  const player = await report();
  expect(player.reportActivity).toEqual(periods);
  expect(isReportMonthActive(player, 2026, 0)).toBe(false);
  expect(isReportMonthActive(player, 2026, 8)).toBe(true);
});

it("supports existing active players when the follow-up migration is applied", async () => {
  await insert();
  await db.exec(readFileSync(migration, "utf8"));
  await db.exec(readFileSync("prisma/migrations/20261117010000_report_billing_start_corrections/migration.sql", "utf8"));
  await correct("2026-01-01");
  expect(isReportMonthActive(await report(), 2026, 0)).toBe(true);
});

it("leaves ambiguous paid-only periods from the earlier trigger unchanged", async () => {
  await insert(false);
  await db.query("INSERT INTO payment_logs(player_id,paid_for,amount) VALUES ($1,'2026-09-01',30)", [id]);
  await db.query("UPDATE players SET is_active=true WHERE id=$1", [id]);
  const before = (await report()).reportActivity;
  await db.exec(readFileSync("prisma/migrations/20261117010000_report_billing_start_corrections/migration.sql", "utf8"));
  await correct("2026-01-01");
  expect((await report()).reportActivity).toEqual(before);
  expect(isReportMonthActive(await report(), 2026, 0)).toBe(false);
});

it("uses the creation month when billing start is cleared and reverses the correction", async () => {
  await db.exec(readFileSync(migration, "utf8"));
  await insert();
  await correct("2026-01-01");
  await correct(null);
  expect((await report()).reportActivity?.[0].from).toBe("2026-09");
  await correct("2026-01-01");
  expect((await report()).reportActivity?.[0].from).toBe("2026-01");
});
