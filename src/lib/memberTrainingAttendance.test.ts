import { expect, it } from "vitest";
import { buildMemberTrainingAttendanceRequest } from "./memberTrainingAttendance";

it.each(["attend", "optOut"] as const)("targets only the selected same-day training for %s", (action) => {
  const sessions = [{ id: "morning" }, { id: "evening" }];
  expect(buildMemberTrainingAttendanceRequest({ date: "2026-11-06", sessions }, sessions[1], action, { reasonCode: "sick", reasonText: null })).toMatchObject({ trainingDate: "2026-11-06", trainingSessionId: "evening" });
});
it("refuses a day-wide write when multiple sessions lack an individual selection", () => {
  expect(() => buildMemberTrainingAttendanceRequest({ date: "2026-11-06", sessions: [{}, {}] }, null, "optOut")).toThrow();
});
it("preserves the date fallback for a single unmaterialized training", () => {
  expect(buildMemberTrainingAttendanceRequest({ date: "2026-11-06", sessions: [{}] }, null, "attend")).toEqual({ trainingDate: "2026-11-06" });
});

it("targets an unmaterialized custom training by scope", () => {
  const sessions = [{ scopeKey: "custom_group:first" }, { scopeKey: "custom_group:second" }];
  expect(buildMemberTrainingAttendanceRequest({ date: "2026-11-06", sessions }, sessions[1], "optOut")).toMatchObject({ trainingScopeKey: "custom_group:second" });
});
