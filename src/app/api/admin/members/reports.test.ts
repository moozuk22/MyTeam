import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";
const mocks = vi.hoisted(() => ({ session:vi.fn(), club:vi.fn(), coach:vi.fn(), reports:vi.fn() }));
vi.mock("@/lib/adminAuth", () => ({verifyAdminToken:mocks.session}));
vi.mock("@/lib/playerPaymentReports", () => ({getPlayerPaymentReports:mocks.reports}));
vi.mock("@/lib/db", () => ({prisma:{club:{findUnique:mocks.club},coachGroup:{findFirst:mocks.coach}}}));
const club="00000000-0000-4000-8000-000000000001";
const group="00000000-0000-4000-8000-000000000002";
function request(query=`clubId=${club}`) { return new NextRequest(`http://localhost/api/admin/members?forReport=true&${query}`,{headers:{cookie:"admin_session=test"}}); }
beforeEach(()=>{vi.clearAllMocks();mocks.session.mockResolvedValue({roles:["admin"]});mocks.club.mockResolvedValue({id:club});mocks.coach.mockResolvedValue({id:group});mocks.reports.mockResolvedValue([{id:"archive",isDeleted:true,fullName:"Име",paymentLogs:[{amount:"30.00"}]}]);});
it("returns archived report records only through the report query",async()=>{
 const response=await GET(request(`clubId=${club}&coachGroupId=${group}`));
 expect(response.status).toBe(200);expect(await response.json()).toEqual([{id:"archive",isDeleted:true,fullName:"Име",paymentLogs:[{amount:"30.00"}]}]);
 expect(mocks.coach).toHaveBeenCalledWith({where:{id:group,clubId:club},select:{id:true}});
 expect(mocks.reports).toHaveBeenCalledWith(club,group,"");
});
it("rejects cross-club report access",async()=>{
 mocks.session.mockResolvedValue({roles:["coach"],defaultClubId:"other-club"});
 expect((await GET(request())).status).toBe(403);expect(mocks.reports).not.toHaveBeenCalled();
});
it("requires a selected club and valid authentication",async()=>{
 expect((await GET(request(""))).status).toBe(400);
 mocks.session.mockResolvedValue(null);expect((await GET(request())).status).toBe(401);
 expect(mocks.reports).not.toHaveBeenCalled();
});
it("rejects group filters that belong to another club",async()=>{
 mocks.coach.mockResolvedValue(null);expect((await GET(request(`clubId=${club}&coachGroupId=${group}`))).status).toBe(404);expect(mocks.reports).not.toHaveBeenCalled();
});
