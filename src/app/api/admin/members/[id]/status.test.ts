import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { DELETE, PATCH } from "./route";
const mocks = vi.hoisted(() => ({ session: vi.fn(), findUnique: vi.fn(), update: vi.fn(), cards: vi.fn(), transaction: vi.fn() }));
vi.mock("@/lib/adminAuth", () => ({ verifyAdminToken: mocks.session }));
vi.mock("@/lib/memberEvents", () => ({ publishMemberUpdated: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma:{ player:{findUnique:mocks.findUnique,update:mocks.update},card:{updateMany:mocks.cards},$transaction:mocks.transaction }, withPrismaPoolRetry:(fn:()=>unknown)=>fn() }));
const club = "00000000-0000-4000-8000-000000000001";
const id = "00000000-0000-4000-8000-000000000002";
const context = { params: Promise.resolve({ id }) };
function request(body?: unknown, method = "DELETE", origin?: string) {
 return new NextRequest(`http://localhost/api/admin/members/${id}`,{method,headers:{cookie:"admin_session=test","Content-Type":"application/json",...(origin?{origin}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
}
beforeEach(() => {
 vi.clearAllMocks(); mocks.session.mockResolvedValue({ roles:["admin"] });
 mocks.findUnique.mockResolvedValue({id,clubId:club}); mocks.transaction.mockResolvedValue([]);
});
it.each([true,false])("saves the explicit removal month choice: %s", async (includeCurrentMonth) => {
 expect((await DELETE(request({includeCurrentMonth}),context)).status).toBe(200);
 expect(mocks.update).toHaveBeenCalledWith({where:{id},data:{isActive:false,reportIncludeRemovalMonth:includeCurrentMonth}});
 expect(mocks.cards).toHaveBeenCalledWith({where:{playerId:id},data:{isActive:false}});
});
it.each([undefined,{}, {includeCurrentMonth:"false"}])("rejects missing or invalid month choices", async body => {
 expect((await DELETE(request(body),context)).status).toBe(400);
 expect(mocks.transaction).not.toHaveBeenCalled();
});
it("rejects a coach assigned to another club", async () => {
 mocks.session.mockResolvedValue({roles:["coach"],defaultClubId:"other"});
 expect((await DELETE(request({includeCurrentMonth:true}),context)).status).toBe(403);
 expect((await PATCH(request({action:"delete_permanently"},"PATCH"),context)).status).toBe(403);
 expect(mocks.transaction).not.toHaveBeenCalled();
});
it("rejects untrusted origins and unauthenticated removal", async () => {
 expect((await DELETE(request({includeCurrentMonth:true},"DELETE","https://untrusted.invalid"),context)).status).toBe(403);
 mocks.session.mockResolvedValue(null);
 expect((await DELETE(request({includeCurrentMonth:true}),context)).status).toBe(401);
 expect(mocks.transaction).not.toHaveBeenCalled();
});
