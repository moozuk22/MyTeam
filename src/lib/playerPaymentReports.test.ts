import { beforeEach, expect, it, vi } from "vitest";
import { getPlayerPaymentReports } from "./playerPaymentReports";
const mocks = vi.hoisted(() => ({ players: vi.fn(), archives: vi.fn(), transaction: vi.fn() }));
vi.mock("@/lib/db", () => ({
 prisma: { $transaction: mocks.transaction }, withPrismaPoolRetry: (fn: () => unknown) => fn(),
}));
beforeEach(() => {
 vi.clearAllMocks();
 mocks.transaction.mockImplementation((fn) => fn({ player: { findMany: mocks.players }, playerReportArchive: { findMany: mocks.archives } }));
 mocks.players.mockResolvedValue([{ id: "live" }]);
 mocks.archives.mockResolvedValue([{ report: { id: "deleted", fullName: "Име", paymentLogs: [{ amount: "30.00" }] } }]);
});
it("returns live and archived report records from one consistent snapshot", async () => {
 expect(await getPlayerPaymentReports("club", "coach", "group")).toEqual([{ id: "live" }, { id: "deleted", fullName: "Име", paymentLogs: [{ amount: "30.00" }] }]);
 expect(mocks.transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: "RepeatableRead" });
 expect(mocks.players.mock.calls[0][0].where).toEqual({ clubId:"club",coachGroups:{some:{id:"coach",clubId:"club"}},customTrainingGroups:{some:{groupId:"group",group:{clubId:"club"}}} });
 expect(mocks.archives).toHaveBeenCalledWith({where:{clubId:"club",coachGroupIds:{has:"coach"},customGroupIds:{has:"group"}},select:{report:true}});
 expect(mocks.players.mock.calls[0][0].select).not.toHaveProperty("parentPhone");
});
it("keeps archive queries scoped to the selected club without group filters", async () => {
 await getPlayerPaymentReports("other-club", "", "");
 expect(mocks.archives.mock.calls[0][0].where).toEqual({clubId:"other-club"});
});
