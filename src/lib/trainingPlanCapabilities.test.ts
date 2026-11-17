import { beforeEach, expect, it, vi } from "vitest";
const findMany = vi.hoisted(() => vi.fn());
vi.mock("./db", () => ({ prisma: { clubTrainingPlanGrant: { findMany } } }));
import { trainingPlanCapabilities } from "./trainingPlanSubscriptions";
beforeEach(() => vi.resetAllMocks());
it("permits only the admin role to bypass subscription lookup", async () => {
  expect(await trainingPlanCapabilities("club", ["admin"])).toEqual({ enabled: false, canSave: true, canPrint: true });
  expect(findMany).not.toHaveBeenCalled();
});
it("uses only the requested club's active grants", async () => {
  findMany.mockResolvedValue([]);
  expect(await trainingPlanCapabilities("club", ["coach"])).toEqual({ enabled: false, canSave: false, canPrint: false });
  expect(findMany).toHaveBeenCalledWith({ where: { clubId: "club", revokedAt: null, startsAt: { lte: expect.any(Date) }, OR: [{ endsAt: null }, { endsAt: { gt: expect.any(Date) } }] }, take: 1 });
  findMany.mockResolvedValue([{ id:"grant", kind:"free", startsAt: new Date(0), endsAt:null, revokedAt:null, paymentId:null, amount:null }]);
  expect(await trainingPlanCapabilities("club", ["coach"])).toEqual({ enabled: true, canSave: true, canPrint: true });
});
