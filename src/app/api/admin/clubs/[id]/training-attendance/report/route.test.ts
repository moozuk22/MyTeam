import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(), club: vi.fn(), coach: vi.fn(), player: vi.fn(), players: vi.fn(),
  schedule: vi.fn(), combined: vi.fn(), custom: vi.fn(), customGroups: vi.fn(),
  sessions: vi.fn(), optOuts: vi.fn(),
}));
vi.mock("@/lib/adminAuth", () => ({ verifyAdminToken: mocks.auth }));
vi.mock("@/lib/db", () => ({ prisma: {
  club: { findUnique: mocks.club },
  coachGroup: { findFirst: mocks.coach },
  player: { findFirst: mocks.player, findMany: mocks.players },
  clubTrainingGroupSchedule: { findUnique: mocks.schedule },
  clubTrainingScheduleGroup: { findFirst: mocks.combined },
  clubCustomTrainingGroup: { findFirst: mocks.custom, findMany: mocks.customGroups },
  trainingSession: { findMany: mocks.sessions },
  trainingOptOut: { findMany: mocks.optOuts },
} }));

async function report(query: string, from = "2026-10-01", to = "2026-10-09") {
  return GET(new NextRequest(
    `http://localhost/api/admin/clubs/club-1/training-attendance/report?from=${from}&to=${to}&${query}`,
    { headers: { cookie: "admin_session=test" } },
  ), { params: Promise.resolve({ id: "club-1" }) });
}

describe("individual attendance report", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.auth.mockResolvedValue({ roles: ["admin"] });
    mocks.club.mockResolvedValue({ id: "club-1", trainingGroupMode: "custom_group", trainingDates: [], trainingWeekdays: [] });
    mocks.player.mockResolvedValue({ id: "player-1", fullName: "Играч", teamGroup: 2012 });
    mocks.players.mockResolvedValue([]);
    mocks.schedule.mockResolvedValue(null);
    mocks.combined.mockResolvedValue(null);
    mocks.customGroups.mockResolvedValue([]);
    mocks.sessions.mockResolvedValue([]);
    mocks.optOuts.mockResolvedValue([]);
  });

  it.each([false, true])("excludes unrelated club dates from a coach-group report, stored=%s", async (hasSession) => {
    const groupId = "10000000-0000-4000-8000-000000000002";
    mocks.club.mockResolvedValue({ id: "club-1", trainingGroupMode: "team_group", trainingDates: ["2026-10-03"], trainingWeekdays: [] });
    mocks.coach.mockResolvedValue({ id: groupId });
    mocks.players.mockResolvedValue([{ id: "player-1", fullName: "Player", teamGroup: null }]);
    mocks.sessions.mockResolvedValue(hasSession ? [{ id: "session", scopeType: "coachGroup", scopeKey: `coach_group:${groupId}`, trainingDate: new Date("2026-10-02"), trainingTime: "18:00", players: [{ playerId: "player-1", present: true, reasonCode: null }] }] : []);
    const response = await report(`coachGroupId=${groupId}`);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.trainingDates).toEqual(hasSession ? ["2026-10-02T18:00#session"] : []);
    expect(Object.keys(data.players[0].attendance).sort()).toEqual([...data.trainingDates].sort());
  });
  it("includes stored sessions from custom and combined groups and preserves attendance", async () => {
    mocks.sessions.mockResolvedValue([
      { trainingDate: new Date("2026-10-02T00:00:00Z"), players: [
        { playerId: "player-1", present: true, reasonCode: null },
      ] },
      { trainingDate: new Date("2026-10-05T00:00:00Z"), players: [
        { playerId: "player-1", present: false, reasonCode: "sick" },
      ] },
    ]);
    const response = await report("playerId=player-1");
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.trainingDates).toEqual(["2026-10-02", "2026-10-05"]);
    expect(data.players).toHaveLength(1);
    expect(data.players[0].attendance).toEqual({
      "2026-10-02": { present: true, reasonCode: null },
      "2026-10-05": { present: false, reasonCode: "sick" },
    });
    const where = mocks.sessions.mock.calls[0][0].where;
    expect(where).toMatchObject({ clubId: "club-1", players: { some: { playerId: "player-1" } }, status: { not: "cancelled" } });
    expect(where).not.toHaveProperty("scopeKey");
  });

  it.each(["2025-10-21", "2021-10-21"])("returns the entire requested history starting %s", async (from) => {
    mocks.sessions.mockResolvedValue([from, "2026-10-21"].map((date) => ({
      trainingDate: new Date(`${date}T00:00:00Z`),
      players: [{ playerId: "player-1", present: true, reasonCode: null }],
    })));
    const response = await report("playerId=player-1", from, "2026-10-21");
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.trainingDates).toEqual([from, "2026-10-21"]);
    expect(Object.keys(data.players[0].attendance)).toEqual([from, "2026-10-21"]);
    expect(mocks.sessions.mock.calls[0][0].where).toMatchObject({
      clubId: "club-1",
      trainingDate: { gte: new Date(`${from}T00:00:00Z`), lte: new Date("2026-10-21T00:00:00Z") },
    });
  });

  it.each([["bad", "2026-10-21"], ["2026-10-21", "2026-10-01"]])("still rejects invalid or reversed dates: %s to %s", async (from, to) => {
    expect((await report("", from, to)).status).toBe(400);
    expect(mocks.club).not.toHaveBeenCalled();
  });

  it("uses all of the player's custom schedules and absence records", async () => {
    mocks.schedule.mockResolvedValue({ trainingDates: ["2026-10-01"], trainingWeekdays: [] });
    mocks.customGroups.mockResolvedValue([
      { trainingDates: ["2026-10-02"], trainingWeekdays: [] },
      { trainingDates: ["2026-10-05"], trainingWeekdays: [] },
    ]);
    mocks.optOuts.mockResolvedValue([
      { playerId: "player-1", trainingDate: new Date("2026-10-05T00:00:00Z"), reasonCode: "injury" },
    ]);
    const data = await (await report("playerId=player-1")).json();
    expect(data.trainingDates).toEqual(["2026-10-02", "2026-10-05"]);
    expect(data.players[0].attendance["2026-10-05"]).toEqual({ present: false, reasonCode: "injury" });
    expect(mocks.customGroups.mock.calls[0][0].where).toEqual({ clubId: "club-1", players: { some: { playerId: "player-1" } } });
  });

  it("keeps the team report scoped to the selected group", async () => {
    mocks.custom.mockResolvedValue({ id: "custom-1", trainingDates: ["2026-10-02"], trainingWeekdays: [], players: [] });
    const response = await report("customTrainingGroupId=custom-1");
    expect(response.status).toBe(200);
    expect(mocks.sessions.mock.calls[0][0].where.scopeKey).toBe("custom_group:custom-1");
    expect(mocks.customGroups).not.toHaveBeenCalled();
  });

  it("returns the selected group scope for an unstored group-report training", async () => {
    const groupId = "10000000-0000-4000-8000-000000000005";
    mocks.custom.mockResolvedValue({ id: groupId, trainingDates: ["2026-10-02"], trainingWeekdays: [], trainingTime: "18:00", players: [{ playerId: "player-1" }] });
    mocks.players.mockResolvedValue([{ id: "player-1", fullName: "Player", teamGroup: null }]);
    const response = await report(`customTrainingGroupId=${groupId}`);
    expect(response.status).toBe(200);
    const data = await response.json();
    const target = `2026-10-02T18:00#custom_group:${groupId}`;
    expect(data.trainingDates).toEqual([target]);
    expect(data.players[0].attendance[target]).toEqual({ present: true, reasonCode: null });
  });
  it("rejects a player outside the selected club or coach group", async () => {
    mocks.coach.mockResolvedValue({ id: "coach-1" });
    mocks.player.mockResolvedValue(null);
    const response = await report("playerId=player-1&coachGroupId=coach-1");
    expect(response.status).toBe(404);
    expect(mocks.player.mock.calls[0][0].where).toMatchObject({ clubId: "club-1", OR: [
      { coachGroups: { some: { id: "coach-1" } } },
      { attendanceMemberships: { some: { scopeKey: "coach_group:coach-1" } } },
    ] });
    expect(mocks.sessions).not.toHaveBeenCalled();
  });

  it("preserves team dates when custom memberships remain in team-group mode", async () => {
    mocks.club.mockResolvedValue({ id: "club-1", trainingGroupMode: "team_group", trainingDates: [], trainingWeekdays: [] });
    mocks.schedule.mockResolvedValue({ trainingDates: ["2026-10-01"], trainingWeekdays: [] });
    mocks.customGroups.mockResolvedValue([{ trainingDates: ["2026-10-02"], trainingWeekdays: [] }]);
    const data = await (await report("playerId=player-1")).json();
    expect(data.trainingDates).toEqual(["2026-10-01"]);
    expect(mocks.customGroups).not.toHaveBeenCalled();
  });

  it.each([false, true])("provides separate targets for two scheduled custom trainings, stored=%s", async (stored) => {
    mocks.customGroups.mockResolvedValue(["a", "b"].map((id) => ({ id, trainingDates: ["2026-10-02"], trainingWeekdays: [], trainingTime: "09:00" })));
    mocks.sessions.mockResolvedValue(stored ? [{ id: "session-a", scopeKey: "custom_group:a", trainingDate: new Date("2026-10-02"), trainingTime: "09:00", players: [{ playerId: "player-1", present: false, reasonCode: "sick", attendanceRecorded: true }] }] : []);
    const data = await (await report("playerId=player-1")).json();
    expect(data.trainingDates).toEqual([`2026-10-02T09:00#${stored ? "session-a" : "custom_group:a"}`, "2026-10-02T09:00#custom_group:b"].sort());
    expect(Object.keys(data.players[0].attendance).sort()).toEqual([...data.trainingDates].sort());
  });
  it.each(["calendar_month", "training_credits"])("preserves legacy absence for missing session rows in %s", async (paymentWorkflow) => {
    mocks.club.mockResolvedValue({ id: "club-1", trainingGroupMode: "custom_group", trainingDates: [], trainingWeekdays: [], paymentWorkflow });
    mocks.sessions.mockResolvedValue([
      { id: "missing", scopeKey: "custom_group:a", trainingDate: new Date("2026-10-02"), trainingTime: "09:00", players: [] },
      { id: "present", scopeKey: "custom_group:b", trainingDate: new Date("2026-10-02"), trainingTime: "18:00", players: [{ playerId: "player-1", present: true, attendanceRecorded: true, reasonCode: null }] },
      { id: "absent", scopeKey: "custom_group:c", trainingDate: new Date("2026-10-02"), trainingTime: "19:00", players: [{ playerId: "player-1", present: false, attendanceRecorded: true, reasonCode: "injury" }] },
    ]);
    mocks.optOuts.mockResolvedValue([{ playerId: "player-1", trainingDate: new Date("2026-10-02"), reasonCode: "sick" }]);
    const data = await (await report("playerId=player-1")).json();
    expect(data.players[0].attendance["2026-10-02T09:00#missing"]).toEqual({ present: false, reasonCode: "sick" });
    expect(data.players[0].attendance["2026-10-02T18:00#present"]).toEqual({ present: true, reasonCode: null });
    expect(data.players[0].attendance["2026-10-02T19:00#absent"]).toEqual({ present: false, reasonCode: "injury" });
  });
  it("retains unmaterialized schedule dates alongside same-day session columns", async () => {
    mocks.customGroups.mockResolvedValue([{ id: "custom", trainingDates: ["2026-10-02", "2026-10-03"], trainingWeekdays: [] }]);
    mocks.sessions.mockResolvedValue(["a", "b"].map((id) => ({ id, trainingDate: new Date("2026-10-02"), trainingTime: "09:00", players: [{ playerId: "player-1", present: true }] })));
    const data = await (await report("playerId=player-1")).json();
    expect(data.trainingDates).toContain("2026-10-03");
    expect(data.players[0].attendance["2026-10-03"]).toEqual({ present: true, reasonCode: null });
  });
  it.each([
    { states: [true, false], reasons: [null, "sick"] },
    { states: [false, false], reasons: ["sick", "injury"] },
    { states: [false, false], reasons: [null, "sick"] },
  ])("keeps same-day sessions independently editable: $states / $reasons", async ({ states, reasons }) => {
    const sessions = states.map((present, index) => ({
      id: `session-${index}`, trainingTime: index ? "18:00" : "09:00",
      trainingDate: new Date("2026-10-02T00:00:00Z"),
      players: [{ playerId: "player-1", present, reasonCode: reasons[index] }],
    }));
    for (const rows of [sessions, [...sessions].reverse()]) {
      mocks.sessions.mockResolvedValue(rows);
      const data = await (await report("playerId=player-1")).json();
      expect(data.trainingDates).toHaveLength(2);
      for (const [index, session] of sessions.entries()) {
        expect(data.players[0].attendance[`2026-10-02T${session.trainingTime}#${session.id}`]).toEqual({ present: states[index], reasonCode: states[index] ? null : reasons[index] });
      }
    }
  });
});
