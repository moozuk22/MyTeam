import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import type { Prisma } from "@prisma/client";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ query: vi.fn(), count: vi.fn(), findCoaches: vi.fn() }));
vi.mock("@/lib/db", () => ({
  prisma: {
    $queryRaw: mocks.query,
    trainingPlan: { count: mocks.count },
    coachGroup: { findMany: mocks.findCoaches },
  },
}));
import { countTrainingPlansByScope, listTrainingPlanCoaches, listTrainingPlans } from "./queries";
const club = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";
const db = new PGlite();
beforeAll(async () => {
  await db.exec(
    `CREATE TABLE clubs (id uuid PRIMARY KEY);
    CREATE TABLE coach_groups (id uuid PRIMARY KEY);
    CREATE TABLE training_plans (id uuid PRIMARY KEY, club_id uuid, title text, description text, created_by_user_id uuid, created_at timestamptz, updated_at timestamptz, layout jsonb);`,
  );
  await db.query(
    `INSERT INTO training_plans SELECT ('00000000-0000-4000-8000-' || lpad(i::text,12,'0'))::uuid, $1::uuid, 'План ' || i, null, null, '2026-11-10T10:00:00Z', '2026-11-10T10:00:00Z', jsonb_build_object('version', CASE WHEN i % 2 = 0 THEN 2 ELSE 1 END, 'objects', jsonb_build_array(jsonb_build_object('label',repeat('x',1000)))) FROM generate_series(1,52) i`,
    [club],
  );
  await db.query(
    `INSERT INTO training_plans VALUES ('99999999-9999-4999-8999-999999999999',$1::uuid,'Друг клуб',null,null,now(),now(),'{"version":"future"}')`,
    [other],
  );
  await db.query("INSERT INTO clubs VALUES ($1), ($2)", [club, other]);
  await db.exec(readFileSync(
    new URL("../../../prisma/migrations/20261112010000_training_plan_categories/migration.sql", import.meta.url),
    "utf8",
  ));
  await db.query(
    "UPDATE training_plans SET category_id = (SELECT id FROM training_plan_categories WHERE name_key = 'техника' AND club_id IS NULL) WHERE id = '00000000-0000-4000-8000-000000000001'",
  );
  await db.query(
    "INSERT INTO training_plan_categories (club_id, name, name_key) VALUES ($1, 'Клубна категория', 'клубна категория')",
    [club],
  );
  await db.exec(readFileSync(
    new URL("../../../prisma/migrations/20261112020000_update_default_training_plan_categories/migration.sql", import.meta.url),
    "utf8",
  ));
  await db.exec(readFileSync(
    new URL("../../../prisma/migrations/20261113010000_training_plan_creator/migration.sql", import.meta.url),
    "utf8",
  ));
  mocks.query.mockImplementation(
    async (sql: Prisma.Sql) => (await db.query(sql.text, sql.values)).rows,
  );
});
afterAll(() => db.close());

it("counts all club plans and only the signed-in user's plans within that club", async () => {
  mocks.count.mockResolvedValueOnce(52).mockResolvedValueOnce(3);
  expect(await countTrainingPlansByScope(club, other)).toEqual({ club: 52, mine: 3 });
  expect(mocks.count.mock.calls).toEqual([
    [{ where: { clubId: club } }],
    [{ where: { clubId: club, createdByUserId: other } }],
  ]);

  mocks.count.mockClear().mockResolvedValueOnce(52);
  expect(await countTrainingPlansByScope(club, "env-admin")).toEqual({ club: 52, mine: 0 });
  expect(mocks.count.mock.calls).toEqual([[{ where: { clubId: club } }]]);
});

it("scopes both the coach options and their plan counts to the selected club", async () => {
  await listTrainingPlanCoaches(club);
  expect(mocks.findCoaches).toHaveBeenCalledWith({
    where: { clubId: club, trainingPlans: { some: { clubId: club } } },
    select: {
      id: true,
      name: true,
      _count: { select: { trainingPlans: { where: { clubId: club } } } },
    },
    orderBy: [{ name: "asc" }, { id: "asc" }],
  });
});
it("keeps the saved author name when a coach group is removed", async () => {
  const planId = "00000000-0000-4000-8000-000000000052";
  await db.query("INSERT INTO coach_groups VALUES ($1)", [club]);
  await db.query(
    "UPDATE training_plans SET creator_name = 'Треньор Иванов', created_by_coach_group_id = $1 WHERE id = $2",
    [club, planId],
  );
  await db.query("DELETE FROM coach_groups WHERE id = $1", [club]);
  expect((await db.query("SELECT created_by_coach_group_id FROM training_plans WHERE id = $1", [planId])).rows)
    .toEqual([{ created_by_coach_group_id: null }]);
  expect((await listTrainingPlans(club)).plans.find(({ id }) => id === planId)?.creatorName)
    .toBe("Треньор Иванов");
});
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

it("sorts oldest first across pages, using the same order for timestamp ties and cursors", async () => {
  await db.exec("BEGIN");
  try {
    await db.query("UPDATE training_plans SET updated_at = '2026-11-10T10:00:00Z' WHERE club_id = $1", [club]);
    const first = await listTrainingPlans(club, null, undefined, undefined, undefined, true);
    const second = await listTrainingPlans(club, first.nextCursor, undefined, undefined, undefined, true);
    expect(first.plans.map(({ title }) => title)).toEqual(
      Array.from({ length: 50 }, (_, index) => `План ${index + 1}`),
    );
    expect(second.plans.map(({ title }) => title)).toEqual(["План 51", "План 52"]);
    expect(second.nextCursor).toBeNull();
  } finally {
    await db.exec("ROLLBACK");
  }
});

it("applies the category migration to existing plans and paginates category filters", async () => {
  const { rows: defaults } = await db.query<{ id: string; name: string }>(
    "SELECT id, name FROM training_plan_categories WHERE club_id IS NULL ORDER BY name",
  );
  expect(defaults.map(({ name }) => name).sort()).toEqual([
    "Атака",
    "Защита",
    "Преход атака в защита",
    "Преход защита в атака",
    "Статични положения",
  ]);
  expect((await db.query(
    `SELECT c.club_id, c.name FROM training_plans p JOIN training_plan_categories c ON c.id = p.category_id
     WHERE p.id = '00000000-0000-4000-8000-000000000001'`,
  )).rows).toEqual([{ club_id: club, name: "Техника" }]);
  expect((await db.query(
    "SELECT name FROM training_plan_categories WHERE club_id = $1 AND name_key = 'клубна категория'",
    [club],
  )).rows).toEqual([{ name: "Клубна категория" }]);
  expect((await listTrainingPlans(club, null, "uncategorized")).plans).toHaveLength(50);
  const category = defaults[0].id;
  await db.query("UPDATE training_plans SET category_id = $1 WHERE club_id = $2 AND id <> '00000000-0000-4000-8000-000000000001'", [category, club]);
  const first = await listTrainingPlans(club, null, category);
  expect(first.plans).toHaveLength(50);
  expect(first.plans.every((plan) => plan.categoryId === category)).toBe(true);
  expect((await listTrainingPlans(club, first.nextCursor, category)).plans).toHaveLength(1);
  expect((await listTrainingPlans(club, null, "uncategorized")).plans).toHaveLength(0);
  expect((await listTrainingPlans(other, null, category)).plans).toHaveLength(0);
});


it("combines the signed-in creator and category filters before pagination", async () => {
  await db.exec("BEGIN");
  try {
    const { rows: [category] } = await db.query<{ id: string }>(
      "SELECT id FROM training_plan_categories WHERE club_id IS NULL AND name_key = 'атака'",
    );
    await db.query(
      "UPDATE training_plans SET created_by_user_id = $1, category_id = $2",
      [club, category.id],
    );
    await db.exec("UPDATE training_plans SET created_by_user_id = NULL WHERE title = 'План 52'");
    const first = await listTrainingPlans(club, null, category.id, club);
    expect(first.plans).toHaveLength(50);
    expect(first.plans.some(({ title }) => title === "План 52")).toBe(false);
    expect(first.nextCursor).toBe(first.plans.at(-1)?.id);
    const second = await listTrainingPlans(club, first.nextCursor, category.id, club);
    expect(second.plans).toHaveLength(1);
    const ids = new Set([...first.plans, ...second.plans].map(({ id }) => id));
    expect(ids.size).toBe(51);
    expect(second.nextCursor).toBeNull();
    expect((await listTrainingPlans(club, null, "uncategorized", club)).plans).toEqual([]);
    expect((await listTrainingPlans(club, null, category.id, "env-admin")).plans).toEqual([]);
  } finally {
    await db.exec("ROLLBACK");
  }
});

it("filters by coach across pages while keeping unattributed plans in the club list", async () => {
  await db.exec("BEGIN");
  try {
    await db.query("INSERT INTO coach_groups VALUES ($1), ($2)", [club, other]);
    await db.query("UPDATE training_plans SET created_by_coach_group_id = $1 WHERE club_id = $1", [club]);
    await db.query("UPDATE training_plans SET created_by_coach_group_id = $1 WHERE title = 'План 52'", [other]);
    const first = await listTrainingPlans(club, null, undefined, undefined, club);
    const second = await listTrainingPlans(club, first.nextCursor, undefined, undefined, club);
    expect(first.plans).toHaveLength(50);
    expect(second.plans).toHaveLength(1);
    expect([...first.plans, ...second.plans].some(({ title }) => title === "План 52")).toBe(false);
    expect((await listTrainingPlans(club, null, undefined, undefined, other)).plans.map(({ title }) => title)).toEqual(["План 52"]);
    expect((await listTrainingPlans(other, null, undefined, undefined, club)).plans).toEqual([]);
    expect((await listTrainingPlans(other)).plans).toHaveLength(1);
  } finally {
    await db.exec("ROLLBACK");
  }
});
