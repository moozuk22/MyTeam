import { expect, it } from "vitest";
import { microcycleLink } from "./ClubNotificationsDialog";
it("shows the microcycle button only for a microcycle notification with a microcycle link", () => {
  const url = "/admin/training-plans/microcycles?clubId=c&coachGroupId=g&week=2026-11-16&groupKey=custom%3Aa";
  expect(microcycleLink({ type: "training_microcycle", url })).toBe(url);
  expect(microcycleLink({ type: "admin_message", url })).toBeNull();
  expect(microcycleLink({ type: "training_microcycle", url: "https://example.com/admin/training-plans/microcycles?x" })).toBeNull();
  expect(microcycleLink({ type: "training_microcycle", url: null })).toBeNull();
});
