import { PGlite } from "@electric-sql/pglite";
import type { Prisma } from "@prisma/client";
import { afterAll, beforeAll, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: { $queryRaw: mocks.query } }));
import { listTrainingPlans } from "./queries";

const club = "11111111-1111-4111-8111-111111111111";
const otherClub = "22222222-2222-4222-8222-222222222222";
const author = "33333333-3333-4333-8333-333333333333";
const otherAuthor = "44444444-4444-4444-8444-444444444444";
const db = new PGlite();

beforeAll(async () => {
  await db.exec(`CREATE TABLE training_plans (
    id uuid PRIMARY KEY, club_id uuid, title text, description text,
    category_id uuid, creator_name text, created_by_user_id uuid,
    created_by_coach_group_id uuid, created_at timestamptz, updated_at timestamptz, layout jsonb
  )`);
  await db.query(`INSERT INTO training_plans
    SELECT ('00000000-0000-4000-8000-' || lpad(i::text,12,'0'))::uuid,
      $1::uuid, 'Атака ' || i, null, null, 'Автор', $2::uuid, null,
      '2026-11-10T10:00:00Z', '2026-11-10T10:00:00Z', '{"version":2}'::jsonb
    FROM generate_series(1,52) i`, [club, author]);
  await db.query(`INSERT INTO training_plans VALUES
    ('55555555-5555-4555-8555-555555555555', $1, 'Атака на друг автор', null, null, null, $2, null, now(), now(), '{"version":2}'),
    ('66666666-6666-4666-8666-666666666666', $3, 'Атака в друг клуб', null, null, null, $4, null, now(), now(), '{"version":2}'),
    ('77777777-7777-4777-8777-777777777777', $1, 'Защита 100%_точно', null, null, null, $4, null, now(), now(), '{"version":2}')`,
  [club, otherAuthor, otherClub, author]);
  mocks.query.mockImplementation(async (sql: Prisma.Sql) => (await db.query(sql.text, sql.values)).rows);
});
afterAll(() => db.close());

it("searches only the selected author's club drawings before pagination", async () => {
  const first = await listTrainingPlans(club, null, undefined, author, undefined, false, "  атака  ");
  const second = await listTrainingPlans(club, first.nextCursor, undefined, author, undefined, false, "атака");
  expect(first.plans).toHaveLength(50);
  expect(second.plans).toHaveLength(2);
  expect(second.nextCursor).toBeNull();
  const plans = [...first.plans, ...second.plans];
  expect(new Set(plans.map(({ id }) => id)).size).toBe(52);
  expect(plans.every(({ title }) => /^Атака \d+$/.test(title))).toBe(true);
});

it("includes other club authors but excludes foreign club drawings", async () => {
  const first = await listTrainingPlans(club, null, undefined, undefined, undefined, false, "атака");
  const second = await listTrainingPlans(club, first.nextCursor, undefined, undefined, undefined, false, "атака");
  const titles = [...first.plans, ...second.plans].map(({ title }) => title);
  expect(titles).toHaveLength(53);
  expect(titles).toContain("Атака на друг автор");
  expect(titles).not.toContain("Атака в друг клуб");
});

it("returns empty results and treats wildcard characters as literal title text", async () => {
  expect(await listTrainingPlans(club, null, undefined, author, undefined, false, "липсваща рисунка"))
    .toEqual({ plans: [], nextCursor: null });
  const literal = await listTrainingPlans(club, null, undefined, author, undefined, false, "%_");
  expect(literal.plans.map(({ title }) => title)).toEqual(["Защита 100%_точно"]);
});
