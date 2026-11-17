import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";

const mocks = vi.hoisted(() => ({ verify: vi.fn(), find: vi.fn() }));
vi.mock("@/lib/adminAuth", () => ({ verifyAdminToken: mocks.verify }));
vi.mock("@/lib/db", () => ({ prisma: { clubCustomTrainingGroup: { findMany: mocks.find } } }));
const clubId = "11111111-1111-4111-8111-111111111111";
const coachGroupId = "22222222-2222-4222-8222-222222222222";
function get(query = "", cookie = true) {
  return GET(new NextRequest(`http://localhost/api/admin/clubs/${clubId}/message-groups${query}`, {
    headers: cookie ? { cookie: "admin_session=test" } : {},
  }), { params: Promise.resolve({ id: clubId }) });
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.verify.mockResolvedValue({ roles: ["coach"], defaultClubId: clubId });
  mocks.find.mockResolvedValue([
    { id: "main", name: "Основна", coachGroupId: null, players: [{ playerId: "a" }] },
    { id: "coach", name: "Начинаещи", coachGroupId, players: [{ playerId: "b" }] },
  ]);
});
it("returns groups from all coach pages for the main club page", async () => {
  const response = await get();
  expect(response.status).toBe(200);
  expect(mocks.find).toHaveBeenCalledWith(expect.objectContaining({ where: { clubId } }));
  expect(await response.json()).toEqual([
    { id: "main", name: "Основна", coachGroupId: null, playerIds: ["a"] },
    { id: "coach", name: "Начинаещи", coachGroupId, playerIds: ["b"] },
  ]);
});
it("limits coach pages to their own groups", async () => {
  await get(`?coachGroupId=${coachGroupId}`);
  expect(mocks.find).toHaveBeenCalledWith(expect.objectContaining({ where: { clubId, coachGroupId } }));
});
it("rejects requests without a session", async () => {
  expect((await get("", false)).status).toBe(401);
  expect(mocks.find).not.toHaveBeenCalled();
});
it("rejects another club for a club-bound coach", async () => {
  mocks.verify.mockResolvedValue({ roles: ["coach"], defaultClubId: "other" });
  expect((await get()).status).toBe(403);
  expect(mocks.find).not.toHaveBeenCalled();
});
it("allows an admin to select another club", async () => {
  mocks.verify.mockResolvedValue({ roles: ["admin"], defaultClubId: "other" });
  expect((await get()).status).toBe(200);
});
it("rejects an invalid coach group ID", async () => {
  expect((await get("?coachGroupId=invalid")).status).toBe(400);
  expect(mocks.find).not.toHaveBeenCalled();
});
it("preserves club access for an unscoped coach session", async () => {
  mocks.verify.mockResolvedValue({ roles: ["coach"], defaultClubId: null });
  expect((await get()).status).toBe(200);
});
it("limits player IDs to active players in the requested club", async () => {
  await get();
  expect(mocks.find).toHaveBeenCalledWith(expect.objectContaining({
    select: expect.objectContaining({ players: {
      where: { player: { clubId, isActive: true } }, select: { playerId: true },
    } }),
  }));
});
it("returns a safe error if the database request fails", async () => {
  mocks.find.mockRejectedValueOnce(new Error("private database detail"));
  const response = await get();
  expect(response.status).toBe(500);
  expect(await response.json()).toEqual({ error: "Неуспешно зареждане на групите." });
});
