import { describe, expect, it } from "vitest";
import { coachSections, filterGroups, NO_COACH_ID } from "@/lib/exercise/microcycleGroupFilter";

const ivan = { id: "c1", name: "Иван Петров" };
const maria = { id: "c2", name: "Мария Георгиева" };
const groups = [
  { key: "g10", name: "Група 10", coach: ivan },
  { key: "g2", name: "Група 2", coach: maria },
  { key: "g1", name: "група 1", coach: ivan },
  { key: "u12", name: "U12 Момичета", coach: null },
];

describe("filterGroups", () => {
  it("sorts in natural Bulgarian order (Cyrillic first), ignoring letter case", () => {
    expect(filterGroups(groups, "").map(g => g.name)).toEqual(["група 1", "Група 2", "Група 10", "U12 Момичета"]);
  });
  it("matches part of the name without regard to case or extra spaces", () => {
    expect(filterGroups(groups, "  ГРУПА   1 ").map(g => g.key)).toEqual(["g1", "g10"]);
    expect(filterGroups(groups, "момич").map(g => g.key)).toEqual(["u12"]);
    expect(filterGroups(groups, "няма такава")).toEqual([]);
  });
});

describe("coachSections", () => {
  it("groups by coach in natural order with „Без треньор“ last", () => {
    expect(coachSections(groups, "").map(s => [s.name, s.groups.map(g => g.key)])).toEqual([
      ["Иван Петров", ["g1", "g10"]],
      ["Мария Георгиева", ["g2"]],
      ["Без треньор", ["u12"]],
    ]);
  });
  it("keeps all groups of a coach whose name matches", () => {
    const [section, ...rest] = coachSections(groups, "мария");
    expect(rest).toEqual([]);
    expect(section).toMatchObject({ id: "c2", matchesCoach: true });
    expect(section.groups.map(g => g.key)).toEqual(["g2"]);
  });
  it("keeps only matching groups and drops coaches without matches", () => {
    expect(coachSections(groups, "10").map(s => [s.id, s.groups.map(g => g.key)])).toEqual([["c1", ["g10"]]]);
  });
  it("does not match the „Без треньор“ label as a coach name", () => {
    expect(coachSections(groups, "без треньор")).toEqual([]);
    expect(coachSections(groups, "u12")[0].id).toBe(NO_COACH_ID);
  });
});
