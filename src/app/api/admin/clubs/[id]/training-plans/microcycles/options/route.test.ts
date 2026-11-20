import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const mocks = vi.hoisted(() => ({ authorize: vi.fn(), coachGroup: vi.fn(), groups: vi.fn(), query: vi.fn() }));
vi.mock("@/lib/exercise/access", async (original) => ({
  ...await original<typeof import("@/lib/exercise/access")>(),
  authorizeTraining: mocks.authorize,
  findTrainingPlanCoachGroup: mocks.coachGroup,
}));
vi.mock("@/lib/exercise/microcycleGroups", () => ({ microcycleGroups: mocks.groups }));
vi.mock("@/lib/db", () => ({ prisma: { $queryRaw: mocks.query } }));

import { GET } from "./route";

const clubId = "11111111-1111-4111-8111-111111111111";
const coach = "33333333-3333-4333-8333-333333333333";
const group = "custom:77777777-7777-4777-8777-777777777777";
const row = "66666666-6666-4666-8666-666666666666";
const get = (query = `?coachGroupId=${coach}`) =>
  GET(new NextRequest(`http://localhost/api/admin/clubs/${clubId}/training-plans/microcycles/options${query}`), { params: Promise.resolve({ id: clubId }) });

beforeEach(() => {
  vi.resetAllMocks();
  mocks.authorize.mockResolvedValue({ sub: "user" });
  mocks.coachGroup.mockResolvedValue({ id: coach });
  mocks.groups.mockResolvedValue({ groups: [{ key: group, name: "U12", coach: { id: coach, name: "Треньор" } }] });
});

describe("GET microcycle options", () => {
  it("returns the numbers and training IDs of the coach's microcycles", async () => {
    mocks.query.mockResolvedValue([
      { id: "c1", group_key: group, week: "2026-11-16", number: "3", rows: [row.toUpperCase()] },
      { id: "c2", group_key: group, week: "2026-11-09", number: 4, rows: [] },
      { id: "c3", group_key: group, week: "2026-11-02", number: "2", rows: ["bad"] },
    ]);
    const response = await get();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      groups: [{ key: group, name: "U12" }],
      cycles: [{ id: "c1", groupKey: group, week: "2026-11-16", number: "3", rows: [row] }],
    });
    expect(mocks.groups).toHaveBeenCalledWith(clubId, coach);
  });

  it.each(["", "?coachGroupId=bad"])("rejects a request without a valid coach group %s", async (query) => {
    expect((await get(query)).status).toBe(404);
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("rejects a coach group from another club", async () => {
    mocks.coachGroup.mockResolvedValue(null);
    expect((await get()).status).toBe(404);
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("returns the authorization error", async () => {
    mocks.authorize.mockResolvedValue(NextResponse.json({ error: "Необходим е вход." }, { status: 401 }));
    expect((await get()).status).toBe(401);
  });

  it("does not read microcycles when the coach has no groups", async () => {
    mocks.groups.mockResolvedValue({ groups: [] });
    expect(await (await get()).json()).toEqual({ groups: [], cycles: [] });
    expect(mocks.query).not.toHaveBeenCalled();
  });
});
