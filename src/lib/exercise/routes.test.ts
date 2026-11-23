import { trainingPlanCapabilities } from "@/lib/trainingPlanSubscriptions";
vi.mock("@/lib/trainingPlanSubscriptions", () => ({ trainingPlanCapabilities: vi.fn() }));
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { SignJWT } from "jose";
import { middleware } from "@/middleware";
import { DEFAULT_LAYOUT } from "@/lib/trainingPlans";
import { createObject, EMPTY_EXERCISE } from "./model";
const mocks = vi.hoisted(() => ({
  verify: vi.fn(),
  findMany: vi.fn(),
  findFirst: vi.fn(),
  findUnique: vi.fn(),
  create: vi.fn(),
  updateMany: vi.fn(),
  delete: vi.fn(),
  club: vi.fn(),
  coachGroup: vi.fn(),
  transaction: vi.fn(),
  queryRaw: vi.fn(),
  categoryFindFirst: vi.fn(),
  categoryCreate: vi.fn(),
  categoryCount: vi.fn(),
  categoryUpdate: vi.fn(),
  categoryDelete: vi.fn(),
}));
vi.mock("@/lib/adminAuth", () => ({ verifyAdminToken: mocks.verify }));
vi.mock("@/lib/db", () => ({
  prisma: {
    trainingPlan: {
      findMany: mocks.findMany,
      findFirst: mocks.findFirst,
      findUnique: mocks.findUnique,
      create: mocks.create,
      delete: mocks.delete,
    },
    club: { findUnique: mocks.club },
    coachGroup: { findFirst: mocks.coachGroup },
    trainingPlanCategory: { findFirst: mocks.categoryFindFirst, deleteMany: mocks.categoryDelete },
    $transaction: mocks.transaction,
    $queryRaw: mocks.queryRaw,
  },
}));
import {
  GET as list,
  POST,
} from "@/app/api/admin/clubs/[id]/training-plans/route";
import {
  DELETE,
  GET,
  PUT,
} from "@/app/api/admin/clubs/[id]/training-plans/[planId]/route";
import { POST as createCategory } from "@/app/api/admin/clubs/[id]/training-plans/categories/route";
import * as categoryRoute from "@/app/api/admin/clubs/[id]/training-plans/categories/[categoryId]/route";
import { GET as getPreviews } from "@/app/api/admin/clubs/[id]/training-plans/previews/route";
const club = "11111111-1111-4111-8111-111111111111",
  otherClub = "22222222-2222-4222-8222-222222222222",
  id = "33333333-3333-4333-8333-333333333333";
const revision = "2026-11-10T10:00:00.000Z";
const params = { params: Promise.resolve({ id: club, planId: id }) };
const row = {
  id,
  clubId: club,
  title: "Упражнение",
  description: null,
  categoryId: null,
  layout: EMPTY_EXERCISE,
  updatedAt: new Date(revision),
  createdAt: new Date(revision),
};
function request(
  method: string,
  body?: unknown,
  origin = "http://localhost:3000",
  pathId = id,
) {
  return new NextRequest(
    `http://localhost:3000/api/admin/clubs/${club}/training-plans/${pathId}`,
    {
      method,
      headers: {
        cookie: "admin_session=test",
        origin,
        "content-type": "application/json",
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    },
  );
}
beforeEach(() => {
  vi.resetAllMocks();
  delete process.env.APP_BASE_URL;
  mocks.verify.mockResolvedValue({
    sub: id,
    roles: ["admin"],
    defaultClubId: null,
  });
  vi.mocked(trainingPlanCapabilities).mockResolvedValue({enabled:true,canSave:true,canPrint:true});
  mocks.club.mockResolvedValue({ id: club });
  mocks.findUnique.mockResolvedValue(row);
  mocks.findMany.mockResolvedValue([row]);
  mocks.queryRaw.mockResolvedValue([
    {
      id,
      title: row.title,
      description: null,
      layoutVersion: 2,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    },
  ]);
  mocks.findFirst.mockResolvedValue(row);
  mocks.create.mockResolvedValue(row);
  mocks.updateMany.mockResolvedValue({ count: 1 });
  mocks.transaction.mockImplementation(async (fn) =>
    fn({
      $queryRaw: mocks.queryRaw,
      $executeRaw: vi.fn(),
      trainingPlanCategory: {
        findFirst: mocks.categoryFindFirst,
        create: mocks.categoryCreate,
        count: mocks.categoryCount,
        updateMany: mocks.categoryUpdate,
      },
      trainingPlan: {
        findFirst: mocks.findFirst,
        create: mocks.create,
        delete: mocks.delete,
        updateMany: mocks.updateMany,
        findUnique: mocks.findUnique,
      },
    }),
  );
});
afterEach(() => vi.unstubAllEnvs());
describe("training plan previews", () => {
  function previewRequest(ids: string) {
    return new NextRequest(`http://localhost:3000/api/admin/clubs/${club}/training-plans/previews?ids=${ids}`, {
      headers: { cookie: "admin_session=test" },
    });
  }

  it("only requests drawings for the current club and skips invalid or legacy layouts", async () => {
    mocks.findMany.mockResolvedValue([
      { id, layout: EMPTY_EXERCISE },
      { id: otherClub, layout: DEFAULT_LAYOUT },
      { id: club, layout: { version: 2 } },
    ]);
    const response = await getPreviews(previewRequest(`${id},${otherClub},${club}`), params);
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(mocks.findMany).toHaveBeenCalledExactlyOnceWith({
      where: { clubId: club, id: { in: [id, otherClub, club] } },
      select: { id: true, layout: true },
    });
    expect(await response.json()).toEqual({ previews: [{ id, layout: EMPTY_EXERCISE }] });
  });

  it("rejects oversized batches and coaches from another club before reading drawings", async () => {
    expect((await getPreviews(previewRequest(Array(51).fill(id).join(",")), params)).status).toBe(400);
    mocks.verify.mockResolvedValue({ sub: id, roles: ["coach"], defaultClubId: otherClub });
    expect((await getPreviews(previewRequest(id), params)).status).toBe(403);
    expect(mocks.findMany).not.toHaveBeenCalled();
  });
});

describe("training plan access and persistence", () => {
  it.each([id, `%33${id.slice(1)}`, `${id}/`])("blocks an unpaid drawing update at %s before reads or writes", async pathId => {
    mocks.verify.mockResolvedValue({ sub: id, roles: ["coach"], defaultClubId: club });
    vi.mocked(trainingPlanCapabilities).mockResolvedValue({ enabled: false, canSave: false, canPrint: false });
    const response = await PUT(request("PUT", {
      title: "Променен план", layout: EMPTY_EXERCISE, expectedUpdatedAt: revision,
    }, "http://localhost:3000", pathId), params);
    expect(response.status).toBe(403);
    expect(mocks.findUnique).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });

  it.each(["coach", "admin"])("keeps encoded drawing updates available to an authorized %s", async role => {
    mocks.verify.mockResolvedValue({ sub: id, roles: [role], defaultClubId: club });
    vi.mocked(trainingPlanCapabilities).mockResolvedValue({ enabled: role === "coach", canSave: true, canPrint: true });
    const response = await PUT(request("PUT", {
      title: "Променен план", expectedUpdatedAt: revision,
    }, "http://localhost:3000", `%33${id.slice(1)}`), params);
    expect(response.status).toBe(200);
    expect(mocks.updateMany).toHaveBeenCalledOnce();
    expect(vi.mocked(trainingPlanCapabilities)).toHaveBeenCalledWith(club, [role]);
  });

  it("records the coach group name and signed-in account when creating a plan from a group", async () => {
    mocks.coachGroup.mockResolvedValue({ id: otherClub, name: "Треньор Иванов" });
    const response = await POST(request("POST", { title: "Тест", coachGroupId: otherClub }), params);
    expect(response.status).toBe(201);
    expect(mocks.coachGroup).toHaveBeenCalledWith({
      where: { id: otherClub, clubId: club }, select: { id: true, name: true },
    });
    expect(mocks.create.mock.calls[0][0].data).toMatchObject({
      createdByCoachGroupId: otherClub, creatorName: "Треньор Иванов", createdByUserId: id,
    });
  });

  it("rejects a group outside the club and labels creation from the main page as administrator", async () => {
    mocks.coachGroup.mockResolvedValue(null);
    expect((await POST(request("POST", { title: "Тест", coachGroupId: otherClub }), params)).status).toBe(400);
    expect(mocks.create).not.toHaveBeenCalled();
    expect((await POST(request("POST", { title: "Тест" }), params)).status).toBe(201);
    expect(mocks.create.mock.calls[0][0].data).toMatchObject({
      createdByCoachGroupId: null, creatorName: "Администратор", createdByUserId: id,
    });
  });

  it("keeps the original creator when another account saves changes", async () => {
    const response = await PUT(request("PUT", {
      title: "Ново име", expectedUpdatedAt: revision, coachGroupId: otherClub, creatorName: "Друг автор",
    }), params);
    expect(response.status).toBe(200);
    const { data } = mocks.updateMany.mock.calls[0][0];
    expect(data).toMatchObject({ title: "Ново име", updatedByUserId: id });
    expect(data).not.toHaveProperty("creatorName");
    expect(data).not.toHaveProperty("createdByCoachGroupId");
    expect(data).not.toHaveProperty("createdByUserId");
  });

  it("creates a local Konva plan in development with a configured production URL", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("APP_BASE_URL", "https://myteam7.com");
    const response = await POST(request("POST", { title: "Тест", editorVersion: 2 }), params);
    expect(response.status).toBe(201);
    expect(mocks.create).toHaveBeenCalled();
  });
  it("saves the first drawing and its details in one creation request", async () => {
    const layout = {
      ...EMPTY_EXERCISE,
      objects: [createObject("ball", { x: 100, y: 100 }, "first-ball")],
    };
    const details = { title: "Първи план", description: "Подавания", requirements: "Пас с два допира.", layout };
    const response = await POST(request("POST", details), params);

    expect(response.status).toBe(201);
    expect(mocks.create).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ data: expect.objectContaining({ ...details, clubId: club }) }),
    );
    expect(await response.json()).toMatchObject({
      plan: { id, layoutVersion: 2, updatedAt: revision },
    });
  });
  it("rejects unauthenticated and scoped-coach cross-club requests for every operation", async () => {
    for (const session of [
      null,
      { sub: id, roles: ["coach"], defaultClubId: otherClub },
    ]) {
      mocks.verify.mockResolvedValue(session);
      const expected = session ? 403 : 401;
      expect((await list(request("GET"), params)).status).toBe(expected);
      expect((await GET(request("GET"), params)).status).toBe(expected);
      expect(
        (await POST(request("POST", { title: "test" }), params)).status,
      ).toBe(expected);
      expect(
        (await PUT(request("PUT", { layout: EMPTY_EXERCISE }), params)).status,
      ).toBe(expected);
      expect((await DELETE(request("DELETE"), params)).status).toBe(expected);
    }
    expect(mocks.findUnique).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("preserves unscoped-coach club access and allows admins", async () => {
    mocks.verify.mockResolvedValue({
      sub: id,
      roles: ["coach"],
      defaultClubId: null,
    });
    expect((await GET(request("GET"), params)).status).toBe(200);
    mocks.verify.mockResolvedValue({
      sub: id,
      roles: ["admin"],
      defaultClubId: otherClub,
    });
    expect((await GET(request("GET"), params)).status).toBe(200);
  });
  it("rejects untrusted mutation origins before reads or writes", async () => {
    for (const [method, handler] of [
      ["POST", POST],
      ["PUT", PUT],
      ["DELETE", DELETE],
    ] as const)
      expect(
        (
          await handler(
            request(method, {}, "https://untrusted.example"),
            params,
          )
        ).status,
      ).toBe(403);
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.findUnique).not.toHaveBeenCalled();
  });
  it("never copies a source outside the authorized club", async () => {
    mocks.findFirst.mockResolvedValue(null);
    expect(
      (
        await POST(
          request("POST", {
            title: "copy",
            sourcePlanId: id,
            editorVersion: 2,
          }),
          params,
        )
      ).status,
    ).toBe(404);
    expect(mocks.findFirst).toHaveBeenCalledWith({
      where: { id, clubId: club },
      select: { layout: true, categoryId: true, requirements: true },
    });
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("creates a Konva copy of legacy JSON without updating the original", async () => {
    mocks.findFirst.mockResolvedValue({ layout: DEFAULT_LAYOUT });
    expect(
      (
        await POST(
          request("POST", {
            title: "copy",
            sourcePlanId: id,
            editorVersion: 2,
          }),
          params,
        )
      ).status,
    ).toBe(201);
    expect(mocks.create.mock.calls[0][0].data.layout.version).toBe(2);
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });
  it("requires a revision for V2, scopes conditional updates, returns 409 for stale saves", async () => {
    expect(
      (await PUT(request("PUT", { layout: EMPTY_EXERCISE }), params)).status,
    ).toBe(400);
    mocks.updateMany.mockResolvedValue({ count: 0 });
    expect(
      (
        await PUT(
          request("PUT", {
            layout: EMPTY_EXERCISE,
            expectedUpdatedAt: revision,
          }),
          params,
        )
      ).status,
    ).toBe(409);
    expect(mocks.updateMany.mock.calls[0][0].where).toEqual({
      id,
      clubId: club,
      updatedAt: new Date(revision),
    });
    // Successful response is read inside the same transaction, before another writer can update it.
    mocks.updateMany.mockResolvedValue({ count: 1 });
    const fourthTeam = { number: 4, color: "#22d3ee" };
    const layout = {
      ...EMPTY_EXERCISE,
      quadrants: ["top-right", "bottom-right"],
      pitchRotation: 90,
      customTeamColors: ["#a855f7", fourthTeam.color],
      objects: [
        createObject("wall", { x: 200, y: 150 }, "wall"),
        createObject("custom-team-player", { x: 260, y: 150 }, "player", fourthTeam),
      ],
    };
    const title = "План за пасове";
    const description = "Пасове по двойки.\nДве серии.";
    mocks.findUnique.mockResolvedValue({ ...row, layout, title, description });
    const response = await PUT(
      request("PUT", { layout, title: ` ${title} `, description: ` ${description} `, expectedUpdatedAt: revision }),
      params,
    );
    expect(response.status).toBe(200);
    expect(mocks.updateMany.mock.calls[1][0].data.layout).toEqual(layout);
    expect(mocks.updateMany.mock.calls[1][0].data.title).toBe(title);
    expect(mocks.updateMany.mock.calls[1][0].data.description).toBe(description);
    const payload = await response.json();
    expect(payload.plan.layout).toEqual(layout);
    expect(payload.plan.title).toBe(title);
    expect(payload.plan.description).toBe(description);
    expect(mocks.transaction).toHaveBeenCalledTimes(2);
  });
  it("allows only one of two saves from the same revision", async () => {
    let claimed = false;
    mocks.updateMany.mockImplementation(async () => {
      if (claimed) return { count: 0 };
      claimed = true;
      return { count: 1 };
    });
    const responses = await Promise.all([
      PUT(
        request("PUT", { layout: EMPTY_EXERCISE, expectedUpdatedAt: revision }),
        params,
      ),
      PUT(
        request("PUT", { layout: EMPTY_EXERCISE, expectedUpdatedAt: revision }),
        params,
      ),
    ]);
    expect(responses.map((r) => r.status).sort()).toEqual([200, 409]);
  });
  it("bounds list reads and includes editor version in summaries", async () => {
    const response = await list(request("GET"), params);
    const body = await response.json();
    expect(body.plans[0].layoutVersion).toBe(2);
    expect(body.plans[0]).not.toHaveProperty("layout");
    const query = mocks.queryRaw.mock.calls[0][0];
    expect(query.text).toContain("LIMIT 51");
    expect(query.text).toContain("layout->>'version'");
    expect(query.values).toContain(club);
  });
  it("lets a coach reach the list, review, and editor through middleware", async () => {
    const secret = "training-plans-middleware-test";
    vi.stubEnv("ADMIN_SESSION_SECRET", secret);
    const token = await new SignJWT({ roles: ["coach"], defaultClubId: club })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(id)
      .sign(new TextEncoder().encode(secret));
    const coachRequest = (path: string) => new NextRequest(
      `http://localhost:3000/admin/${path}?clubId=${club}`,
      { headers: { cookie: `admin_session=${token}` } },
    );
    for (const path of ["training-plans", "training-plans/new", `training-plans/${id}`, `training-plans/${id}/konva`]) {
      expect((await middleware(coachRequest(path))).status).toBe(200);
    }
    expect((await middleware(coachRequest("training-plans-settings"))).status).toBe(307);
  });
  it("uses the session author for Mine and preserves the club-wide default", async () => {
    const url = new URL(request("GET").url);
    const headers = { cookie: "admin_session=test" };
    url.searchParams.set("scope", "mine");
    url.searchParams.set("creatorUserId", otherClub);
    expect((await list(new NextRequest(url, { headers }), params)).status).toBe(200);
    expect(mocks.queryRaw.mock.calls[0][0].text).toContain("created_by_user_id =");
    expect(mocks.queryRaw.mock.calls[0][0].values).toEqual([club, id]);

    url.searchParams.set("scope", "club");
    expect((await list(new NextRequest(url, { headers }), params)).status).toBe(200);
    expect(mocks.queryRaw.mock.calls[1][0].text).not.toContain("created_by_user_id");

    url.searchParams.set("scope", "invalid");
    expect((await list(new NextRequest(url, { headers }), params)).status).toBe(400);
    expect(mocks.queryRaw).toHaveBeenCalledTimes(2);
  });
  it("applies the club coach filter and keeps Mine tied to the session account", async () => {
    const url = new URL(request("GET").url);
    const headers = { cookie: "admin_session=test" };
    url.searchParams.set("coachId", otherClub);
    url.searchParams.set("category", "uncategorized");
    url.searchParams.set("cursor", id);
    expect((await list(new NextRequest(url, { headers }), params)).status).toBe(200);
    expect(mocks.queryRaw.mock.calls[0][0].text).toContain("created_by_coach_group_id =");
    expect(mocks.queryRaw.mock.calls[0][0].text).toContain("category_id IS NULL");
    expect(mocks.queryRaw.mock.calls[0][0].values).toEqual([club, otherClub, id, club]);

    url.searchParams.set("scope", "mine");
    expect((await list(new NextRequest(url, { headers }), params)).status).toBe(200);
    expect(mocks.queryRaw.mock.calls[1][0].text).not.toContain("created_by_coach_group_id");
    expect(mocks.queryRaw.mock.calls[1][0].values).toEqual([club, id, id, club]);

    url.searchParams.set("coachId", "invalid");
    expect((await list(new NextRequest(url, { headers }), params)).status).toBe(400);
  });
  it("preserves legacy saves and refuses changing an existing plan's format", async () => {
    mocks.findUnique.mockResolvedValue({ ...row, layout: DEFAULT_LAYOUT });
    expect(
      (await PUT(request("PUT", { layout: DEFAULT_LAYOUT }), params)).status,
    ).toBe(200);
    expect(
      (await PUT(request("PUT", { layout: EMPTY_EXERCISE }), params)).status,
    ).toBe(400);
  });
  it("rejects malformed/null request bodies safely", async () => {
    for (const body of [null, [], "text"]) {
      expect((await POST(request("POST", body), params)).status).toBe(400);
      expect((await PUT(request("PUT", body), params)).status).toBe(400);
    }
  });
});

describe("training plan categories", () => {
  const category = { id: otherClub, name: "Преса" };
  const categoryParams = { params: Promise.resolve({ id: club, categoryId: category.id }) };

  it("renames a club category in place and normalizes its name", async () => {
    mocks.categoryFindFirst.mockResolvedValueOnce(category);
    mocks.categoryUpdate.mockResolvedValue({ count: 1 });
    const response = await categoryRoute.PATCH(request("PATCH", { name: " Висока   преса " }), categoryParams);
    expect(response.status).toBe(200);
    expect(mocks.categoryFindFirst).toHaveBeenNthCalledWith(1, {
      where: { id: category.id, clubId: club },
      select: { id: true },
    });
    expect(mocks.categoryUpdate).toHaveBeenCalledWith({
      where: { id: category.id, clubId: club },
      data: { name: "Висока преса", nameKey: "висока преса" },
    });
    expect((await response.json()).category.id).toBe(category.id);
  });

  it("rejects duplicate names and protects default and other-club categories", async () => {
    mocks.categoryFindFirst.mockResolvedValueOnce(category).mockResolvedValueOnce({ id });
    expect((await categoryRoute.PATCH(request("PATCH", { name: "Атака" }), categoryParams)).status).toBe(409);
    expect(mocks.categoryFindFirst).toHaveBeenLastCalledWith({
      where: { id: { not: category.id }, nameKey: "атака", OR: [{ clubId: null }, { clubId: club }] },
      select: { id: true },
    });
    expect((await categoryRoute.PATCH(request("PATCH", { name: "Новa" }), categoryParams)).status).toBe(404);
    mocks.categoryDelete.mockResolvedValue({ count: 0 });
    expect((await categoryRoute.DELETE(request("DELETE"), categoryParams)).status).toBe(404);
    expect(mocks.categoryUpdate).not.toHaveBeenCalled();
  });

  it("deletes only the club's category and leaves its plans in place", async () => {
    mocks.categoryDelete.mockResolvedValue({ count: 1 });
    const response = await categoryRoute.DELETE(request("DELETE"), categoryParams);
    expect(response.status).toBe(200);
    expect(mocks.categoryDelete).toHaveBeenCalledWith({ where: { id: category.id, clubId: club } });
    expect(mocks.delete).not.toHaveBeenCalled();
  });

  it("validates category mutations and rejects unauthorized requests", async () => {
    expect((await categoryRoute.PATCH(request("PATCH", { name: " " }), categoryParams)).status).toBe(400);
    expect((await categoryRoute.DELETE(request("DELETE"), {
      params: Promise.resolve({ id: club, categoryId: "invalid" }),
    })).status).toBe(400);
    expect((await categoryRoute.DELETE(request("DELETE", undefined, "https://untrusted.example"), categoryParams)).status).toBe(403);
    mocks.verify.mockResolvedValue({ sub: id, roles: ["coach"], defaultClubId: otherClub });
    expect((await categoryRoute.PATCH(request("PATCH", { name: "Преса" }), categoryParams)).status).toBe(403);
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.categoryDelete).not.toHaveBeenCalled();
  });

  it("creates a normalized club category and reuses an existing name on retry", async () => {
    mocks.categoryCount.mockResolvedValue(0);
    mocks.categoryCreate.mockResolvedValue(category);
    const response = await createCategory(request("POST", { name: "  Висока   преса " }), params);
    expect(response.status).toBe(201);
    expect(mocks.categoryCreate).toHaveBeenCalledWith({
      data: { clubId: club, name: "Висока преса", nameKey: "висока преса" },
      select: { id: true, name: true },
    });

    mocks.categoryFindFirst.mockResolvedValue(category);
    const retry = await createCategory(request("POST", { name: "ВИСОКА ПРЕСА" }), params);
    expect(retry.status).toBe(200);
    expect((await retry.json()).category).toEqual(category);
    expect(mocks.categoryFindFirst).toHaveBeenLastCalledWith({
      where: { nameKey: "висока преса", OR: [{ clubId: null }, { clubId: club }] },
      select: { id: true, name: true, clubId: true },
    });
    expect(mocks.categoryCreate).toHaveBeenCalledTimes(1);
  });

  it("rejects invalid names, cross-club coaches, and foreign request origins", async () => {
    expect((await createCategory(request("POST", { name: "   " }), params)).status).toBe(400);
    expect((await createCategory(request("POST", { name: "Преса" }, "https://untrusted.example"), params)).status).toBe(403);
    mocks.verify.mockResolvedValue({ sub: id, roles: ["coach"], defaultClubId: otherClub });
    expect((await createCategory(request("POST", { name: "Преса" }), params)).status).toBe(403);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("limits new custom categories while allowing existing names to be reused", async () => {
    mocks.categoryCount.mockResolvedValue(100);
    expect((await createCategory(request("POST", { name: "Преса" }), params)).status).toBe(400);
    mocks.categoryFindFirst.mockResolvedValue(category);
    expect((await createCategory(request("POST", { name: "Преса" }), params)).status).toBe(200);
    expect(mocks.categoryCreate).not.toHaveBeenCalled();
  });

  it("only assigns shared or current-club categories on creation and update", async () => {
    const body = { title: "Тест", categoryId: category.id, expectedUpdatedAt: revision };
    mocks.categoryFindFirst.mockResolvedValue(null);
    expect((await POST(request("POST", body), params)).status).toBe(400);
    expect((await PUT(request("PUT", body), params)).status).toBe(400);
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.updateMany).not.toHaveBeenCalled();
    expect(mocks.categoryFindFirst).toHaveBeenCalledWith({
      where: { id: category.id, OR: [{ clubId: null }, { clubId: club }] },
      select: { id: true },
    });

    mocks.categoryFindFirst.mockResolvedValue(category);
    expect((await POST(request("POST", body), params)).status).toBe(201);
    expect(mocks.create.mock.calls[0][0].data.categoryId).toBe(category.id);
    expect((await PUT(request("PUT", body), params)).status).toBe(200);
    expect(mocks.updateMany.mock.calls[0][0].data.categoryId).toBe(category.id);
  });

  it("can clear the category and preserves it when drawing saves omit it", async () => {
    await PUT(request("PUT", { layout: EMPTY_EXERCISE, expectedUpdatedAt: revision }), params);
    expect(mocks.updateMany.mock.calls[0][0].data).not.toHaveProperty("categoryId");

    await PUT(request("PUT", { categoryId: null, expectedUpdatedAt: revision }), params);
    expect(mocks.updateMany.mock.calls[1][0].data.categoryId).toBeNull();
    expect(mocks.categoryFindFirst).not.toHaveBeenCalled();
  });

  it("retains the source category when copying and converting", async () => {
    mocks.findFirst.mockResolvedValue({ layout: DEFAULT_LAYOUT, categoryId: category.id });
    const body = { title: "Копие", sourcePlanId: id, editorVersion: 2 };
    expect((await POST(request("POST", body), params)).status).toBe(201);
    expect(mocks.create.mock.calls[0][0].data.categoryId).toBe(category.id);
    expect((await POST(request("POST", { ...body, categoryId: null }), params)).status).toBe(201);
    expect(mocks.create.mock.calls[1][0].data.categoryId).toBeNull();
  });

  it("copies the source requirements unless the copy request gives its own", async () => {
    mocks.findFirst.mockResolvedValue({ layout: DEFAULT_LAYOUT, categoryId: null, requirements: "Висока интензивност." });
    const body = { title: "Копие", sourcePlanId: id, editorVersion: 2 };
    expect((await POST(request("POST", body), params)).status).toBe(201);
    expect(mocks.create.mock.calls[0][0].data.requirements).toBe("Висока интензивност.");
    expect((await POST(request("POST", { ...body, requirements: " " }), params)).status).toBe(201);
    expect(mocks.create.mock.calls[1][0].data.requirements).toBeNull();
  });

  it("saves trimmed requirements and rejects requirements over 700 characters", async () => {
    expect((await POST(request("POST", { title: "План", requirements: "а".repeat(701) }), params)).status).toBe(400);
    expect(mocks.create).not.toHaveBeenCalled();
    expect((await PUT(request("PUT", { requirements: "а".repeat(701), expectedUpdatedAt: revision }), params)).status).toBe(400);
    mocks.updateMany.mockClear();
    expect((await PUT(request("PUT", { requirements: " Без контакт. ", expectedUpdatedAt: revision }), params)).status).toBe(200);
    expect(mocks.updateMany.mock.calls.at(-1)?.[0].data.requirements).toBe("Без контакт.");
  });
});

describe("training image delivery", () => {
  it("rejects another club before reading image data", async () => {
    const { GET: image } = await import("@/app/api/admin/clubs/[id]/training-plans/images/[imageId]/route");
    mocks.verify.mockResolvedValue({ sub: id, roles: ["coach"], defaultClubId: otherClub });
    expect((await image(request("GET"), { params: Promise.resolve({ id: club, imageId: id }) })).status).toBe(403);
  });
});
