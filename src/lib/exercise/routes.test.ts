import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { DEFAULT_LAYOUT } from "@/lib/trainingPlans";
import { EMPTY_EXERCISE } from "./model";
const mocks = vi.hoisted(() => ({
  verify: vi.fn(),
  findMany: vi.fn(),
  findFirst: vi.fn(),
  findUnique: vi.fn(),
  create: vi.fn(),
  updateMany: vi.fn(),
  delete: vi.fn(),
  club: vi.fn(),
  transaction: vi.fn(),
  queryRaw: vi.fn(),
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
  layout: EMPTY_EXERCISE,
  updatedAt: new Date(revision),
  createdAt: new Date(revision),
};
function request(
  method: string,
  body?: unknown,
  origin = "http://localhost:3000",
) {
  return new NextRequest(
    `http://localhost:3000/api/admin/clubs/${club}/training-plans/${id}`,
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
      trainingPlan: {
        updateMany: mocks.updateMany,
        findUnique: mocks.findUnique,
      },
    }),
  );
});
afterEach(() => vi.unstubAllEnvs());
describe("training plan access and persistence", () => {
  it("creates a local Konva plan in development with a configured production URL", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("APP_BASE_URL", "https://myteam7.com");
    const response = await POST(request("POST", { title: "Тест", editorVersion: 2 }), params);
    expect(response.status).toBe(201);
    expect(mocks.create).toHaveBeenCalled();
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
      select: { layout: true },
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
    ).toBe(200);
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
