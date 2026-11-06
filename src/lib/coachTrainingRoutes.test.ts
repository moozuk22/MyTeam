import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { sendPushToMember } from "@/lib/push/service";
import { publishMemberUpdated } from "@/lib/memberEvents";
import { GET, POST, DELETE } from "@/app/api/members/[cardCode]/training/route";
import { GET as report } from "@/app/api/admin/clubs/[id]/training-attendance/report/route";
import { GET as attendance, PATCH as coachAttendance } from "@/app/api/admin/clubs/[id]/training-attendance/route";

const mocks = vi.hoisted(() => ({
  card: { findFirst: vi.fn() },
  club: { findUnique: vi.fn() },
  coachGroup: { findFirst: vi.fn() },
  clubCustomTrainingGroup: { findFirst: vi.fn() },
  player: { findMany: vi.fn(), findFirst: vi.fn() },
  trainingSession: { findMany: vi.fn(), findFirst: vi.fn(), upsert: vi.fn() },
  trainingSessionPlayer: { upsert: vi.fn(), createMany: vi.fn(), updateMany: vi.fn() },
  trainingOptOut: { findMany: vi.fn(), upsert: vi.fn(), deleteMany: vi.fn() },
  trainingNote: { findMany: vi.fn(), findFirst: vi.fn() },
  limitedTrainingEvent: { findMany: vi.fn() },
  field: { findMany: vi.fn() },
  $transaction: vi.fn(),
  $queryRaw: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ prisma: mocks }));
vi.mock("@/lib/adminAuth", () => ({ verifyAdminToken: vi.fn().mockResolvedValue({ roles: ["admin"] }) }));
vi.mock("@/lib/memberEvents", () => ({ publishMemberUpdated: vi.fn() }));
vi.mock("@/lib/push/service", () => ({ sendPushToMember: vi.fn() }));
vi.mock("@/lib/push/adminService", () => ({ sendPushToClubAdmins: vi.fn().mockResolvedValue({}) }));
vi.mock("@/lib/push/adminHistory", () => ({ saveAdminNotificationHistory: vi.fn().mockResolvedValue({}) }));
vi.mock("@/lib/trainingAttendanceEvents", () => ({ publishTrainingAttendanceUpdated: vi.fn() }));
vi.mock("@/lib/trainingSessions", async (importOriginal) => ({ ...await importOriginal<typeof import("@/lib/trainingSessions")>(), updateTrainingSessionPlayerAttendance: vi.fn() }));

const clubId = "10000000-0000-4000-8000-000000000001";
const groupId = "10000000-0000-4000-8000-000000000002";
const playerId = "10000000-0000-4000-8000-000000000003";
const firstId = "10000000-0000-4000-8000-000000000004";
const secondId = "10000000-0000-4000-8000-000000000005";
const scopeKey = `coach_group:${groupId}`;
const date = "2026-10-12";
const context = { params: Promise.resolve({ cardCode: "CARD" }) };
const session = (id: string, time: string, present: boolean) => ({ id, status: "scheduled", createdAt: new Date(id === firstId ? "2026-10-01T00:00:00Z" : "2026-10-02T00:00:00Z"), scopeId: groupId, scopeType: "coachGroup", scopeKey, trainingDate: new Date(`${date}T00:00:00Z`), trainingTime: time, trainingDurationMinutes: 60, trainingFieldId: null, trainingFieldPieceIds: [], note: id === firstId ? "Morning note" : "Evening note", players: [{ playerId, playerName: "Player", teamGroup: null, player: { cards: [] }, present, reasonCode: present ? null : "sick", reasonText: null }] });

describe("coach training API boundaries", () => {
  it.each(["calendar_month", "rolling_30_days"])("uses legacy reservation absences ahead of default roster attendance for %s", async (paymentWorkflow) => {
    const card = await mocks.card.findFirst(); card.player.club.paymentWorkflow = paymentWorkflow; card.player.coachGroups = [];
    const legacy = { ...session(firstId, "09:00", true), scopeKey: "club", scopeType: "club", scopeId: null };
    mocks.trainingSession.findMany.mockImplementation(async (args) => args.where.status === "cancelled" ? [] : [legacy]);
    mocks.club.findUnique.mockResolvedValue(card.player.club);
    mocks.player.findMany.mockResolvedValue([{ id: playerId, fullName: "Player", teamGroup: null, cards: [] }]);
    mocks.trainingNote.findFirst.mockResolvedValue(null);
    const memberData = await (await GET(new NextRequest("http://localhost/training"), context)).json();
    expect(memberData.dates[0].optedOut).toBe(true);
    const adminResponse = await attendance(new NextRequest(`http://localhost/training?date=${date}`, { headers: { cookie: "admin_session=token" } }), { params: Promise.resolve({ id: clubId }) });
    expect(adminResponse.status).toBe(200);
    const adminData = await adminResponse.json();
    expect(adminData.players[0].optedOut).toBe(true);
    expect(adminData.stats.attending).toBe(0);
  });
  it.each(["calendar_month", "rolling_30_days"])("preserves member opt-in for %s through session and legacy date requests", async (paymentWorkflow) => {
    const card = await mocks.card.findFirst(); card.player.club.paymentWorkflow = paymentWorkflow;
    expect((await DELETE(new NextRequest("http://localhost/training", { method: "DELETE", body: JSON.stringify({ trainingSessionId: secondId }) }), context)).status).toBe(200);
    card.player.coachGroups = [];
    expect((await DELETE(new NextRequest("http://localhost/training", { method: "DELETE", body: JSON.stringify({ trainingDate: date }) }), context)).status).toBe(200);
    expect(mocks.trainingSessionPlayer.upsert).toHaveBeenCalledOnce();
    expect(mocks.trainingOptOut.deleteMany).toHaveBeenCalledOnce();
  });
  it.each(["training_credits", "training_credits_30_days"])("rejects manual member opt-in for %s through both session and date requests", async (paymentWorkflow) => {
    const card = await mocks.card.findFirst(); card.player.club.paymentWorkflow = paymentWorkflow;
    for (const body of [{ trainingSessionId: secondId }, { trainingDate: date }]) {
      const response = await DELETE(new NextRequest("http://localhost/training", { method: "DELETE", body: JSON.stringify(body) }), context);
      expect(response.status).toBe(403);
    }
    expect(mocks.trainingSessionPlayer.upsert).not.toHaveBeenCalled();
    expect(mocks.$transaction).not.toHaveBeenCalled();
  });
  beforeEach(() => {
    vi.clearAllMocks(); vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-12T07:00:00Z"));
    const schedule = { trainingDates: [date], trainingDateTimes: { [date]: "09:00" }, trainingTime: "09:00", trainingDurationMinutes: 60, trainingWeekdays: [], trainingWindowDays: 30, trainingFieldId: null, trainingFieldPieceIds: [], trainingFieldSelections: null };
    mocks.card.findFirst.mockResolvedValue({ cardCode: "CARD", playerId, player: { id: playerId, fullName: "Player", clubId, teamGroup: null, club: { id: clubId, sports: [], trainingGroupMode: "team_group", ...schedule }, customTrainingGroups: [], coachGroups: [{ id: groupId, ...schedule }] } });
    mocks.trainingSession.findMany.mockImplementation(async (args) => args.where.status === "cancelled" ? [] : [session(firstId, "09:00", false), session(secondId, "18:00", true)]);
    mocks.trainingSession.findFirst.mockResolvedValue(session(secondId, "18:00", true));
    mocks.trainingSessionPlayer.upsert.mockResolvedValue({});
    mocks.trainingSessionPlayer.createMany.mockResolvedValue({ count: 0 });
    mocks.player.findFirst.mockResolvedValue({ id: playerId, cards: [{ cardCode: "CARD" }, { cardCode: "SECOND" }] });
    mocks.trainingOptOut.findMany.mockResolvedValue([{ trainingDate: new Date(`${date}T00:00:00Z`), playerId, reasonCode: "sick", reasonText: null }]);
    mocks.trainingNote.findMany.mockResolvedValue([]);
    mocks.limitedTrainingEvent.findMany.mockResolvedValue([]);
    mocks.club.findUnique.mockResolvedValue({ id: clubId, trainingDates: [], trainingWeekdays: [], trainingGroupMode: "team_group" });
    mocks.coachGroup.findFirst.mockResolvedValue({ id: groupId });
    mocks.player.findMany.mockResolvedValue([{ id: playerId, fullName: "Player", teamGroup: null }]);
    mocks.$transaction.mockImplementation(async (callback) => callback(mocks));
  });
  afterEach(() => vi.useRealTimers());
  it("returns separate session IDs, notes, and attendance despite a legacy day absence", async () => {
    const response = await GET(new NextRequest("http://localhost/api/members/CARD/training"), context);
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.dates).toHaveLength(1);
    expect(data.dates[0].sessions).toMatchObject([{ id: firstId, trainingTime: "09:00", optedOut: true, note: "Morning note" }, { id: secondId, trainingTime: "18:00", optedOut: false, note: "Evening note" }]);
    expect(data.dates[0].optedOut).toBe(false);
  });
  it("keeps explicitly recorded custom-group attendance separate on the same date", async () => {
    const card = await mocks.card.findFirst();
    card.player.club.trainingGroupMode = "custom_group";
    card.player.coachGroups = [];
    card.player.customTrainingGroups = [firstId, secondId].map((id) => ({ group: { ...card.player.club, id, coachGroupId: null } }));
    mocks.trainingSession.findMany.mockImplementation(async (args) => args.where.status === "cancelled" ? [] : [
      { ...session(firstId, "09:00", false), scopeType: "customGroup", scopeKey: `custom_group:${firstId}`, players: [{ present: false, reasonCode: "sick", reasonText: null, attendanceRecorded: true }] },
      { ...session(secondId, "18:00", true), scopeType: "customGroup", scopeKey: `custom_group:${secondId}`, players: [{ present: true, reasonCode: null, reasonText: null, attendanceRecorded: true }] },
    ]);
    const data = await (await GET(new NextRequest("http://localhost/training"), context)).json();
    expect(data.dates[0].sessions).toMatchObject([
      { id: firstId, optedOut: true }, { id: secondId, optedOut: false },
    ]);
  });
  it.each([true, false])("notifies the member after a session-specific coach edit, optedOut=%s", async (optedOut) => {
    mocks.trainingSessionPlayer.updateMany.mockResolvedValue({ count: 1 });
    const response = await coachAttendance(new NextRequest("http://localhost/training", { method: "PATCH", headers: { cookie: "admin_session=token" }, body: JSON.stringify({ playerId, trainingSessionId: firstId, trainingDate: "2020-01-01", optedOut }) }), { params: Promise.resolve({ id: clubId }) });
    expect(response.status).toBe(200);
    expect(sendPushToMember).toHaveBeenCalledWith(playerId, expect.objectContaining({
      url: "/member/CARD", data: { type: "training_reminder", trainingDate: date },
      body: expect.stringContaining(optedOut ? "отсъствие" : "присъствие"),
    }), "training_reminder");
    expect(publishMemberUpdated).toHaveBeenCalledWith("CARD", "training-updated");
    expect(publishMemberUpdated).toHaveBeenCalledWith("SECOND", "training-updated");
  });
  it("still refreshes member pages when the attendance push fails", async () => {
    mocks.trainingSessionPlayer.updateMany.mockResolvedValue({ count: 1 });
    vi.mocked(sendPushToMember).mockRejectedValueOnce(new Error("Push unavailable"));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const response = await coachAttendance(new NextRequest("http://localhost/training", { method: "PATCH", headers: { cookie: "admin_session=token" }, body: JSON.stringify({ playerId, trainingSessionId: firstId, optedOut: true }) }), { params: Promise.resolve({ id: clubId }) });
      expect(response.status).toBe(200);
      expect(publishMemberUpdated).toHaveBeenCalledWith("CARD", "training-updated");
    } finally {
      log.mockRestore();
    }
  });
  it("does not notify members when no attendance row was updated", async () => {
    mocks.player.findMany.mockResolvedValue([]);
    mocks.trainingSessionPlayer.updateMany.mockResolvedValue({ count: 0 });
    const response = await coachAttendance(new NextRequest("http://localhost/training", { method: "PATCH", headers: { cookie: "admin_session=token" }, body: JSON.stringify({ playerId, trainingSessionId: firstId, optedOut: true }) }), { params: Promise.resolve({ id: clubId }) });
    expect(response.status).toBe(404);
    expect(sendPushToMember).not.toHaveBeenCalled();
    expect(publishMemberUpdated).not.toHaveBeenCalled();
  });
  it.each([POST, DELETE])("records attendance for an unmaterialized custom training without a day-wide write", async (update) => {
    const card = await mocks.card.findFirst();
    card.player.club.trainingGroupMode = "custom_group";
    card.player.coachGroups = [];
    card.player.customTrainingGroups = [firstId, secondId].map((id) => ({ group: { ...card.player.club, id, coachGroupId: null } }));
    mocks.clubCustomTrainingGroup.findFirst.mockResolvedValue(card.player.customTrainingGroups[1].group);
    mocks.player.findMany.mockResolvedValue([{ id: playerId, fullName: "Player", teamGroup: null }, { id: "other-member", fullName: "Other", teamGroup: null }]);
    mocks.trainingSession.upsert.mockResolvedValue({ ...session(secondId, "18:00", true), scopeType: "customGroup", scopeId: secondId, scopeKey: `custom_group:${secondId}`, players: [] });
    const response = await update(new NextRequest("http://localhost/training", { method: update === POST ? "POST" : "DELETE", body: JSON.stringify({ trainingScopeKey: `custom_group:${secondId}`, trainingDate: date, reasonCode: "sick" }) }), context);
    expect(response.status).toBe(200);
    expect(mocks.clubCustomTrainingGroup.findFirst).toHaveBeenCalledWith({ where: { id: secondId, clubId, players: { some: { playerId } } } });
    expect(mocks.trainingSession.upsert).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({ scopeKey: `custom_group:${secondId}`, scopeType: "customGroup" }) }));
    expect(mocks.trainingSessionPlayer.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { trainingSessionId_playerId: { trainingSessionId: secondId, playerId } }, update: expect.objectContaining({ present: update === DELETE }) }));
    expect(mocks.trainingSessionPlayer.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({ trainingSessionId: secondId, playerId }),
        expect.objectContaining({ trainingSessionId: secondId, playerId: "other-member" }),
      ]), skipDuplicates: true,
    });
    expect(mocks.trainingOptOut.upsert).not.toHaveBeenCalled();
    expect(mocks.trainingOptOut.deleteMany).not.toHaveBeenCalled();
  });
  it("allows a coach to edit another member after member-side session creation", async () => {
    const card = await mocks.card.findFirst();
    mocks.clubCustomTrainingGroup.findFirst.mockResolvedValue({ ...card.player.club, id: secondId });
    mocks.trainingSession.upsert.mockResolvedValue({ ...session(secondId, "18:00", true), scopeType: "customGroup", scopeId: secondId, scopeKey: `custom_group:${secondId}`, players: [] });
    mocks.player.findMany.mockResolvedValue([
      { id: playerId, fullName: "Player", teamGroup: null },
      { id: "other-member", fullName: "Other", teamGroup: null },
      { id: "future-member", fullName: "Future", teamGroup: null, createdAt: new Date("2026-10-13") },
    ]);
    const roster = new Map<string, { present: boolean }>();
    mocks.trainingSessionPlayer.createMany.mockImplementation(async ({ data }) => {
      for (const row of data) if (!roster.has(row.playerId)) roster.set(row.playerId, row);
      return { count: data.length };
    });
    const memberResponse = await POST(new NextRequest("http://localhost/training", { method: "POST", body: JSON.stringify({ trainingScopeKey: `custom_group:${secondId}`, trainingDate: date, reasonCode: "sick" }) }), context);
    expect(memberResponse.status).toBe(200);
    expect(roster.has("future-member")).toBe(false);
    mocks.trainingSessionPlayer.updateMany.mockImplementation(async ({ where, data }) => {
      const row = roster.get(where.playerId);
      if (!row) return { count: 0 };
      Object.assign(row, data);
      return { count: 1 };
    });
    mocks.player.findFirst.mockResolvedValue({ id: "other-member", cards: [] });
    const coachResponse = await coachAttendance(new NextRequest("http://localhost/training", { method: "PATCH", headers: { cookie: "admin_session=token" }, body: JSON.stringify({ playerId: "other-member", trainingSessionId: secondId, optedOut: true }) }), { params: Promise.resolve({ id: clubId }) });
    expect(coachResponse.status).toBe(200);
    expect(roster.get("other-member")?.present).toBe(false);
  });
  it("rejects a custom scope after membership was removed", async () => {
    mocks.clubCustomTrainingGroup.findFirst.mockResolvedValue(null);
    const response = await POST(new NextRequest("http://localhost/training", { method: "POST", body: JSON.stringify({ trainingScopeKey: `custom_group:${secondId}`, trainingDate: date, reasonCode: "sick" }) }), context);
    expect(response.status).toBe(404);
    expect(mocks.trainingSession.upsert).not.toHaveBeenCalled();
    expect(mocks.trainingSessionPlayer.upsert).not.toHaveBeenCalled();
  });
  it.each(["cancelled", "locked"])("does not enroll a new member into a %s materialized custom session", async (state) => {
    const card = await mocks.card.findFirst();
    mocks.clubCustomTrainingGroup.findFirst.mockResolvedValue({ ...card.player.club, id: secondId });
    mocks.trainingSession.upsert.mockResolvedValue({ ...session(secondId, "18:00", true), status: state === "cancelled" ? "cancelled" : "scheduled", rosterLockedAt: state === "locked" ? new Date() : null, players: [] });
    const response = await POST(new NextRequest("http://localhost/training", { method: "POST", body: JSON.stringify({ trainingScopeKey: `custom_group:${secondId}`, trainingDate: date, reasonCode: "sick" }) }), context);
    expect(response.status).toBe(state === "cancelled" ? 404 : 403);
    expect(mocks.trainingSessionPlayer.upsert).not.toHaveBeenCalled();
  });
  it("enrolls an eligible new custom-group member during a coach session edit", async () => {
    mocks.trainingSession.findFirst.mockResolvedValue({ ...session(secondId, "18:00", true), scopeType: "customGroup", scopeId: groupId, scopeKey: `custom_group:${groupId}`, rosterLockedAt: null });
    mocks.trainingSessionPlayer.updateMany.mockResolvedValue({ count: 0 });
    mocks.player.findMany.mockResolvedValue([{ id: playerId, fullName: "New member", teamGroup: null, attendanceMemberships: [{ scopeKey: `custom_group:${groupId}`, joinedAt: new Date("2026-10-11"), leftAt: null }] }]);
    const response = await coachAttendance(new NextRequest("http://localhost/training", { method: "PATCH", headers: { cookie: "admin_session=token" }, body: JSON.stringify({ playerId, trainingSessionId: secondId, optedOut: true }) }), { params: Promise.resolve({ id: clubId }) });
    expect(response.status).toBe(200);
    expect(mocks.trainingSessionPlayer.upsert).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({ trainingSessionId: secondId, playerId, present: false, attendanceRecorded: true }) }));
    expect(sendPushToMember).toHaveBeenCalled();
  });
  it.each(["club", "teamGroup", "trainingGroup", "coachGroup"])("enrolls an eligible member missing a %s session row", async (scopeType) => {
    mocks.trainingSession.findFirst.mockResolvedValue({ ...session(secondId, "18:00", true), scopeType, scopeId: groupId, scopeKey: scopeType === "coachGroup" ? scopeKey : scopeType === "club" ? "club" : `${scopeType}:${groupId}`, teamGroup: 2012, teamGroups: [2012], rosterLockedAt: null });
    mocks.trainingSessionPlayer.updateMany.mockResolvedValue({ count: 0 });
    mocks.player.findMany.mockResolvedValue([{ id: playerId, fullName: "New member", teamGroup: 2012 }]);
    const response = await coachAttendance(new NextRequest("http://localhost/training", { method: "PATCH", headers: { cookie: "admin_session=token" }, body: JSON.stringify({ playerId, trainingSessionId: secondId, optedOut: true }) }), { params: Promise.resolve({ id: clubId }) });
    expect(response.status).toBe(200);
    expect(mocks.trainingSessionPlayer.upsert).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({ trainingSessionId: secondId, playerId, present: false, attendanceRecorded: true }) }));
    expect(mocks.player.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ clubId, isActive: true, ...(scopeType === "teamGroup" ? { teamGroup: 2012 } : scopeType === "trainingGroup" ? { teamGroup: { in: [2012] } } : scopeType === "coachGroup" ? { coachGroups: { some: { id: groupId } } } : {}) }) }));
  });
  it.each(["locked", "not-member", "joined-late"])("does not enroll a missing roster member when %s", async (state) => {
    mocks.trainingSession.findFirst.mockResolvedValue({ ...session(secondId, "18:00", true), scopeType: "customGroup", scopeId: groupId, scopeKey: `custom_group:${groupId}`, rosterLockedAt: state === "locked" ? new Date() : null });
    mocks.trainingSessionPlayer.updateMany.mockResolvedValue({ count: 0 });
    mocks.player.findMany.mockResolvedValue(state === "not-member" ? [] : [{ id: playerId, fullName: "Player", teamGroup: null, attendanceMemberships: [{ scopeKey: `custom_group:${groupId}`, joinedAt: new Date(state === "joined-late" ? "2026-10-13" : "2026-10-11"), leftAt: null }] }]);
    const response = await coachAttendance(new NextRequest("http://localhost/training", { method: "PATCH", headers: { cookie: "admin_session=token" }, body: JSON.stringify({ playerId, trainingSessionId: secondId, optedOut: true }) }), { params: Promise.resolve({ id: clubId }) });
    expect(response.status).toBe(404);
    expect(mocks.trainingSessionPlayer.upsert).not.toHaveBeenCalled();
    expect(sendPushToMember).not.toHaveBeenCalled();
  });
  it.each([0, 1])("rejects date-only coach edits for two scheduled custom groups with %i stored sessions", async (storedCount) => {
    mocks.trainingSession.findMany.mockResolvedValue(storedCount ? [{ id: firstId, scopeKey: `custom_group:${firstId}` }] : []);
    mocks.player.findFirst.mockResolvedValue({ id: playerId, cards: [], customTrainingGroups: [firstId, secondId].map((id) => ({ group: { id, trainingDates: [date], trainingWeekdays: [] } })) });
    for (const optedOut of [true, false]) {
      const response = await coachAttendance(new NextRequest("http://localhost/training", { method: "PATCH", headers: { cookie: "admin_session=token" }, body: JSON.stringify({ playerId, trainingDate: date, optedOut }) }), { params: Promise.resolve({ id: clubId }) });
      expect(response.status).toBe(400);
    }
    expect(mocks.trainingOptOut.upsert).not.toHaveBeenCalled();
    expect(mocks.trainingOptOut.deleteMany).not.toHaveBeenCalled();
    expect(sendPushToMember).not.toHaveBeenCalled();
  });
  it("counts recurring custom schedules when rejecting ambiguous coach edits", async () => {
    mocks.trainingSession.findMany.mockResolvedValue([]);
    mocks.player.findFirst.mockResolvedValue({ id: playerId, cards: [], customTrainingGroups: [firstId, secondId].map((id) => ({ group: { id, trainingDates: [], trainingWeekdays: [1] } })) });
    const response = await coachAttendance(new NextRequest("http://localhost/training", { method: "PATCH", headers: { cookie: "admin_session=token" }, body: JSON.stringify({ playerId, trainingDate: date, optedOut: true }) }), { params: Promise.resolve({ id: clubId }) });
    expect(response.status).toBe(400);
    expect(mocks.trainingOptOut.upsert).not.toHaveBeenCalled();
  });
  it.each([0, 1])("keeps single-training date edits working with %i stored sessions", async (storedCount) => {
    mocks.trainingSession.findMany.mockResolvedValue(storedCount ? [{ id: firstId, scopeKey: `custom_group:${firstId}` }] : []);
    mocks.player.findFirst.mockResolvedValue({ id: playerId, cards: [], customTrainingGroups: [
      { group: { id: firstId, trainingDates: [date], trainingWeekdays: [] } },
      { group: { id: secondId, trainingDates: ["2026-10-13"], trainingWeekdays: [1] } },
    ] });
    const response = await coachAttendance(new NextRequest("http://localhost/training", { method: "PATCH", headers: { cookie: "admin_session=token" }, body: JSON.stringify({ playerId, trainingDate: date, optedOut: true }) }), { params: Promise.resolve({ id: clubId }) });
    expect(response.status).toBe(200);
    expect(mocks.trainingOptOut.upsert).toHaveBeenCalledOnce();
  });
  it.each([true, false])("coach edits an unstored custom training independently, absent=%s", async (optedOut) => {
    mocks.clubCustomTrainingGroup.findFirst.mockResolvedValue({ id: secondId, trainingDates: [date], trainingWeekdays: [], trainingTime: "18:00", trainingFieldPieceIds: [], trainingFieldSelections: { [date]: { trainingFieldId: "date-field", trainingFieldPieceIds: ["date-piece"] } } });
    mocks.trainingSession.upsert.mockResolvedValue({ ...session(secondId, "18:00", true), scopeType: "customGroup", scopeId: secondId, scopeKey: `custom_group:${secondId}` });
    mocks.trainingSession.findFirst.mockResolvedValue({ ...session(secondId, "18:00", true), scopeType: "customGroup", scopeId: secondId, scopeKey: `custom_group:${secondId}` });
    mocks.trainingSessionPlayer.updateMany.mockResolvedValue({ count: 0 });
    const response = await coachAttendance(new NextRequest("http://localhost/training", { method: "PATCH", headers: { cookie: "admin_session=token" }, body: JSON.stringify({ playerId, trainingDate: date, trainingScopeKey: `custom_group:${secondId}`, optedOut }) }), { params: Promise.resolve({ id: clubId }) });
    expect(response.status).toBe(200);
    expect(mocks.trainingSession.upsert).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({ trainingFieldId: "date-field", trainingFieldPieceIds: ["date-piece"] }) }));
    expect(mocks.trainingSessionPlayer.upsert).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({ trainingSessionId: secondId, present: !optedOut }) }));
    expect(mocks.trainingOptOut.upsert).not.toHaveBeenCalled();
    expect(mocks.trainingOptOut.deleteMany).not.toHaveBeenCalled();
  });
  it("rejects a coach's ambiguous date-only attendance change", async () => {
    const response = await coachAttendance(new NextRequest("http://localhost/training", { method: "PATCH", headers: { cookie: "admin_session=token" }, body: JSON.stringify({ playerId, trainingDate: date, optedOut: true }) }), { params: Promise.resolve({ id: clubId }) });
    expect(response.status).toBe(400);
    expect(mocks.trainingOptOut.upsert).not.toHaveBeenCalled();
    expect(mocks.trainingSessionPlayer.updateMany).not.toHaveBeenCalled();
  });
  it.each(["coachGroup", "customGroup"])("coach absence updates only the selected %s session", async (scopeType) => {
    const rows = [session(firstId, "09:00", true), session(secondId, "18:00", true)].map((row) => ({ ...row, scopeType }));
    mocks.trainingSessionPlayer.updateMany.mockImplementation(async ({ where, data }) => {
      for (const row of rows.filter((row) => row.id === where.trainingSessionId)) Object.assign(row.players[0], data);
      return { count: 1 };
    });
    const response = await coachAttendance(new NextRequest("http://localhost/training", { method: "PATCH", headers: { cookie: "admin_session=token" }, body: JSON.stringify({ playerId, trainingDate: date, trainingSessionId: firstId, optedOut: true }) }), { params: Promise.resolve({ id: clubId }) });
    expect(response.status).toBe(200);
    expect(rows.map((row) => row.players[0].present)).toEqual([false, true]);
    expect(mocks.trainingOptOut.upsert).not.toHaveBeenCalled();
  });
  it.each([POST, DELETE])("member attendance targets the selected custom-group session", async (update) => {
    const row = { ...session(secondId, "18:00", true), scopeType: "customGroup" };
    mocks.trainingSession.findFirst.mockResolvedValue(row);
    const response = await update(new NextRequest("http://localhost/training", { method: update === POST ? "POST" : "DELETE", body: JSON.stringify({ trainingSessionId: secondId, reasonCode: "sick" }) }), context);
    expect(response.status).toBe(200);
    expect(mocks.trainingSession.findFirst.mock.calls[0][0].where.OR).toContainEqual({ scopeType: { not: "coachGroup" }, players: { some: { playerId } } });
    expect(mocks.trainingSessionPlayer.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { trainingSessionId_playerId: { trainingSessionId: secondId, playerId } } }));
    expect(mocks.trainingOptOut.upsert).not.toHaveBeenCalled();
    expect(mocks.trainingOptOut.deleteMany).not.toHaveBeenCalled();
  });
  it("updates only the selected session and never writes a day-wide opt-out", async () => {
    const response = await POST(new NextRequest("http://localhost/api/members/CARD/training", { method: "POST", body: JSON.stringify({ trainingSessionId: secondId, reasonCode: "sick" }) }), context);
    expect(response.status).toBe(200);
    expect(mocks.trainingSessionPlayer.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { trainingSessionId_playerId: { trainingSessionId: secondId, playerId } }, update: { present: false, reasonCode: "sick", reasonText: null, attendanceRecorded: true } }));
    expect(mocks.trainingOptOut.upsert).not.toHaveBeenCalled();
    expect(mocks.trainingSession.findFirst.mock.calls[0][0].where.OR).toContainEqual({ scopeType: "coachGroup", scopeId: { in: [groupId] } });
  });
  it.each([POST, DELETE])("rejects a new member trying to enter a locked historical roster", async (update) => {
    mocks.trainingSession.findFirst.mockResolvedValue({ ...session(secondId, "18:00", true), rosterLockedAt: new Date(), players: [] });
    const response = await update(new NextRequest("http://localhost/training", { method: update === POST ? "POST" : "DELETE", body: JSON.stringify({ trainingSessionId: secondId, reasonCode: "sick" }) }), context);
    expect(response.status).toBe(403);
    expect(mocks.trainingSessionPlayer.upsert).not.toHaveBeenCalled();
  });
  it.each([POST, DELETE])("allows an existing locked roster member to update their attendance", async (update) => {
    mocks.trainingSession.findFirst.mockResolvedValue({ ...session(secondId, "18:00", true), rosterLockedAt: new Date() });
    const response = await update(new NextRequest("http://localhost/training", { method: update === POST ? "POST" : "DELETE", body: JSON.stringify({ trainingSessionId: secondId, reasonCode: "sick" }) }), context);
    expect(response.status).toBe(200);
    expect(mocks.trainingSessionPlayer.upsert).toHaveBeenCalledOnce();
    expect(mocks.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(mocks.trainingSession.findFirst.mock.invocationCallOrder[0]);
    expect(mocks.trainingSession.findFirst.mock.invocationCallOrder[0]).toBeLessThan(mocks.trainingSessionPlayer.upsert.mock.invocationCallOrder[0]);
  });
  it("shows coach trainings alongside custom-group trainings, including different dates", async () => {
    const card = await mocks.card.findFirst();
    card.player.club.trainingGroupMode = "custom_group";
    card.player.customTrainingGroups = [{ group: { ...card.player.coachGroups[0], id: "custom", coachGroupId: groupId, trainingDates: [date, "2026-10-13"], trainingTime: "12:00", trainingDateTimes: {} } }];
    const response = await GET(new NextRequest("http://localhost/api/members/CARD/training"), context);
    const data = await response.json();
    expect(data.dates.map((day: { date: string }) => day.date)).toEqual([date, "2026-10-13"]);
    expect(data.dates[0].sessions).toMatchObject([
      { id: firstId, trainingTime: "09:00", optedOut: true },
      { scopeKey: "custom_group:custom", trainingTime: "12:00", optedOut: true },
      { id: secondId, trainingTime: "18:00", optedOut: false },
    ]);
    expect(data.dates[1].sessions).toHaveLength(1);
    expect(data.dates[1].sessions[0]).toMatchObject({ scopeKey: "custom_group:custom", optedOut: false });
    const legacyResponse = await POST(new NextRequest("http://localhost/training", { method: "POST", body: JSON.stringify({ trainingDate: date, reasonCode: "sick" }) }), context);
    expect(legacyResponse.status).toBe(200);
    expect(mocks.trainingOptOut.upsert).toHaveBeenCalledOnce();
    expect(mocks.trainingSessionPlayer.upsert).not.toHaveBeenCalled();
  });
  it("keeps coach-only dates visible when a custom schedule uses another date", async () => {
    const card = await mocks.card.findFirst();
    card.player.club.trainingGroupMode = "custom_group";
    card.player.customTrainingGroups = [{ group: { ...card.player.coachGroups[0], id: "custom", coachGroupId: groupId, trainingDates: ["2026-10-13"], trainingWeekdays: [] } }];
    const response = await GET(new NextRequest("http://localhost/api/members/CARD/training"), context);
    const data = await response.json();
    expect(data.dates.map((day: { date: string }) => day.date)).toEqual([date, "2026-10-13"]);
    expect(data.dates[0].sessions.map((s: { id: string }) => s.id)).toEqual([firstId, secondId]);
    expect(data.dates[1].sessions).toHaveLength(1);
  });
  it("requires session identity and rejects another group's session", async () => {
    let response = await POST(new NextRequest("http://localhost/training", { method: "POST", body: JSON.stringify({ trainingDate: date, reasonCode: "sick" }) }), context);
    expect(response.status).toBe(400);
    mocks.trainingSession.findFirst.mockResolvedValue(null);
    response = await POST(new NextRequest("http://localhost/training", { method: "POST", body: JSON.stringify({ trainingSessionId: secondId, reasonCode: "sick" }) }), context);
    expect(response.status).toBe(404);
    expect(mocks.trainingSessionPlayer.upsert).not.toHaveBeenCalled();
  });
  it("reports one attendance column per training, so one of two attended is 50 percent", async () => {
    const request = new NextRequest(`http://localhost/report?coachGroupId=${groupId}&from=${date}&to=${date}`, { headers: { cookie: "admin_session=test" } });
    const response = await report(request, { params: Promise.resolve({ id: clubId }) });
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.trainingDates).toHaveLength(2);
    expect(data.trainingDates[0]).toContain(firstId);
    expect(data.trainingDates[1]).toContain(secondId);
    expect(Object.values(data.players[0].attendance)).toEqual([{ present: false, reasonCode: "sick" }, { present: true, reasonCode: null }]);
    expect(mocks.trainingSession.findMany.mock.calls[0][0].where.scopeKey).toBe(scopeKey);
  });
  it("the original details screen reads attendance and notes for the selected session", async () => {
    const response = await attendance(new NextRequest(`http://localhost/attendance?trainingSessionId=${secondId}`, { headers: { cookie: "admin_session=test" } }), { params: Promise.resolve({ id: clubId }) });
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data).toMatchObject({ trainingSessionId: secondId, trainingTime: "18:00", note: "Evening note", stats: { total: 1, attending: 1, optedOut: 0 } });
    expect(data.players[0]).toMatchObject({ id: playerId, fullName: "Player", optedOut: false });
    expect(data.upcomingDates).toMatchObject([{ date, sessions: [{ id: firstId }, { id: secondId }] }]);
    expect(mocks.trainingSession.findFirst.mock.calls[0][0].where).toMatchObject({ id: secondId, clubId, scopeType: "coachGroup" });
  });
  it("opening attendance does not repair a locked roster with newly joined members", async () => {
    const locked = { ...session(secondId, "18:00", true), rosterLockedAt: new Date() };
    mocks.trainingSession.findMany.mockResolvedValue([locked]);
    mocks.trainingSession.findFirst.mockResolvedValue(locked);
    mocks.player.findMany.mockResolvedValue([{ id: "new-member", fullName: "New", teamGroup: null, cards: [] }]);
    const response = await attendance(new NextRequest(`http://localhost/attendance?trainingSessionId=${secondId}`, { headers: { cookie: "admin_session=test" } }), { params: Promise.resolve({ id: clubId }) });
    expect(response.status).toBe(200);
    expect(mocks.trainingSessionPlayer.createMany).not.toHaveBeenCalled();
  });
  it("rechecks the roster lock after a concurrent schedule correction", async () => {
    const entry = session(secondId, "18:00", true);
    mocks.trainingSession.findMany.mockResolvedValue([entry]);
    mocks.trainingSession.findFirst.mockResolvedValue({ ...entry, rosterLockedAt: new Date() });
    mocks.player.findMany.mockResolvedValue([{ id: "new-member", fullName: "New", teamGroup: null, cards: [] }]);
    const response = await attendance(new NextRequest(`http://localhost/attendance?coachGroupId=${groupId}&month=2026-10`, { headers: { cookie: "admin_session=test" } }), { params: Promise.resolve({ id: clubId }) });
    expect(response.status).toBe(200);
    expect(mocks.trainingSessionPlayer.createMany).not.toHaveBeenCalled();
  });
  it.each([[true, "coach"], [false, "coach"], [true, "custom"], [false, "custom"]] as const)("reports roster membership after leaving, locked=%s, scope=%s", async (locked, scope) => {
    const key = scope === "coach" ? scopeKey : `custom_group:${groupId}`;
    const row = { ...session(secondId, "18:00", true), scopeKey: key, scopeType: scope === "coach" ? "coachGroup" : "customGroup", rosterLockedAt: locked ? new Date() : null };
    mocks.clubCustomTrainingGroup.findFirst.mockResolvedValue({ id: groupId, trainingDates: [date], trainingWeekdays: [], trainingTime: "18:00", players: [] });
    mocks.trainingSession.findMany.mockResolvedValue([row]);
    mocks.trainingOptOut.findMany.mockResolvedValue([]);
    mocks.player.findMany.mockResolvedValue([{ id: playerId, fullName: "Player", teamGroup: null, attendanceMemberships: [{ scopeKey: key, joinedAt: new Date("2026-10-01T00:00Z"), leftAt: new Date("2026-10-12T09:00Z") }] }]);
    const filter = scope === "coach" ? "coachGroupId" : "customTrainingGroupId";
    const response = await report(new NextRequest(`http://localhost/report?${filter}=${groupId}&from=${date}&to=${date}`, { headers: { cookie: "admin_session=test" } }), { params: Promise.resolve({ id: clubId }) });
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(Object.values(data.players[0].attendance)).toEqual(locked ? [{ present: true, reasonCode: null }] : []);
  });
  it("does not infer attendance for new members outside a locked roster", async () => {
    mocks.trainingSession.findMany.mockResolvedValue([{ ...session(secondId, "18:00", true), rosterLockedAt: new Date(), players: [] }]);
    mocks.trainingOptOut.findMany.mockResolvedValue([]);
    const response = await report(new NextRequest(`http://localhost/report?coachGroupId=${groupId}&from=${date}&to=${date}`, { headers: { cookie: "admin_session=test" } }), { params: Promise.resolve({ id: clubId }) });
    expect(response.status).toBe(200);
    expect(Object.values((await response.json()).players[0].attendance)).toEqual([]);
  });
  it("loads all coach sessions for the calendar independently of the old custom-group dates", async () => {
    mocks.trainingSession.findMany.mockResolvedValue([session(firstId, "09:00", false), { ...session(secondId, "18:00", true), trainingDate: new Date("2026-10-13T00:00:00Z") }]);
    const response = await attendance(new NextRequest(`http://localhost/attendance?coachGroupId=${groupId}&month=2026-10`, { headers: { cookie: "admin_session=test" } }), { params: Promise.resolve({ id: clubId }) });
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.upcomingDates.map((day: { date: string }) => day.date)).toEqual([date, "2026-10-13"]);
    expect(data.trainingSessionId).toBe(firstId);
    expect(mocks.trainingSession.findMany.mock.calls[0][0].where).toMatchObject({ clubId, scopeId: groupId, scopeType: "coachGroup", status: "scheduled" });
  });
});
