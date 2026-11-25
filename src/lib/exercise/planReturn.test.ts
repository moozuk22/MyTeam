import { describe, expect, it } from "vitest";
import { newExerciseUrl, planReturnSearch, planReturnUrl, readPlanReturn, readReturnedExercise } from "./planReturn";

const club = "11111111-1111-4111-8111-111111111111";
const coach = "22222222-2222-4222-8222-222222222222";
const cycle = "33333333-3333-4333-8333-333333333333";
const row = "44444444-4444-4444-8444-444444444444";
const group = "custom:55555555-5555-4555-8555-555555555555";
const exercise = "66666666-6666-4666-8666-666666666666";
const training = new URLSearchParams({ clubId: club, coachGroupId: coach, document: "new", cycleId: cycle, rowId: row, groupKey: group, week: "2026-11-23" });
const from = `/admin/training-plans/documents?${training}`;

describe("plan return", () => {
  it("reads the plan document and its training back from the exercise editor link", () => {
    const url = new URL(newExerciseUrl(`clubId=${club}&coachGroupId=${coach}`, from, 2), "http://localhost");
    expect(url.pathname).toBe("/admin/training-plans/new");
    const planReturn = readPlanReturn(Object.fromEntries(url.searchParams), club, coach);
    expect(planReturn).toEqual({ href: from, section: 2, target: { cycleId: cycle, rowId: row, groupKey: group, week: "2026-11-23" } });
    expect(new URLSearchParams(planReturnSearch(planReturn!)).get("from")).toBe(from);
  });

  it("gives a library plan without a training", () => {
    const library = `/admin/training-plans/documents?clubId=${club}&document=new`;
    expect(readPlanReturn({ from: library, section: "0" }, club)).toEqual({ href: library, section: 0 });
  });

  it("keeps only the plan document keys", () => {
    const planReturn = readPlanReturn({ from: `${from}&exercise=${exercise}&next=https://example.com`, section: "1" }, club, coach);
    expect(planReturn?.href).toBe(from);
  });

  it.each([
    ["another page", `/admin/members?${training}`, "1"],
    ["an absolute URL", `https://example.com/admin/training-plans/documents?${training}`, "1"],
    ["another club", from.replace(club, coach), "1"],
    ["no plan", from.replace("&document=new", ""), "1"],
    ["a plan ID that is not valid", from.replace("document=new", "document=x"), "1"],
    ["a section that does not exist", from, "5"],
    ["no section", from, undefined],
  ])("gives null for %s", (_, value, section) => {
    expect(readPlanReturn({ from: value, section }, club, coach)).toBeNull();
  });

  it("gives null for another coach group", () => {
    expect(readPlanReturn({ from, section: "1" }, club)).toBeNull();
    expect(readPlanReturn({ from, section: "1" }, club, club)).toBeNull();
  });

  it("sends the new exercise and the section back to the plan document", () => {
    const url = new URL(planReturnUrl({ href: from, section: 3 }, exercise), "http://localhost");
    expect(url.searchParams.get("document")).toBe("new");
    expect(readReturnedExercise(Object.fromEntries(url.searchParams))).toEqual({ exercise, section: 3 });
    expect(planReturnUrl({ href: from, section: 3 })).toBe(from);
  });

  it.each([
    [{ exercise: "x", section: "1" }],
    [{ exercise, section: "9" }],
    [{ exercise }],
    [{ section: "1" }],
  ])("ignores a returned exercise that is not valid: %o", (query) => {
    expect(readReturnedExercise(query)).toBeUndefined();
  });
});
