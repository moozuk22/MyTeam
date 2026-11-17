import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
const mocks = vi.hoisted(() => ({ verify: vi.fn(), access: vi.fn() }));
vi.mock("@/lib/adminAuth", () => ({ verifyAdminToken: mocks.verify }));
vi.mock("@/lib/trainingPlanSubscriptions", () => ({ trainingPlanCapabilities: mocks.access }));
import { authorizeTraining } from "./access";
import { GET } from "@/app/api/admin/clubs/[id]/training-plans/access/route";
const club = "11111111-1111-4111-8111-111111111111";
const id = "22222222-2222-4222-8222-222222222222";
const root = `http://localhost/api/admin/clubs/${club}/training-plans`;
function request(method: string, suffix = "") {
  return new NextRequest(root + suffix, { method, headers: { cookie: "admin_session=test", origin: "http://localhost" } });
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("APP_BASE_URL", "http://localhost");
  mocks.verify.mockResolvedValue({ sub: "coach", roles: ["coach"], defaultClubId: club });
  mocks.access.mockResolvedValue({ enabled: false, canSave: false, canPrint: false });
});
describe("training subscription enforcement", () => {
  it.each([["POST", ""], ["PUT", `/${id}`], ["PUT", `/%32${id.slice(1)}`], ["POST", "/documents"], ["PUT", `/documents/${id}`], ["PUT", `/documents/%32${id.slice(1)}`]])("blocks unpaid %s %s before writes", async (method, suffix) => {
    const result = await authorizeTraining(request(method, suffix), club, "save");
    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(403);
    expect(mocks.access).toHaveBeenCalledWith(club, ["coach"]);
  });
  it.each(["GET", "DELETE"])("keeps %s available without a subscription", async method => {
    expect(await authorizeTraining(request(method, `/${id}`), club)).not.toBeInstanceOf(NextResponse);
    expect(mocks.access).not.toHaveBeenCalled();
  });
  it("does not require save access for category changes", async () => {
    expect(await authorizeTraining(request("POST", "/categories"), club)).not.toBeInstanceOf(NextResponse);
    expect(mocks.access).not.toHaveBeenCalled();
  });
  it("allows subscribed saves and admin saves", async () => {
    mocks.access.mockResolvedValue({ enabled: true, canSave: true, canPrint: true });
    expect(await authorizeTraining(request("POST"), club, "save")).not.toBeInstanceOf(NextResponse);
    mocks.verify.mockResolvedValue({ sub: "admin", roles: ["admin"] });
    mocks.access.mockResolvedValue({ enabled: false, canSave: true, canPrint: true });
    expect(await authorizeTraining(request("POST"), club, "save")).not.toBeInstanceOf(NextResponse);
  });
  it("rejects cross-club access before the subscription check", async () => {
    mocks.verify.mockResolvedValue({ sub: "coach", roles: ["coach"], defaultClubId: id });
    expect((await GET(request("GET", "/access"), { params: Promise.resolve({ id: club }) })).status).toBe(403);
    expect(mocks.access).not.toHaveBeenCalled();
  });
  it("returns no-store capabilities without payment or audit records", async () => {
    const response = await GET(request("GET", "/access"), { params: Promise.resolve({ id: club }) });
    expect(await response.json()).toEqual({ enabled: false, canSave: false, canPrint: false });
    expect(response.headers.get("cache-control")).toContain("no-store");
  });
});
