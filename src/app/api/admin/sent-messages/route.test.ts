import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";

const mocks = vi.hoisted(() => ({ session: vi.fn(), list: vi.fn() }));
vi.mock("@/lib/adminAuth", () => ({ verifyAdminToken: mocks.session }));
vi.mock("@/lib/sentMessages", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/sentMessages")>()),
  listSentMessages: mocks.list,
}));
vi.mock("@/lib/db", () => ({ prisma: {} }));

const clubId = "11111111-1111-4111-8111-111111111111";
function request(query = "", authenticated = true) {
  return new NextRequest(`http://localhost/api/admin/sent-messages${query}`, {
    headers: authenticated ? { cookie: "admin_session=test" } : {},
  });
}

describe("sent message history API", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.session.mockResolvedValue({ sub: "user", roles: ["coach"] });
    mocks.list.mockResolvedValue({ messages: [], nextCursor: null });
  });

  it("rejects requests without a session", async () => {
    expect((await GET(request("", false))).status).toBe(401);
    mocks.session.mockResolvedValue(null);
    expect((await GET(request())).status).toBe(401);
    expect(mocks.list).not.toHaveBeenCalled();
  });

  it.each(["?clubId=bad", "?playerId=1", "?cursor=x", "?coachGroupId=1"])("rejects invalid filters %s", async query => {
    expect((await GET(request(query))).status).toBe(400);
    expect(mocks.list).not.toHaveBeenCalled();
  });

  it("uses the session user as the sender, not a request value", async () => {
    const response = await GET(request(`?clubId=${clubId}&senderUserId=other`));
    expect(await response.json()).toEqual({ view: "coach", messages: [], nextCursor: null });
    expect(mocks.list).toHaveBeenCalledWith({ userId: "user", view: "coach" }, { clubId, coachGroupId: null, playerId: null }, null);
  });
});
