import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ club: vi.fn(), custom: vi.fn(), schedule: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: { club: { findUnique: mocks.club }, clubCustomTrainingGroup: { findMany: mocks.custom }, clubTrainingScheduleGroup: { findMany: mocks.schedule } } }));
import { microcycleGroups } from "@/lib/exercise/microcycleGroups";
beforeEach(() => vi.clearAllMocks());

it("returns custom groups with their coach in natural order and enables the coach view", async () => {
  mocks.club.mockResolvedValue({ trainingGroupMode: "custom_group", name: "Club" });
  mocks.custom.mockResolvedValue([
    { id: "a", name: "Група 10", coachGroup: { id: "c1", name: "Иван" } },
    { id: "b", name: "Група 2", coachGroup: null },
  ]);
  const result = await microcycleGroups("club");
  expect(result?.coachView).toBe(true);
  expect(result?.groups).toEqual([
    { key: "custom:b", name: "Група 2", coach: null },
    { key: "custom:a", name: "Група 10", coach: { id: "c1", name: "Иван" } },
  ]);
});

it("disables the coach view for one coach's read-only groups", async () => {
  mocks.club.mockResolvedValue({ trainingGroupMode: "team_group", name: "Club" });
  mocks.custom.mockResolvedValue([]);
  const result = await microcycleGroups("club", "c1");
  expect(mocks.custom).toHaveBeenCalledWith(expect.objectContaining({ where: { clubId: "club", coachGroupId: "c1" } }));
  expect(result?.coachView).toBe(false);
});

it("disables the coach view for team groups, which have no coach link", async () => {
  mocks.club.mockResolvedValue({ trainingGroupMode: "team_group", name: "Club" });
  mocks.schedule.mockResolvedValue([{ id: "x", name: "2014" }, { id: "y", name: "2012" }]);
  const result = await microcycleGroups("club");
  expect(result?.coachView).toBe(false);
  expect(result?.groups.map(g => g.name)).toEqual(["2012", "2014"]);
});
