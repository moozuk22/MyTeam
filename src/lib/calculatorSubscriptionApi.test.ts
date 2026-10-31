import { beforeEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
const mocks=vi.hoisted(()=>({session:vi.fn(),access:vi.fn(),view:vi.fn(),change:vi.fn(),prices:vi.fn(),changePrices:vi.fn(),latest:vi.fn()}));
vi.mock('./clubFinance',()=>({getClubDebtSummary:vi.fn().mockResolvedValue({outstanding:'40.00',count:2,incomplete:false})}));
vi.mock('./adminAuth',()=>({verifyAdminToken:mocks.session}));
vi.mock('./calculatorSubscriptions',()=>({calculatorAccess:mocks.access,calculatorAdminView:mocks.view,changeCalculatorSubscription:mocks.change,calculatorPrices:mocks.prices,changeCalculatorPrices:mocks.changePrices}));
vi.mock('./db',()=>({prisma:{calculatorPriceRevision:{findFirst:mocks.latest}}}));
import { getClubDebtSummary } from './clubFinance';
import { GET as access } from '@/app/api/admin/clubs/[id]/calculator-access/route';
import { GET as config, POST as change } from '@/app/api/admin/subscriptions/[clubId]/calculator/route';
import { GET as prices, POST as changePrices } from '@/app/api/admin/subscriptions/calculator-prices/route';
const id='00000000-0000-0000-0000-000000000001';
const request=(method='GET',body?:string,query='')=>new NextRequest(`http://localhost/api/test${query}`,{method,headers:{cookie:`admin_session=token; admin_last_club_id=${id}`,'content-type':'application/json'},...(body?{body}: {})});
const clubContext={params:Promise.resolve({clubId:id})},context={params:Promise.resolve({id})};
beforeEach(()=>{vi.resetAllMocks();vi.mocked(getClubDebtSummary).mockResolvedValue({outstanding:'40.00',count:2,incomplete:false});mocks.view.mockResolvedValue({version:0});mocks.change.mockResolvedValue({ok:true});mocks.prices.mockResolvedValue([]);mocks.latest.mockResolvedValue(null);mocks.access.mockResolvedValue({enabled:false,canView:false,periods:[]});});
it('requires platform admin for configuration, purchases and shared prices',async()=>{
 mocks.session.mockResolvedValue(null);expect((await config(request(),clubContext)).status).toBe(401);
 mocks.session.mockResolvedValue({roles:['coach'],defaultClubId:id});
 for(const response of [await config(request(),clubContext),await change(request('POST','{}'),clubContext),await prices(request()),await changePrices(request('POST','{}'))])expect(response.status).toBe(403);
 expect(mocks.change).not.toHaveBeenCalled();expect(mocks.changePrices).not.toHaveBeenCalled();
});
it('allows club-safe summaries to coaches and platform admins',async()=>{
 mocks.session.mockResolvedValue({roles:['coach'],defaultClubId:null});expect((await access(request(),context)).status).toBe(200);
 mocks.session.mockResolvedValue({roles:['coach'],defaultClubId:'other'});expect((await access(request(),context)).status).toBe(200);
 mocks.session.mockResolvedValue({roles:['coach'],defaultClubId:id});
 const summary=await access(request(),context);expect(summary.status).toBe(200);
 expect(await summary.json()).toMatchObject({canView:false,debtSummary:{outstanding:'40.00',count:2,incomplete:false}});
 expect((await access(request('GET',undefined,'?coachGroupId=group'),context)).status).toBe(403);
 mocks.session.mockResolvedValue({roles:['admin']});expect((await access(request(),context)).status).toBe(200);
 expect(mocks.access).toHaveBeenLastCalledWith(id,true);
});
it('rejects malformed bodies and cross-origin mutations and forwards actor IDs',async()=>{
 mocks.session.mockResolvedValue({roles:['admin'],sub:'admin-id'});
 for(const body of ['[]','null','{'])expect((await change(request('POST',body),clubContext)).status).toBeGreaterThanOrEqual(400);
 const crossOrigin=request('POST','{}');crossOrigin.headers.set('origin','https://evil.example');expect((await change(crossOrigin,clubContext)).status).toBe(403);
 expect((await change(request('POST','{"action":"grant","enabled":true,"expectedVersion":0}'),clubContext)).status).toBe(200);
 expect(mocks.change).toHaveBeenCalledWith(id,{action:'grant',enabled:true,expectedVersion:0},'admin-id');
 expect((await prices(request())).status).toBe(200);
});

it.each([null, undefined, 'other'])('allows coach calculator summaries regardless of default club (%s)', async defaultClubId => {
 mocks.session.mockResolvedValue({roles:['coach'],defaultClubId});
 expect((await access(request(),context)).status).toBe(200);
 expect(mocks.access).toHaveBeenCalledWith(id,false);
 expect(getClubDebtSummary).toHaveBeenCalledWith(id);
});

it.each([undefined, '', 'invalid', '00000000-0000-0000-0000-000000000002'])('denies calculator summaries outside the remembered club (%s)', async remembered => {
 mocks.session.mockResolvedValue({roles:['coach'],defaultClubId:id});
 const value=request(); value.cookies.delete('admin_last_club_id');
 if(remembered!==undefined)value.cookies.set('admin_last_club_id',remembered);
 expect((await access(value,context)).status).toBe(403);
 expect(mocks.access).not.toHaveBeenCalled(); expect(getClubDebtSummary).not.toHaveBeenCalled();
});
it('allows administrator calculator summaries without a remembered club',async()=>{
 mocks.session.mockResolvedValue({roles:['admin']});
 const value=request(); value.cookies.delete('admin_last_club_id');
 expect((await access(value,context)).status).toBe(200);
});
