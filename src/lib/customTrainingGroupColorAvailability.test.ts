import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/admin/clubs/[id]/custom-training-groups/route";
const mocks = vi.hoisted(() => ({ findMany: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: { clubCustomTrainingGroup: mocks } }));
vi.mock("@/lib/adminAuth", () => ({ verifyAdminToken: vi.fn().mockResolvedValue({ roles: ["coach"] }) }));
beforeEach(() => { vi.clearAllMocks(); mocks.findMany.mockResolvedValue([{ id: "other-coach-group", color: "#E53935" }]); });
it.each(["", "&coachGroupId=10000000-0000-4000-8000-000000000001"])("loads color reservations across the entire club (%s)", async scope => {
  const response = await GET(new NextRequest(`http://localhost/groups?colorsOnly=true${scope}`, { headers: { cookie: "admin_session=token" } }), { params: Promise.resolve({ id: "club" }) });
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual([{ id: "other-coach-group", color: "#E53935" }]);
  expect(mocks.findMany).toHaveBeenCalledWith({ where: { clubId: "club" }, select: { id: true, color: true } });
});
