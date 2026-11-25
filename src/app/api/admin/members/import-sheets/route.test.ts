import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "./route";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  token: vi.fn(),
  groupCount: vi.fn(),
  coachGroup: vi.fn(),
  club: vi.fn(),
  playerCreate: vi.fn(),
  membershipUpdate: vi.fn(),
}));

vi.mock("@/lib/adminAuth", () => ({ verifyAdminToken: mocks.auth }));
vi.mock("@/lib/googleAuth", () => ({ getGoogleServiceAccountToken: mocks.token }));
vi.mock("@/lib/db", () => {
  const tx = {
    player: { create: mocks.playerCreate },
    attendanceMembership: { updateMany: mocks.membershipUpdate },
  };
  return {
    prisma: {
      clubCustomTrainingGroup: { count: mocks.groupCount },
      coachGroup: { findFirst: mocks.coachGroup },
      club: { findUnique: mocks.club },
      $transaction: (fn: (client: typeof tx) => Promise<unknown>) => fn(tx),
    },
  };
});

const clubId = "10000000-0000-4000-8000-000000000001";
const coachGroupId = "10000000-0000-4000-8000-000000000002";
const groupA = "20000000-0000-4000-8000-00000000000a";
const groupB = "20000000-0000-4000-8000-00000000000b";

const sheet = [
  ["Име, фамилия", "Роден", "№"],
  ["Иван Петров", "01.02.2015", "7"],
  ["Георги Токов", "03.04.2016", ""],
  ["Мартин Велков", "05.06.2015", "9"],
];

function request(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/admin/members/import-sheets", {
    method: "POST",
    headers: { cookie: "admin_session=test", "Content-Type": "application/json" },
    body: JSON.stringify({ spreadsheetId: "sheet-1", clubId, ...body }),
  });
}

function createdGroupIds() {
  return mocks.playerCreate.mock.calls.map(([args]) => {
    const create = args.data.customTrainingGroups?.create as Array<{ groupId: string }> | undefined;
    return { name: args.data.fullName as string, groups: create?.map((g) => g.groupId) ?? [] };
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.mockResolvedValue({ sub: "admin", roles: ["admin"] });
  mocks.token.mockResolvedValue("google-token");
  mocks.club.mockResolvedValue({ id: clubId, billingStatus: "demo", firstBillingMonth: null, defaultPaymentAmount: null });
  mocks.coachGroup.mockResolvedValue({ id: coachGroupId });
  mocks.playerCreate.mockImplementation(async ({ data }) => ({ id: `player-${data.fullName}` }));
  mocks.membershipUpdate.mockResolvedValue({ count: 0 });
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ values: sheet }), { status: 200 })));
});

afterEach(() => vi.unstubAllGlobals());

describe("POST /api/admin/members/import-sheets custom groups", () => {
  it("imports without groups as before when no assignments are sent", async () => {
    const response = await POST(request({}));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ created: 3, skipped: 0 });
    expect(mocks.groupCount).not.toHaveBeenCalled();
    expect(createdGroupIds().every((p) => p.groups.length === 0)).toBe(true);
  });

  it("adds each player only to the groups selected for that player", async () => {
    mocks.groupCount.mockResolvedValue(2);
    const response = await POST(request({
      groupAssignments: [
        { rowIndex: 2, fullName: "Иван Петров", birthDateIso: "2015-02-01T00:00:00.000Z", jerseyNumber: "7", groupIds: [groupA, groupB] },
        { rowIndex: 4, fullName: "Мартин Велков", birthDateIso: "2015-06-05T00:00:00.000Z", jerseyNumber: "9", groupIds: [groupB] },
        { rowIndex: 3, fullName: "Георги Токов", birthDateIso: "2016-04-03T00:00:00.000Z", jerseyNumber: null, groupIds: [] },
      ],
    }));
    expect(response.status).toBe(200);
    expect(createdGroupIds()).toEqual([
      { name: "Иван Петров", groups: [groupA, groupB] },
      { name: "Георги Токов", groups: [] },
      { name: "Мартин Велков", groups: [groupB] },
    ]);
  });

  it("checks that groups belong to the club and the main-club scope", async () => {
    mocks.groupCount.mockResolvedValue(1);
    await POST(request({ groupAssignments: [{ rowIndex: 2, fullName: "Иван Петров", birthDateIso: "2015-02-01T00:00:00.000Z", jerseyNumber: "7", groupIds: [groupA] }] }));
    expect(mocks.groupCount).toHaveBeenCalledWith({ where: { id: { in: [groupA] }, clubId, coachGroupId: null } });
  });

  it("checks that groups belong to the coach group when importing into one", async () => {
    mocks.groupCount.mockResolvedValue(1);
    const response = await POST(request({
      coachGroupId,
      groupAssignments: [{ rowIndex: 2, fullName: "Иван Петров", birthDateIso: "2015-02-01T00:00:00.000Z", jerseyNumber: "7", groupIds: [groupA] }],
    }));
    expect(response.status).toBe(200);
    expect(mocks.groupCount).toHaveBeenCalledWith({ where: { id: { in: [groupA] }, clubId, coachGroupId } });
    expect(mocks.playerCreate.mock.calls[0][0].data.coachGroups).toEqual({ connect: [{ id: coachGroupId }] });
  });

  it("rejects groups from another club or scope without creating players", async () => {
    mocks.groupCount.mockResolvedValue(1);
    const response = await POST(request({
      groupAssignments: [{ rowIndex: 2, fullName: "Иван Петров", birthDateIso: "2015-02-01T00:00:00.000Z", jerseyNumber: "7", groupIds: [groupA, groupB] }],
    }));
    expect(response.status).toBe(404);
    expect(mocks.playerCreate).not.toHaveBeenCalled();
  });

  it("rejects the import when the sheet changed after the preview", async () => {
    mocks.groupCount.mockResolvedValue(1);
    const response = await POST(request({
      groupAssignments: [{ rowIndex: 2, fullName: "Друго Име", birthDateIso: "2015-02-01T00:00:00.000Z", jerseyNumber: "7", groupIds: [groupA] }],
    }));
    expect(response.status).toBe(409);
    expect(mocks.playerCreate).not.toHaveBeenCalled();
  });

  it("rejects a coach importing into a club outside the session before any write", async () => {
    mocks.auth.mockResolvedValue({ sub: "coach", roles: ["coach"], defaultClubId: "10000000-0000-4000-8000-0000000000ff" });
    mocks.groupCount.mockResolvedValue(1);
    const response = await POST(request({
      groupAssignments: [{ rowIndex: 2, fullName: "Иван Петров", birthDateIso: "2015-02-01T00:00:00.000Z", jerseyNumber: "7", groupIds: [groupA] }],
    }));
    expect(response.status).toBe(403);
    expect(mocks.groupCount).not.toHaveBeenCalled();
    expect(mocks.playerCreate).not.toHaveBeenCalled();
  });

  it("rejects a coach previewing billing data of another club", async () => {
    mocks.auth.mockResolvedValue({ sub: "coach", roles: ["coach"], defaultClubId: "10000000-0000-4000-8000-0000000000ff" });
    const response = await GET(new NextRequest(
      `http://localhost/api/admin/members/import-sheets?spreadsheetId=sheet-1&clubId=${clubId}`,
      { headers: { cookie: "admin_session=test" } },
    ));
    expect(response.status).toBe(403);
    expect(mocks.club).not.toHaveBeenCalled();
  });

  it("allows a coach to import into the session club", async () => {
    mocks.auth.mockResolvedValue({ sub: "coach", roles: ["coach"], defaultClubId: clubId });
    expect((await POST(request({}))).status).toBe(200);
  });

  it("rejects the import when same-named rows were swapped after the preview", async () => {
    const twins = [
      ["Име, фамилия", "Роден", "№"],
      ["Иван Петров", "05.05.2016", "11"],
      ["Иван Петров", "01.02.2015", "7"],
    ];
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ values: twins }), { status: 200 })));
    mocks.groupCount.mockResolvedValue(1);
    // The preview showed the 2015 player on row 2; the sheet now has the 2016 player there.
    const response = await POST(request({
      groupAssignments: [{ rowIndex: 2, fullName: "Иван Петров", birthDateIso: "2015-02-01T00:00:00.000Z", jerseyNumber: "7", groupIds: [groupA] }],
    }));
    expect(response.status).toBe(409);
    expect(mocks.playerCreate).not.toHaveBeenCalled();
  });

  it("accepts assignments built from the GET preview rows, as the modal sends them", async () => {
    const preview = await GET(new NextRequest(
      `http://localhost/api/admin/members/import-sheets?spreadsheetId=sheet-1&clubId=${clubId}`,
      { headers: { cookie: "admin_session=test" } },
    ));
    const { rows } = await preview.json() as { rows: Array<{ rowIndex: number; fullName: string; birthDateIso: string | null; jerseyNumber: string | null }> };
    mocks.groupCount.mockResolvedValue(1);
    const response = await POST(request({
      groupAssignments: rows.map((row) => ({
        rowIndex: row.rowIndex,
        fullName: row.fullName,
        birthDateIso: row.birthDateIso,
        jerseyNumber: row.jerseyNumber,
        groupIds: [groupA],
      })),
    }));
    expect(response.status).toBe(200);
    expect(createdGroupIds().every((p) => p.groups[0] === groupA)).toBe(true);
  });

  it("rejects malformed assignments", async () => {
    for (const groupAssignments of [
      "bad",
      [{ rowIndex: 2, fullName: "Иван Петров", birthDateIso: "2015-02-01T00:00:00.000Z", jerseyNumber: "7", groupIds: ["not-a-uuid"] }],
      [{ rowIndex: 2, fullName: "Иван Петров", groupIds: [groupA] }],
      [{ rowIndex: "2", fullName: "Иван Петров", birthDateIso: "2015-02-01T00:00:00.000Z", jerseyNumber: "7", groupIds: [groupA] }],
      [{ rowIndex: 2, fullName: "Иван Петров", birthDateIso: "2015-02-01T00:00:00.000Z", jerseyNumber: "7", groupIds: [groupA] }, { rowIndex: 2, fullName: "Иван Петров", birthDateIso: "2015-02-01T00:00:00.000Z", jerseyNumber: "7", groupIds: [groupB] }],
    ]) {
      expect((await POST(request({ groupAssignments }))).status).toBe(400);
    }
    expect(mocks.playerCreate).not.toHaveBeenCalled();
  });
});
