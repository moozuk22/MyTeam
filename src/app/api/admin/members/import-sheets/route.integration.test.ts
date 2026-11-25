import { readFileSync } from "node:fs";
import { PGlite, type Transaction } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";

// Runs the real import route against PGlite with the production attendance
// triggers, so group links created by the import go through the same
// membership and roster logic as manual group changes.

const mocks = vi.hoisted(() => ({
  $transaction: vi.fn(),
  clubCustomTrainingGroup: { count: vi.fn() },
  club: { findUnique: vi.fn() },
  coachGroup: { findFirst: vi.fn() },
  failMembershipUpdate: { value: false },
}));
vi.mock("@/lib/db", () => ({ prisma: mocks }));
vi.mock("@/lib/adminAuth", () => ({ verifyAdminToken: vi.fn().mockResolvedValue({ sub: "admin", roles: ["admin"] }) }));
vi.mock("@/lib/googleAuth", () => ({ getGoogleServiceAccountToken: vi.fn().mockResolvedValue("token") }));

const clubId = "00000000-0000-4000-8000-000000000001";
const groupId = "00000000-0000-4000-8000-000000000002";
const scopeKey = `custom_group:${groupId}`;
const db = new PGlite();

type CreateArgs = {
  data: {
    clubId: string;
    fullName: string;
    attendanceStartedAt: Date | null;
    teamGroup?: number;
    customTrainingGroups?: { create: Array<{ groupId: string }> };
  };
};

function prismaTx(tx: Transaction) {
  return {
    player: {
      // Prisma writes the parent row first, then the nested relation rows.
      create: async ({ data }: CreateArgs) => {
        const player = await tx.query<{ id: string }>(
          `INSERT INTO players(id,club_id,full_name,team_group,is_active,attendance_started_at)
           VALUES (gen_random_uuid(),$1,$2,$3,true,$4) RETURNING id`,
          [data.clubId, data.fullName, data.teamGroup ?? null, data.attendanceStartedAt],
        );
        const playerId = player.rows[0].id;
        for (const link of data.customTrainingGroups?.create ?? []) {
          await tx.query("INSERT INTO club_custom_training_group_players(group_id,player_id) VALUES ($1,$2)", [link.groupId, playerId]);
        }
        return { id: playerId };
      },
    },
    attendanceMembership: {
      updateMany: async ({ where, data }: { where: { playerId: string; leftAt: null }; data: { joinedAt: Date } }) => {
        if (mocks.failMembershipUpdate.value) throw new Error("Injected failure after the group link");
        const result = await tx.query("UPDATE attendance_memberships SET joined_at=$1 WHERE player_id=$2 AND left_at IS NULL", [data.joinedAt, where.playerId]);
        return { count: result.affectedRows ?? 0 };
      },
    },
  };
}

function sofiaDate(offsetDays: number) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Sofia", day: "2-digit", month: "2-digit", year: "numeric" })
    .formatToParts(new Date(Date.now() + offsetDays * 86400000));
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return { sheet: `${get("day")}.${get("month")}.${get("year")}`, iso: `${get("year")}-${get("month")}-${get("day")}` };
}

async function importRows(rows: string[][], assignGroup = true) {
  const values = [["Име, фамилия", "Роден", "№", "Начална дата на участие"], ...rows];
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ values }), { status: 200 })));
  const preview = rows.map((row, i) => ({ row, rowIndex: i + 2 }));
  const startIso = async (raw: string) => {
    if (!raw) return null;
    const { parseAttendanceStartDate } = await import("@/lib/attendanceStartDate");
    return parseAttendanceStartDate(raw)?.toISOString() ?? null;
  };
  const groupAssignments = assignGroup
    ? await Promise.all(preview.map(async ({ row, rowIndex }) => ({
        rowIndex, fullName: row[0], birthDateIso: null, jerseyNumber: null,
        attendanceStartedAtIso: await startIso(row[3]), groupIds: [groupId],
      })))
    : undefined;
  return POST(new NextRequest("http://localhost/api/admin/members/import-sheets", {
    method: "POST",
    headers: { cookie: "admin_session=test", "Content-Type": "application/json" },
    body: JSON.stringify({ spreadsheetId: "sheet", clubId, groupAssignments }),
  }));
}

const rosterOf = async (name: string) => (await db.query<{ training_date: string }>(
  `SELECT s.training_date::text AS training_date FROM training_session_players r
   JOIN training_sessions s ON s.id=r.training_session_id JOIN players p ON p.id=r.player_id
   WHERE p.full_name=$1 ORDER BY s.training_date`, [name])).rows.map((r) => r.training_date);

const membershipsOf = async (name: string) => (await db.query<{ joined_at: Date; left: boolean }>(
  `SELECT m.joined_at, m.left_at IS NOT NULL AS left FROM attendance_memberships m JOIN players p ON p.id=m.player_id
   WHERE p.full_name=$1 AND m.scope_key=$2 ORDER BY m.joined_at`, [name, scopeKey])).rows;

beforeAll(async () => {
  await db.exec(`
    CREATE TABLE clubs(id uuid PRIMARY KEY, payment_workflow text);
    CREATE TABLE players(id uuid PRIMARY KEY, club_id uuid, full_name text, team_group integer, is_active boolean, created_at timestamptz DEFAULT now());
    CREATE TABLE training_opt_outs(player_id uuid, training_date date, reason_code text, reason_text text, UNIQUE(player_id,training_date));
    CREATE TABLE "_PlayerCoachGroups"("A" uuid,"B" uuid,UNIQUE("A","B"));
    CREATE TABLE club_custom_training_group_players(group_id uuid,player_id uuid,PRIMARY KEY(group_id,player_id));
    CREATE TABLE training_sessions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),club_id uuid,scope_key text,scope_id uuid,scope_type text,occurrence_key text DEFAULT '',status text,training_date date,training_time text,removed_from_schedule boolean DEFAULT false);
    CREATE TABLE limited_training_events(club_id uuid,scope_key text,training_date date,UNIQUE(club_id,scope_key,training_date));
    CREATE TABLE training_session_players(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),training_session_id uuid,player_id uuid,player_name text,team_group integer,present boolean DEFAULT true,attendance_recorded boolean DEFAULT false,credit_charged_at timestamptz,reason_code text,reason_text text,updated_at timestamptz,UNIQUE(training_session_id,player_id));
  `);
  for (const migration of ["20261020130000_attendance_membership_history", "20261020133000_membership_sessions_without_time", "20261020140000_membership_check_in_compatibility", "20261020160000_membership_preserve_opt_outs", "20261021170000_attendance_roster_lock", "20261113010000_schedule2_enrollment_roster"]) {
    await db.exec(readFileSync(`prisma/migrations/${migration}/migration.sql`, "utf8"));
  }
}, 30000);
afterAll(async () => { await db.close(); });

beforeEach(async () => {
  vi.clearAllMocks();
  mocks.failMembershipUpdate.value = false;
  await db.exec("TRUNCATE attendance_memberships,training_session_players,club_custom_training_group_players,training_sessions,limited_training_events,training_opt_outs,players,clubs CASCADE");
  await db.query("INSERT INTO clubs VALUES ($1,'calendar_month')", [clubId]);
  // Upcoming sessions of the custom group: in 2 days and in 5 days, 17:00 Sofia time.
  for (const offset of [2, 5]) {
    await db.query(
      "INSERT INTO training_sessions(club_id,scope_key,status,training_date,training_time) VALUES ($1,$2,'scheduled',$3::date,'17:00')",
      [clubId, scopeKey, sofiaDate(offset).iso],
    );
  }
  mocks.clubCustomTrainingGroup.count.mockImplementation(async ({ where }) => where.id.in.length);
  mocks.club.findUnique.mockResolvedValue({ id: clubId, billingStatus: "demo", firstBillingMonth: null, defaultPaymentAmount: null });
  mocks.$transaction.mockImplementation(async (callback) => db.transaction((tx) => callback(prismaTx(tx))));
});

it("creates the group link, membership with the sheet start date, and eligible roster entries in one import", async () => {
  const startToday = sofiaDate(0);
  const startLater = sofiaDate(3);
  const response = await importRows([
    ["Иван Петров", "", "", startToday.sheet],
    ["Георги Токов", "", "", startLater.sheet],
  ]);
  expect(await response.json()).toMatchObject({ created: 2, skipped: 0 });

  expect((await db.query("SELECT count(*)::int AS n FROM club_custom_training_group_players WHERE group_id=$1", [groupId])).rows).toEqual([{ n: 2 }]);
  // Started today: both upcoming sessions. Starts in 3 days: only the session after its start.
  expect(await rosterOf("Иван Петров")).toEqual([sofiaDate(2).iso, sofiaDate(5).iso]);
  expect(await rosterOf("Георги Токов")).toEqual([sofiaDate(5).iso]);

  const { parseAttendanceStartDate } = await import("@/lib/attendanceStartDate");
  const [ivan] = await membershipsOf("Иван Петров");
  const [georgi] = await membershipsOf("Георги Токов");
  expect(ivan).toEqual({ joined_at: parseAttendanceStartDate(startToday.sheet), left: false });
  expect(georgi).toEqual({ joined_at: parseAttendanceStartDate(startLater.sheet), left: false });
});

it("keeps membership history and future roster consistent when an imported player is removed and re-added", async () => {
  await importRows([["Иван Петров", "", "", sofiaDate(0).sheet]]);
  const { rows: [{ id: playerId }] } = await db.query<{ id: string }>("SELECT id FROM players WHERE full_name='Иван Петров'");

  await db.query("DELETE FROM club_custom_training_group_players WHERE group_id=$1 AND player_id=$2", [groupId, playerId]);
  expect(await rosterOf("Иван Петров")).toEqual([]);
  expect((await membershipsOf("Иван Петров")).map((m) => m.left)).toEqual([true]);

  await db.query("INSERT INTO club_custom_training_group_players VALUES ($1,$2)", [groupId, playerId]);
  expect(await rosterOf("Иван Петров")).toEqual([sofiaDate(2).iso, sofiaDate(5).iso]);
  expect((await membershipsOf("Иван Петров")).map((m) => m.left)).toEqual([true, false]);
});

it("does not import players into groups that were not selected", async () => {
  const response = await importRows([["Иван Петров", "", "", ""]], false);
  expect(await response.json()).toMatchObject({ created: 1 });
  expect((await db.query("SELECT count(*)::int AS n FROM club_custom_training_group_players")).rows).toEqual([{ n: 0 }]);
  expect(await rosterOf("Иван Петров")).toEqual([]);
});

it("rolls back the player, group link, membership and roster when the import transaction fails", async () => {
  mocks.failMembershipUpdate.value = true;
  const response = await importRows([["Иван Петров", "", "", sofiaDate(0).sheet]]);
  expect(await response.json()).toMatchObject({ created: 0, skipped: 1 });
  for (const table of ["players", "club_custom_training_group_players", "attendance_memberships", "training_session_players"]) {
    expect((await db.query(`SELECT count(*)::int AS n FROM ${table}`)).rows).toEqual([{ n: 0 }]);
  }
});
