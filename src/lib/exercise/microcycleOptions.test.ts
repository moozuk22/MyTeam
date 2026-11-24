import { afterEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { shiftWeek } from "./microcycle";

const mocks = vi.hoisted(() => ({ queryRaw: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: { $queryRaw: mocks.queryRaw } }));
vi.mock("@/lib/exercise/access", () => ({ authorizeTraining: vi.fn().mockResolvedValue({ roles: ["coach"] }), findTrainingPlanCoachGroup: vi.fn().mockResolvedValue({ id: "g" }), UUID_RE: /./ }));
vi.mock("@/lib/exercise/microcycleGroups", () => ({ microcycleGroups: vi.fn().mockResolvedValue({ groups: [{ key: "custom:a", name: "А" }] }) }));
import { GET } from "@/app/api/admin/clubs/[id]/training-plans/microcycles/options/route";

afterEach(() => vi.useRealTimers());

it("starts the window from the Monday of the Sofia week", async () => {
  // Monday 00:30 in Sofia is still Sunday in UTC.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-22T22:30:00Z"));
  mocks.queryRaw.mockResolvedValue([]);
  const response = await GET(new NextRequest("http://localhost/api?coachGroupId=33333333-3333-4333-8333-333333333333"), { params: Promise.resolve({ id: "club" }) });
  expect(response.status).toBe(200);
  expect(mocks.queryRaw.mock.calls[0]).toContain(shiftWeek("2026-11-23", -7 * 53));
});
