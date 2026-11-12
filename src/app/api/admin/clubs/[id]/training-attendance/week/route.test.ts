import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  club: vi.fn(),
  fields: vi.fn(),
  customGroups: vi.fn(),
  coachGroups: vi.fn(),
  teamSchedules: vi.fn(),
  sessions: vi.fn(),
  matches: vi.fn(),
  empty: vi.fn(),
}));

vi.mock("@/lib/adminAuth", () => ({ verifyAdminToken: mocks.auth }));
vi.mock("@/lib/db", () => ({ prisma: {
  club: { findUnique: mocks.club },
  clubTrainingGroupSchedule: { findMany: mocks.teamSchedules },
  clubTrainingScheduleGroup: { findMany: mocks.empty },
  clubCustomTrainingGroup: { findMany: mocks.customGroups },
  clubMatch: { findMany: mocks.matches },
  limitedTrainingEvent: { findMany: mocks.empty },
  coachGroup: { findMany: mocks.coachGroups },
  trainingSession: { findMany: mocks.sessions },
  field: { findMany: mocks.fields },
} }));

function request(query: string) {
  return GET(new NextRequest(
    `http://localhost/api/admin/clubs/club-1/training-attendance/week${query}`,
    { headers: { cookie: "admin_session=test" } },
  ), { params: Promise.resolve({ id: "club-1" }) });
}

describe("График 2 weekly schedule", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-10T12:00:00Z"));
    mocks.auth.mockResolvedValue({ roles: ["admin"] });
    mocks.club.mockResolvedValue({ id: "club-1", trainingGroupMode: "custom_group" });
    mocks.empty.mockResolvedValue([]);
    mocks.matches.mockResolvedValue([]);
    mocks.customGroups.mockResolvedValue([]);
    mocks.coachGroups.mockResolvedValue([]);
    mocks.teamSchedules.mockResolvedValue([]);
    mocks.sessions.mockImplementation(async ({ where }) => where.scopeType === "coachGroup" ? [{
      id: "session-1",
      scopeId: "coach-group-1",
      trainingDate: new Date("2026-11-17"),
      trainingTime: "18:00",
      trainingDurationMinutes: 90,
      trainingFieldId: "field-1",
      trainingFieldPieceIds: ["piece-1"],
    }] : []);
    mocks.fields.mockResolvedValue([{ id: "field-1", name: "Терен 1", pieces: [{ id: "piece-1", name: "Половина А" }] }]);
  });

  it("keeps stored Monday trainings after the group saves a future-only schedule", async () => {
    mocks.customGroups.mockResolvedValue([
      { id: "group-1", name: "Loko", trainingDates: ["2026-11-12"], trainingTime: "17:00" },
      { id: "cancelled", name: "Cancelled", trainingDates: ["2026-11-09"], trainingTime: "17:00" },
    ]);
    const monday = new Date("2026-11-09");
    mocks.sessions.mockImplementation(async ({ where }) => {
      if (where.status === "cancelled") {
        return [{ scopeKey: "custom_group:cancelled", trainingDate: monday }];
      }
      if (where.scopeType === "coachGroup" || where.scopeType === "customGroup") return [];
      return [{
        scopeKey: "custom_group:group-1", trainingDate: monday, trainingTime: "18:30",
        trainingDurationMinutes: 75, trainingFieldId: "field-1", trainingFieldPieceIds: ["piece-1"],
      }];
    });
    const response = await request("?view=schedule2");
    expect(response.status).toBe(200);
    const { sessions } = await response.json();
    expect(sessions).toContainEqual(expect.objectContaining({
      id: "2026-11-09-custom-group-1", trainingTime: "18:30",
      durationMinutes: 75, location: "Терен 1 · Половина А",
    }));
    expect(sessions).not.toContainEqual(expect.objectContaining({ id: "2026-11-09-custom-cancelled" }));
    expect(mocks.sessions).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        clubId: "club-1", occurrenceKey: "", removedFromSchedule: false,
        trainingDate: { in: expect.arrayContaining([monday]) },
      }),
    }));
  });

  afterEach(() => vi.useRealTimers());

  it("returns both coach sessions when they share a training date", async () => {
    mocks.sessions.mockImplementation(async ({ where }) => where.scopeType === "coachGroup" ? [
      { id: "first", scopeId: "coach-group-1", trainingDate: new Date("2026-11-17"), trainingTime: "16:00", trainingDurationMinutes: 60 },
      { id: "second", scopeId: "coach-group-1", trainingDate: new Date("2026-11-17"), trainingTime: "18:30", trainingDurationMinutes: 75 },
    ] : []);
    const response = await request("?view=schedule2&week=1");
    expect(response.status).toBe(200);
    const { sessions } = await response.json();
    expect(sessions).toEqual([
      expect.objectContaining({ id: "coach-coach-group-1-first", date: "2026-11-17", trainingTime: "16:00" }),
      expect.objectContaining({ id: "coach-coach-group-1-second", date: "2026-11-17", trainingTime: "18:30" }),
    ]);
  });

  it("rejects coaches before loading planner data while preserving their original schedule access", async () => {
    mocks.auth.mockResolvedValue({ roles: ["coach"] });
    expect((await request("?view=schedule2")).status).toBe(403);
    expect(mocks.club).not.toHaveBeenCalled();

    const response = await request("");
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.dates[0]).toBe("2026-11-10");
    expect(data.sessions[0]).not.toHaveProperty("fieldName");
    expect(data).not.toHaveProperty("customGroups");
    expect(data).not.toHaveProperty("matches");
    expect(mocks.fields).not.toHaveBeenCalled();
  });

  it("keeps Monday trainings and full match details available on Tuesday", async () => {
    mocks.customGroups.mockResolvedValue([
      { id: "explicit", name: "Explicit", trainingDates: ["2026-11-09"], trainingTime: "17:30" },
      { id: "recurring", name: "Recurring", trainingWeekdays: [1], trainingTime: "18:30" },
    ]);
    mocks.matches.mockImplementation(async ({ select }) => [{
      id: "monday-match", eventType: "match", matchDate: "2026-11-09", matchTime: "19:30",
      teamGroups: [], customGroupId: null, ...(select.description ? { description: "Monday details", homeScore: 2 } : {}),
    }]);

    const response = await request("?view=schedule2");
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.dates[0]).toBe("2026-11-09");
    expect(data.sessions.map(({ id }: { id: string }) => id)).toEqual(expect.arrayContaining([
      "2026-11-09-custom-explicit", "2026-11-09-custom-recurring", "match-monday-match",
    ]));
    expect(data.matches).toContainEqual(expect.objectContaining({
      id: "monday-match", description: "Monday details", homeScore: 2,
    }));
  });

  it("inherits the club pitch for a team schedule that only overrides time", async () => {
    mocks.club.mockResolvedValue({
      id: "club-1", trainingGroupMode: "team_group",
      trainingFieldId: "field-1", trainingFieldPieceIds: ["piece-1"],
    });
    mocks.teamSchedules.mockResolvedValue([{
      teamGroup: 2015, trainingDates: ["2026-11-18"], trainingTime: "17:00",
      trainingFieldId: null, trainingFieldPieceIds: [],
    }]);
    const response = await request("?view=schedule2&week=1");
    expect(response.status).toBe(200);
    expect((await response.json()).sessions).toContainEqual(expect.objectContaining({
      id: "2026-11-18-team-2015", trainingTime: "17:00", fieldName: "Терен 1", location: "Терен 1 · Половина А",
    }));
  });

  it("offers matches but no custom training creation in year mode", async () => {
    mocks.club.mockResolvedValue({ id: "club-1", trainingGroupMode: "team_group" });
    mocks.customGroups.mockResolvedValue([
      { id: "group-1", name: "Loko", trainingDates: ["2026-11-18"], trainingTime: "17:30" },
    ]);
    const response = await request("?view=schedule2&week=1");
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.customGroups).toContainEqual(expect.objectContaining({ id: "group-1" }));
    expect(data.canCreateCustomTraining).toBe(false);
    expect(data.sessions).not.toContainEqual(expect.objectContaining({ id: "2026-11-18-custom-group-1" }));
  });

  it("returns a Monday–Sunday week with pitch details scoped to the requested club", async () => {
    const response = await request("?view=schedule2&week=1");
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.dates).toHaveLength(7);
    expect(data.dates[0]).toBe("2026-11-16");
    expect(data.dates[6]).toBe("2026-11-22");
    expect(data.sessions[0]).toMatchObject({ fieldName: "Терен 1", location: "Терен 1 · Половина А" });
    expect(mocks.fields).toHaveBeenCalledWith(expect.objectContaining({ where: { clubId: "club-1" } }));
  });

  it("returns every custom group, its coach label, and the ID on its training", async () => {
    mocks.customGroups.mockResolvedValue([
      { id: "group-1", name: "Loko", coachGroupId: "coach-group-1", trainingDates: ["2026-11-18"], trainingTime: "17:30" },
      { id: "group-2", name: "Lemon", coachGroupId: null, trainingDates: [] },
    ]);
    mocks.coachGroups.mockResolvedValue([{ id: "coach-group-1", name: "Треньор на 2026" }]);
    const response = await request("?view=schedule2&week=1");
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.customGroups).toEqual([
      { id: "group-2", name: "Lemon", coachGroupId: null, coachName: null },
      { id: "group-1", name: "Loko", coachGroupId: "coach-group-1", coachName: "Треньор на 2026" },
    ]);
    expect(data.sessions).toContainEqual(expect.objectContaining({ customGroupId: "group-1", date: "2026-11-18", trainingTime: "17:30" }));
  });

  it("returns multiple distinct Schedule 2 sessions for an unlinked custom group on one day", async () => {
    mocks.customGroups.mockResolvedValue([{ id: "group-1", name: "Loko", coachGroupId: null, trainingDates: [] }]);
    mocks.sessions.mockImplementation(async ({ where }) => where.scopeType === "customGroup" ? [
      { id: "first", scopeId: "group-1", scopeKey: "custom_group:group-1:session:first", trainingDate: new Date("2026-11-18"), trainingTime: "17:00" },
      { id: "second", scopeId: "group-1", scopeKey: "custom_group:group-1:session:second", trainingDate: new Date("2026-11-18"), trainingTime: "19:00" },
    ] : []);
    const response = await request("?view=schedule2&week=1");
    expect((await response.json()).sessions).toEqual([
      expect.objectContaining({ id: "custom-session-group-1-first", customGroupId: "group-1", trainingTime: "17:00" }),
      expect.objectContaining({ id: "custom-session-group-1-second", customGroupId: "group-1", trainingTime: "19:00" }),
    ]);
    expect((await (await request("")).json()).sessions).toEqual([]);
  });

  it.each(["custom_group", "team_group"])("loads custom group matches in %s mode without a match coach column", async (trainingGroupMode) => {
    mocks.club.mockResolvedValue({ id: "club-1", trainingGroupMode });
    mocks.matches.mockImplementation(async ({ select }) => {
      if (select.coachGroupId) throw new Error("club_matches.coach_group_id does not exist");
      return [{
        id: "match-1", eventType: "match", opponent: "Академик", location: "Стадион",
        matchDate: "2026-11-18", matchTime: "17:30", teamGroups: [],
        customGroupId: "group-1", customGroup: { name: "Loko" },
      }];
    });

    const response = await request("?view=schedule2&week=1");
    expect(response.status).toBe(200);
    expect((await response.json()).sessions).toContainEqual(expect.objectContaining({
      id: "match-match-1", customGroupId: "group-1", scopeLabel: "Loko", date: "2026-11-18",
    }));
  });

  it("rejects out-of-range weeks before querying the database", async () => {
    expect((await request("?view=schedule2&week=100")).status).toBe(400);
    expect(mocks.club).not.toHaveBeenCalled();
  });
});
