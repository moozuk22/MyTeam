import { PGlite } from "@electric-sql/pglite";
import type { Prisma } from "@prisma/client";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: { $queryRaw: mocks.query } }));
import { listTrainingPlans } from "./queries";
const club = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";
const db = new PGlite();
beforeAll(async () => {
  await db.exec(
    `CREATE TABLE training_plans (id uuid PRIMARY KEY, club_id uuid, title text, description text, created_at timestamptz, updated_at timestamptz, layout jsonb);`,
  );
  await db.query(
    `INSERT INTO training_plans SELECT ('00000000-0000-4000-8000-' || lpad(i::text,12,'0'))::uuid, $1::uuid, 'План ' || i, null, '2026-11-10T10:00:00Z', '2026-11-10T10:00:00Z', jsonb_build_object('version', CASE WHEN i % 2 = 0 THEN 2 ELSE 1 END, 'objects', jsonb_build_array(jsonb_build_object('label',repeat('x',1000)))) FROM generate_series(1,52) i`,
    [club],
  );
  await db.query(
    `INSERT INTO training_plans VALUES ('99999999-9999-4999-8999-999999999999',$1::uuid,'Друг клуб',null,now(),now(),'{"version":"future"}')`,
    [other],
  );
  mocks.query.mockImplementation(
    async (sql: Prisma.Sql) => (await db.query(sql.text, sql.values)).rows,
  );
});
afterAll(() => db.close());
it("paginates equal timestamps without omissions and returns only small summaries", async () => {
  const first = await listTrainingPlans(club);
  expect(first.plans).toHaveLength(50);
  expect(first.nextCursor).toBe(first.plans.at(-1)!.id);
  const second = await listTrainingPlans(club, first.nextCursor);
  expect(second.plans).toHaveLength(2);
  expect(second.nextCursor).toBeNull();
  const rows = [...first.plans, ...second.plans];
  expect(new Set(rows.map((r) => r.id)).size).toBe(52);
  expect(rows.some((r) => r.title === "Друг клуб")).toBe(false);
  expect(
    rows.every(
      (r) => !Object.hasOwn(r, "layout") && [1, 2].includes(r.layoutVersion),
    ),
  ).toBe(true);
});
it("does not use a foreign-club cursor and handles unknown JSON versions without SQL cast errors", async () => {
  expect(
    (await listTrainingPlans(club, "99999999-9999-4999-8999-999999999999"))
      .plans,
  ).toEqual([]);
  expect((await listTrainingPlans(other)).plans[0].layoutVersion).toBe(1);
});
