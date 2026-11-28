import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ prisma: {} }));

import {
  TRAINING_OTHER_GROUP_ERROR,
  TRAINING_VIEW_ONLY_ERROR,
  denyTrainingWrite,
  getTrainingWriteAccess,
  pageCoachGroupId,
  trainingTargetFromBody,
} from "./trainingWriteAccess";

const clubId = "b5d54111-4d5a-4d88-9ffa-8724a0328d47";
const ownGroup = "130b47c1-e129-4228-b725-6516d62d9497";
const otherGroup = "2c1b7f0e-8f7a-4d53-9a3e-0e5f3c2b1a90";
const customGroup = "7d453063-7ef4-4004-a59a-c20ae89f4cda";
const sessionId = "3a085f26-7cdb-403e-8856-939ebc006b12";
const coach = { roles: ["coach" as const] };
const admin = { roles: ["admin" as const] };

function fromPage(url?: string) {
  return { headers: new Headers(url ? { referer: url } : {}) };
}

function db(options: { ownCustomGroup?: boolean; session?: { scopeType: string; scopeId: string | null } | null } = {}) {
  return {
    coachGroup: { findFirst: vi.fn(async ({ where }: { where: { id: string } }) => ({ id: where.id })) },
    clubCustomTrainingGroup: {
      findFirst: vi.fn(async ({ where }: { where: { id: string; coachGroupId: string } }) =>
        options.ownCustomGroup && where.coachGroupId === ownGroup ? { id: where.id } : null),
    },
    trainingSession: { findFirst: vi.fn(async () => options.session ?? null) },
  };
}

const coachPage = `https://myteam7.com/admin/members?clubId=${clubId}&coachGroupId=${ownGroup}`;
const mainPage = `https://myteam7.com/admin/members?clubId=${clubId}`;

describe("page coach group", () => {
  it("reads the coach group from the page URL", () => {
    expect(pageCoachGroupId(fromPage(coachPage))).toBe(ownGroup);
    expect(pageCoachGroupId(fromPage(mainPage))).toBeNull();
    expect(pageCoachGroupId(fromPage())).toBeNull();
    expect(pageCoachGroupId(fromPage("not a url"))).toBeNull();
    expect(pageCoachGroupId(fromPage(`${mainPage}&coachGroupId=abc`))).toBeNull();
  });

  it("gives admins full access on every page", () => {
    expect(getTrainingWriteAccess(admin, fromPage(mainPage))).toEqual({ kind: "admin" });
    expect(getTrainingWriteAccess({ roles: ["admin", "coach"] }, fromPage())).toEqual({ kind: "admin" });
  });

  it("makes the main page view only for coaches", () => {
    expect(getTrainingWriteAccess(coach, fromPage(mainPage))).toEqual({ kind: "readOnly" });
    expect(getTrainingWriteAccess(coach, fromPage(coachPage))).toEqual({ kind: "coach", coachGroupId: ownGroup });
  });
});

describe("training write check", () => {
  it("allows admins to change any trainings", async () => {
    await expect(denyTrainingWrite(admin, fromPage(), clubId, { type: "clubWide" }, db())).resolves.toBeNull();
  });

  it("refuses every change from the main page for coaches", async () => {
    const response = await denyTrainingWrite(coach, fromPage(mainPage), clubId, { type: "coachGroup", id: ownGroup }, db());
    expect(response?.status).toBe(403);
    await expect(response?.json()).resolves.toEqual({ error: TRAINING_VIEW_ONLY_ERROR });
  });

  it("allows a coach page to change only its own coach group", async () => {
    await expect(denyTrainingWrite(coach, fromPage(coachPage), clubId, { type: "coachGroup", id: ownGroup }, db())).resolves.toBeNull();
    const response = await denyTrainingWrite(coach, fromPage(coachPage), clubId, { type: "coachGroup", id: otherGroup }, db());
    expect(response?.status).toBe(403);
    await expect(response?.json()).resolves.toEqual({ error: TRAINING_OTHER_GROUP_ERROR });
  });

  it("allows a coach page to change only custom groups of its coach group", async () => {
    await expect(denyTrainingWrite(coach, fromPage(coachPage), clubId, { type: "customGroup", id: customGroup }, db({ ownCustomGroup: true }))).resolves.toBeNull();
    const response = await denyTrainingWrite(coach, fromPage(coachPage), clubId, { type: "customGroup", id: customGroup }, db());
    expect(response?.status).toBe(403);
  });

  it("keeps club-wide trainings view only for coach pages", async () => {
    const response = await denyTrainingWrite(coach, fromPage(coachPage), clubId, { type: "clubWide" }, db());
    expect(response?.status).toBe(403);
  });
});

describe("training target from body", () => {
  it("uses the stored session's group", async () => {
    await expect(trainingTargetFromBody(clubId, { trainingSessionId: sessionId }, db({ session: { scopeType: "coachGroup", scopeId: otherGroup } })))
      .resolves.toEqual({ type: "coachGroup", id: otherGroup });
    await expect(trainingTargetFromBody(clubId, { trainingSessionId: sessionId }, db({ session: { scopeType: "teamGroup", scopeId: null } })))
      .resolves.toEqual({ type: "clubWide" });
    await expect(trainingTargetFromBody(clubId, { trainingSessionId: sessionId }, db({ session: null })))
      .resolves.toEqual({ type: "clubWide" });
  });

  it("uses the custom group, or the club for other scopes", async () => {
    await expect(trainingTargetFromBody(clubId, { customTrainingGroupId: customGroup }, db())).resolves.toEqual({ type: "customGroup", id: customGroup });
    await expect(trainingTargetFromBody(clubId, {}, db())).resolves.toEqual({ type: "clubWide" });
  });
});
