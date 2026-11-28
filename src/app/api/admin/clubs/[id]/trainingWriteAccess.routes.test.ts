import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  transaction: vi.fn(),
  coachGroupFind: vi.fn(),
  customGroupFind: vi.fn(),
  sessionFind: vi.fn(),
  clubFind: vi.fn(),
}));

vi.mock("@/lib/adminAuth", () => ({ verifyAdminToken: mocks.auth }));
vi.mock("@/lib/push/coachTrainingNotifications", () => ({ notifyCoachTrainingChanges: async () => undefined }));
vi.mock("@/lib/trainingAttendanceEvents", () => ({ publishTrainingAttendanceUpdated: () => undefined }));
vi.mock("@/lib/db", () => ({
  prisma: {
    $transaction: mocks.transaction,
    coachGroup: { findFirst: mocks.coachGroupFind },
    clubCustomTrainingGroup: { findFirst: mocks.customGroupFind },
    trainingSession: { findFirst: mocks.sessionFind, findMany: async () => [], upsert: mocks.transaction },
    club: { findUnique: mocks.clubFind },
  },
}));

import * as sessionRoute from "./training-attendance/session/route";
import * as attendanceRoute from "./training-attendance/route";
import * as coachScheduleRoute from "./coach-groups/[groupId]/schedule/route";
import * as schedulerRoute from "./scheduler/route";
import * as trainingGroupsRoute from "./training-groups/route";
import * as trainingGroupRoute from "./training-groups/[groupId]/route";
import * as customGroupsRoute from "./custom-training-groups/route";
import * as customGroupRoute from "./custom-training-groups/[groupId]/route";
import * as schedule2SessionsRoute from "./custom-training-groups/[groupId]/schedule2-sessions/route";
import * as weekRoute from "./training-attendance/week/route";

const clubId = "b5d54111-4d5a-4d88-9ffa-8724a0328d47";
const ownGroup = "130b47c1-e129-4228-b725-6516d62d9497";
const otherGroup = "2c1b7f0e-8f7a-4d53-9a3e-0e5f3c2b1a90";
const customGroup = "7d453063-7ef4-4004-a59a-c20ae89f4cda";
const sessionId = "3a085f26-7cdb-403e-8856-939ebc006b12";
const mainPage = `https://myteam7.com/admin/members?clubId=${clubId}`;
const coachPage = `${mainPage}&coachGroupId=${ownGroup}`;

function request(method: string, body: unknown, referer: string) {
  return new NextRequest("http://localhost:3000/api/test", {
    method,
    headers: new Headers({ cookie: "admin_session=test", referer, "content-type": "application/json" }),
    body: JSON.stringify(body),
  });
}

const club = { params: Promise.resolve({ id: clubId }) };
const coachGroup = (groupId: string) => ({ params: Promise.resolve({ id: clubId, groupId }) });

type Case = {
  name: string;
  call: (referer: string) => Promise<Response>;
};

const cases: Case[] = [
  { name: "cancel a training", call: (referer) => sessionRoute.PATCH(request("PATCH", { date: "2026-12-01", status: "cancelled", trainingSessionId: sessionId }, referer), club) },
  { name: "delete a training", call: (referer) => sessionRoute.DELETE(request("DELETE", { date: "2026-12-01", trainingSessionId: sessionId }, referer), club) },
  { name: "save a training note", call: (referer) => attendanceRoute.PUT(request("PUT", { trainingDate: "2026-12-01", note: "x", trainingSessionId: sessionId }, referer), club) },
  { name: "save a coach-group schedule", call: (referer) => coachScheduleRoute.PUT(request("PUT", { trainings: [], version: "v" }, referer), coachGroup(otherGroup)) },
  { name: "create a custom group", call: (referer) => customGroupsRoute.POST(request("POST", { name: "Група", coachGroupId: otherGroup }, referer), club) },
  { name: "change a custom group", call: (referer) => customGroupRoute.PATCH(request("PATCH", { trainingDates: [] }, referer), coachGroup(customGroup)) },
  { name: "delete a custom group", call: (referer) => customGroupRoute.DELETE(request("DELETE", {}, referer), coachGroup(customGroup)) },
];

const clubWideCases: Case[] = [
  { name: "save club training days", call: (referer) => schedulerRoute.PUT(request("PUT", {}, referer), club) },
  { name: "create a training group", call: (referer) => trainingGroupsRoute.POST(request("POST", { teamGroups: [2014, 2015] }, referer), club) },
  { name: "change a training group", call: (referer) => trainingGroupRoute.PATCH(request("PATCH", {}, referer), coachGroup(customGroup)) },
  { name: "delete a training group", call: (referer) => trainingGroupRoute.DELETE(request("DELETE", {}, referer), coachGroup(customGroup)) },
  { name: "cancel a club-wide training", call: (referer) => sessionRoute.PATCH(request("PATCH", { date: "2026-12-01", status: "cancelled", teamGroup: 2015 }, referer), club) },
];

describe("coach training write access", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.auth.mockResolvedValue({ sub: "coach", roles: ["coach"] });
    // The session, custom group and coach group all belong to another coach group.
    mocks.sessionFind.mockResolvedValue({ scopeType: "coachGroup", scopeId: otherGroup });
    mocks.customGroupFind.mockImplementation(async ({ where }: { where: { coachGroupId?: string } }) =>
      where.coachGroupId === ownGroup ? null : { id: customGroup });
    mocks.coachGroupFind.mockImplementation(async ({ where }: { where: { id: string } }) => ({ id: where.id, clubId, updatedAt: new Date() }));
  });

  it.each([...cases, ...clubWideCases])("refuses to $name from the main page", async ({ call }) => {
    const response = await call(mainPage);
    expect(response.status).toBe(403);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it.each([...cases, ...clubWideCases])("refuses to $name for another group from a coach page", async ({ call }) => {
    const response = await call(coachPage);
    expect(response.status).toBe(403);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("lets a coach page cancel its own coach group's training", async () => {
    mocks.sessionFind.mockResolvedValue({ id: sessionId, scopeType: "coachGroup", scopeId: ownGroup, trainingDate: new Date("2026-12-01T00:00:00Z") });
    const response = await sessionRoute.PATCH(
      request("PATCH", { date: "2026-12-01", status: "cancelled", trainingSessionId: sessionId }, coachPage),
      club,
    );
    expect(response.status).not.toBe(403);
    expect(mocks.transaction).toHaveBeenCalled();
  });

  it("lets admins cancel any training from the main page", async () => {
    mocks.auth.mockResolvedValue({ sub: "admin", roles: ["admin"] });
    mocks.sessionFind.mockResolvedValue({ id: sessionId, scopeType: "coachGroup", scopeId: otherGroup, trainingDate: new Date("2026-12-01T00:00:00Z") });
    const response = await sessionRoute.PATCH(
      request("PATCH", { date: "2026-12-01", status: "cancelled", trainingSessionId: sessionId }, mainPage),
      club,
    );
    expect(response.status).not.toBe(403);
    expect(mocks.transaction).toHaveBeenCalled();
  });
});

describe("coach access to the new schedule view", () => {
  const schedule2Club = "4fed63dd-fbe2-42e8-a8bc-c7036496a3e5";
  const schedule2Page = `https://myteam7.com/admin/members?clubId=${schedule2Club}`;
  const groupParams = { params: Promise.resolve({ id: schedule2Club, groupId: customGroup }) };
  const event = { sessions: [{ date: "2026-12-01", time: "17:00", duration: 60 }] };

  beforeEach(() => {
    vi.resetAllMocks();
    mocks.auth.mockResolvedValue({ sub: "coach", roles: ["coach"] });
    mocks.customGroupFind.mockImplementation(async ({ where }: { where: { coachGroupId?: string } }) =>
      where.coachGroupId === ownGroup ? { id: customGroup } : null);
  });

  it("refuses the new view to coaches of other clubs", async () => {
    const response = await weekRoute.GET(new NextRequest(`http://localhost:3000/api/test?view=schedule2`, {
      headers: new Headers({ cookie: "admin_session=test" }),
    }), club);
    expect(response.status).toBe(403);
  });

  it("refuses new-view events from the main page", async () => {
    const response = await schedule2SessionsRoute.POST(request("POST", event, schedule2Page), groupParams);
    expect(response.status).toBe(403);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("refuses new-view events for another coach's group", async () => {
    const response = await schedule2SessionsRoute.POST(
      request("POST", event, `${schedule2Page}&coachGroupId=${otherGroup}`),
      groupParams,
    );
    expect(response.status).toBe(403);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("lets a coach page add events to its own group", async () => {
    await schedule2SessionsRoute.POST(request("POST", event, `${schedule2Page}&coachGroupId=${ownGroup}`), groupParams);
    expect(mocks.transaction).toHaveBeenCalled();
  });
});
