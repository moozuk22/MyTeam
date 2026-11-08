import { describe, expect, it, vi } from "vitest";
import { collectReport, parseOptions, formatReport } from "./report-training-scope.mjs";

const since = "2026-11-07T21:35:00+02:00";
const until = "2026-11-09T00:00:00Z";
const options = () => parseOptions(["--since", since, "--until", until]);
function session(id, patch = {}) {
  return { id, clubId: "club-a", scopeType: "coachGroup", scopeKey: "coach_group:coach", scopeId: "coach",
    trainingDate: new Date("2026-11-10"), createdAt: new Date("2026-11-08T08:00:00Z"), updatedAt: new Date("2026-11-08T08:00:00Z"),
    trainingTime: "18:00", trainingDurationMinutes: 60, status: "scheduled", club: { name: "Клуб" }, _count: { players: 6 }, ...patch };
}
function database(pages) {
  const tx = {
    $executeRawUnsafe: vi.fn().mockResolvedValue(0),
    trainingSession: { findMany: vi.fn() },
    coachGroup: { findMany: vi.fn().mockResolvedValue([{ id: "coach", clubId: "club-a", name: "Треньор 1" }]) },
    clubCustomTrainingGroup: { findMany: vi.fn().mockResolvedValue([{ id: "custom", clubId: "club-a", name: "Група 1" }]) },
    clubTrainingScheduleGroup: { findMany: vi.fn().mockResolvedValue([]) },
    trainingSessionPlayer: { groupBy: vi.fn().mockResolvedValue([]) },
    limitedTrainingEvent: { findMany: vi.fn().mockResolvedValue([]) },
  };
  for (const page of pages) tx.trainingSession.findMany.mockResolvedValueOnce(page);
  return { tx, db: { $transaction: vi.fn(callback => callback(tx)) } };
}
describe("training scope audit", () => {
  it("converts the explicit deployment offset and bounds by creation time, not training date", async () => {
    const { tx, db } = database([[session("one")]]);
    const report = await collectReport(db, options());
    expect(report.since).toBe("2026-11-07T19:35:00.000Z");
    expect(tx.trainingSession.findMany.mock.calls[0][0].where).toEqual({ createdAt: { gte: new Date(since), lt: new Date(until) } });
    expect(report.trainings[0].date).toBe("2026-11-10");
    expect(tx.$executeRawUnsafe).toHaveBeenCalledWith("SET TRANSACTION READ ONLY");
  });
  it.each([[], ["--since", "2026-11-07"], ["--since", "2026-11-07T21:35:00"], ["--since", "2026-02-30T21:35:00Z"], ["--since", until, "--until", since], ["--since", since, "--club-id", "bad"]])("rejects invalid or ambiguous cutoffs: %j", args => {
    expect(() => parseOptions(args)).toThrow();
  });
  it("uses one fixed default upper bound and supports help without a database", () => {
    const now = new Date("2026-11-08T12:00:00Z");
    expect(parseOptions(["--since", since], now).until).toEqual(now);
    expect(parseOptions(["--help"])).toEqual({ help: true });
  });
  it("reports current scope and activity without asserting that coach sessions are incorrect", async () => {
    const { tx, db } = database([[session("one", { note: "Private note" }), session("two", { scopeType: "customGroup", scopeId: "custom", scopeKey: "custom_group:custom" })]]);
    tx.trainingSessionPlayer.groupBy.mockResolvedValueOnce([{ trainingSessionId: "one", _count: { _all: 2 } }])
      .mockResolvedValueOnce([{ trainingSessionId: "one", _count: { _all: 1 } }]).mockResolvedValueOnce([]);
    tx.limitedTrainingEvent.findMany.mockResolvedValue([
      { id: "event", clubId: "club-a", scopeKey: "coach_group:coach:session:one", trainingDate: new Date("2026-11-10"), _count: { registrations: 3 } },
      { id: "foreign", clubId: "other-club", scopeKey: "coach_group:coach", trainingDate: new Date("2026-11-10"), _count: { registrations: 9 } },
    ]);
    const report = await collectReport(db, options());
    expect(report.coachGroupReviewCandidates).toBe(1);
    expect(report.trainings[0]).toMatchObject({ groupName: "Треньор 1", recordedAttendanceCount: 2, chargedRosterCount: 1, hasNote: true,
      reservationEvents: [{ id: "event", registrations: 3 }] });
    expect(report.trainings[1]).toMatchObject({ groupName: "Група 1", coachGroupReviewCandidate: false });
    expect(JSON.stringify(report)).not.toContain("Private note");
  });
  it("paginates sequentially and preserves the club filter and cutoff on every page", async () => {
    const { tx, db } = database([Array.from({ length: 200 }, (_, i) => session(`id-${i}`)), [session("last")]]);
    const opts = { ...options(), clubId: "10000000-0000-4000-8000-000000000001" };
    expect((await collectReport(db, opts)).total).toBe(201);
    expect(db.$transaction).toHaveBeenCalledTimes(2);
    const calls = tx.trainingSession.findMany.mock.calls.map(([args]) => args);
    expect(calls[1]).toMatchObject({ cursor: { id: "id-199" }, skip: 1, take: 200 });
    for (const call of calls) expect(call.where).toEqual({ clubId: opts.clubId, createdAt: { gte: opts.since, lt: opts.until } });
  });
  it("handles an empty interval without related lookups", async () => {
    const { tx, db } = database([[]]);
    expect((await collectReport(db, options())).trainings).toEqual([]);
    expect(tx.coachGroup.findMany).not.toHaveBeenCalled();
  });
});

it("groups readable output by club and coach IDs, retaining different clubs with the same name", () => {
  const training = { id: "one", clubId: "club-a", clubName: "Клуб", coachGroupId: "coach-a", coachGroupName: "Треньор 1", scopeType: "coachGroup", date: "2026-11-09", trainingTime: "18:00", status: "scheduled" };
  const text = formatReport({ since, untilExclusive: until, total: 3, trainings: [training, { ...training, id: "two", date: "2026-11-08", status: "cancelled" }, { ...training, id: "three", clubId: "club-b" }] });
  expect(text.match(/Клуб: Клуб/g)).toHaveLength(2);
  expect(text).toContain("Треньорска група: Треньор 1");
  expect(text.indexOf("08.11.2026")).toBeLessThan(text.indexOf("09.11.2026"));
  expect(text).toContain("отменена [two]");
});
it("resolves the coach name for custom-group sessions without relabeling their group", async () => {
  const { tx, db } = database([[session("one", { scopeType: "customGroup", scopeId: "custom", scopeKey: "custom_group:custom" })]]);
  tx.clubCustomTrainingGroup.findMany.mockResolvedValue([{ id: "custom", clubId: "club-a", name: "Група 1", coachGroup: { id: "coach", clubId: "club-a", name: "Треньор 1" } }]);
  const report = await collectReport(db, options());
  expect(report.trainings[0]).toMatchObject({ coachGroupName: "Треньор 1", groupName: "Група 1" });
  expect(formatReport(report)).toContain("18:00 · Група 1");
});
