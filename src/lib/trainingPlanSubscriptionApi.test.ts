import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ session: vi.fn(), view: vi.fn(), change: vi.fn(), prices: vi.fn(), changePrices: vi.fn(), latest: vi.fn() }));
vi.mock("@/lib/adminAuth", () => ({ verifyAdminToken: mocks.session }));
vi.mock("@/lib/trainingPlanSubscriptions", () => ({ trainingPlanAdminView: mocks.view, changeTrainingPlanSubscription: mocks.change, trainingPlanPrices: mocks.prices, changeTrainingPlanPrices: mocks.changePrices }));
vi.mock("@/lib/db", () => ({ prisma: { trainingPlanPriceRevision: { findFirst: mocks.latest } } }));
import { GET, POST } from "@/app/api/admin/subscriptions/[clubId]/training-plans/route";
import { GET as prices, POST as changePrices } from "@/app/api/admin/subscriptions/training-plan-prices/route";
const id = "11111111-1111-4111-8111-111111111111";
const context = { params: Promise.resolve({ clubId: id }) };
function request(method = "GET", body?: string, origin = "http://localhost") {
  return new NextRequest("http://localhost/api/admin/subscriptions", { method,
    headers: { cookie: "admin_session=test", origin, "content-type": "application/json" },
    ...(body === undefined ? {} : { body }),
  });
}
beforeEach(() => {
  vi.resetAllMocks();vi.stubEnv("APP_BASE_URL", "http://localhost");
  mocks.view.mockResolvedValue({ version: 0 });mocks.change.mockResolvedValue({ ok: true });
  mocks.prices.mockResolvedValue([]);mocks.latest.mockResolvedValue(null);mocks.changePrices.mockResolvedValue({ ok: true });
});
it("requires the admin role for subscription and price administration", async () => {
  mocks.session.mockResolvedValue(null);expect((await GET(request(), context)).status).toBe(401);
  mocks.session.mockResolvedValue({ roles: ["coach"], sub: "coach", defaultClubId: id });
  for (const result of [await GET(request(), context), await POST(request("POST", "{}"), context), await prices(request()), await changePrices(request("POST", "{}"))]) expect(result.status).toBe(403);
  expect(mocks.change).not.toHaveBeenCalled();expect(mocks.changePrices).not.toHaveBeenCalled();
});
it("checks origin and malformed input before mutations", async () => {
  mocks.session.mockResolvedValue({ roles: ["admin"], sub: "admin" });
  expect((await POST(request("POST", "{}", "https://other.example"), context)).status).toBe(403);
  for (const body of ["null", "[]", "{"]) expect((await POST(request("POST", body), context)).status).toBe(400);
  expect(mocks.change).not.toHaveBeenCalled();
});
it("uses separate storage and forwards the authenticated actor", async () => {
  mocks.session.mockResolvedValue({ roles: ["admin"], sub: "admin" });
  expect((await POST(request("POST", '{"action":"grant","enabled":true}'), context)).status).toBe(200);
  expect(mocks.change).toHaveBeenCalledWith(id, { action: "grant", enabled: true }, "admin");
  expect(await (await prices(request())).json()).toEqual({ prices: [], revision: null });
  await changePrices(request("POST", '{"billingMode":"monthly"}'));
  expect(mocks.changePrices).toHaveBeenCalledWith({ billingMode: "monthly" }, "admin");
});
