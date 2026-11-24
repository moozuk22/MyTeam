import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ queryRaw: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: { $queryRaw: mocks.queryRaw } }));
vi.mock("@/lib/exercise/access", () => ({ authorizeTraining: vi.fn().mockResolvedValue({ roles: ["admin"] }), UUID_RE: /./ }));
import { GET } from "@/app/api/admin/clubs/[id]/training-plans/microcycles/history/route";

const context = { params: Promise.resolve({ id: "club" }) };
const rows = Array.from({ length: 21 }, (_, n) => ({ id: `c${n}`, week: "2026-11-09", number: "1", format: "", age: "", trainings: 1, groups: ["А"], own: false }));
const page = async (offset: number) => (await GET(new NextRequest(`http://localhost/api?week=2026-11-23&offset=${offset}`), context)).json();

beforeEach(() => { vi.clearAllMocks(); mocks.queryRaw.mockResolvedValue(rows); });

it("offers the next page only when its offset is in the limit", async () => {
  expect((await page(980)).more).toBe(true);
  // The next page would start at 1020, which the endpoint rejects.
  expect((await page(1000)).more).toBe(false);
  expect((await GET(new NextRequest("http://localhost/api?week=2026-11-23&offset=1020"), context)).status).toBe(400);
});
