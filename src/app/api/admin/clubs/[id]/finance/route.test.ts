import { beforeEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
const mocks = vi.hoisted(() => ({ access:vi.fn(), session: vi.fn(), get: vi.fn(), analysis: vi.fn(), mutate: vi.fn() }));
vi.mock('@/lib/calculatorSubscriptions',()=>({calculatorAccess:mocks.access}));
vi.mock('@/lib/adminAuth', () => ({ verifyAdminToken: mocks.session }));
vi.mock('@/lib/clubFinance', () => ({ financeId: (id: string) => id, getClubFinance: mocks.get, getClubFinanceAnalysis: mocks.analysis, mutateClubFinance: mocks.mutate }));
import { GET, POST } from './route';
const id = '00000000-0000-0000-0000-000000000001';
const context = { params: Promise.resolve({ id }) };
const request = (method = 'GET', body?: string, query = '') => new NextRequest(`http://localhost/api/admin/clubs/${id}/finance${query}`, { method, headers: { cookie: `admin_session=test; admin_last_club_id=${id}`, 'content-type': 'application/json' }, ...(body ? { body } : {}) });
beforeEach(() => { vi.resetAllMocks(); mocks.access.mockResolvedValue({enabled:true,canView:true}); mocks.get.mockResolvedValue({ outstanding: '40.00' }); mocks.mutate.mockResolvedValue({ ok: true }); });
it('requires a session', async () => {
 mocks.session.mockResolvedValue(null);
 expect((await GET(request(),context)).status).toBe(401);
 expect(mocks.get).not.toHaveBeenCalled();
});
it('allows club management and denies group requests', async () => {
 mocks.session.mockResolvedValue({ roles: ['coach'], defaultClubId: id });
 expect((await GET(request(),context)).status).toBe(200);
 expect((await POST(request('POST',JSON.stringify({ action: 'createExpense' })),context)).status).toBe(200);
 expect((await GET(request('GET',undefined,'?coachGroupId=group'),context)).status).toBe(403);
});
it('allows administrators and rejects malformed payloads and cross-origin writes', async () => {
 mocks.session.mockResolvedValue({ roles: ['admin'] });
 expect((await GET(request(),context)).status).toBe(200);
 expect((await POST(request('POST','[]'),context)).status).toBe(400);
 expect((await POST(request('POST','{'),context)).status).toBe(400);
 const crossOrigin = request('POST','{}'); crossOrigin.headers.set('origin','https://other.example');
 expect((await POST(crossOrigin,context)).status).toBe(403);
 expect(mocks.mutate).not.toHaveBeenCalled();
});

it('serves analysis to authenticated coaches', async () => {
 mocks.analysis.mockResolvedValue({year:2026,categories:[],rows:[]});
 mocks.session.mockResolvedValue({roles:['coach'],defaultClubId:id});
 expect((await GET(request('GET',undefined,'?view=analysis'),context)).status).toBe(200);
 expect(mocks.analysis).toHaveBeenCalledWith(id);
 expect(mocks.get).not.toHaveBeenCalled();
});

it('blocks unpaid club reads, analysis and writes, while allowing admin viewing only',async()=>{
 mocks.session.mockResolvedValue({roles:['coach'],defaultClubId:id});
 mocks.access.mockResolvedValue({enabled:false,canView:false});
 for(const query of ['', '?view=analysis'])expect((await GET(request('GET',undefined,query),context)).status).toBe(403);
 expect((await POST(request('POST','{}'),context)).status).toBe(403);
 expect(mocks.get).not.toHaveBeenCalled();expect(mocks.analysis).not.toHaveBeenCalled();expect(mocks.mutate).not.toHaveBeenCalled();
 mocks.session.mockResolvedValue({roles:['admin']});mocks.access.mockResolvedValue({enabled:false,canView:true});
 expect((await GET(request(),context)).status).toBe(200);
 expect((await POST(request('POST','{}'),context)).status).toBe(403);
});

it('allows inactive coaches to load only dues and category names for the locked preview',async()=>{
 mocks.session.mockResolvedValue({roles:['coach'],defaultClubId:id});mocks.access.mockResolvedValue({enabled:false,canView:false});
 expect((await GET(request('GET',undefined,'?view=dues'),context)).status).toBe(200);
 expect(mocks.get).toHaveBeenCalledWith(id,expect.any(URLSearchParams));
 expect((await GET(request('GET',undefined,'?view=analysis'),context)).status).toBe(403);
 expect((await POST(request('POST','{}','?view=dues'),context)).status).toBe(403);
});

it.each([null, undefined, 'other'])('allows coaches across clubs for finance views and writes (%s)', async defaultClubId => {
 mocks.session.mockResolvedValue({roles:['coach'],defaultClubId});
 mocks.analysis.mockResolvedValue({year:2026,categories:[],rows:[]});
 for (const query of ['', '?view=analysis', '?view=dues']) {
  expect((await GET(request('GET',undefined,query),context)).status).toBe(200);
 }
 expect((await POST(request('POST','{}'),context)).status).toBe(200);
 expect(mocks.get).toHaveBeenCalled();
 expect(mocks.analysis).toHaveBeenCalled();
 expect(mocks.mutate).toHaveBeenCalled();
});

it.each([undefined, '', 'invalid', '00000000-0000-0000-0000-000000000002'])('denies finance data and writes outside the remembered club (%s)', async remembered => {
 mocks.session.mockResolvedValue({roles:['coach'],defaultClubId:id});
 const req = (method='GET', query='') => {
  const value=request(method,method==='POST'?'{}':undefined,query);
  value.cookies.delete('admin_last_club_id');
  if (remembered !== undefined) value.cookies.set('admin_last_club_id',remembered);
  return value;
 };
 for(const query of ['', '?view=analysis', '?view=dues']) expect((await GET(req('GET',query),context)).status).toBe(403);
 expect((await POST(req('POST'),context)).status).toBe(403);
 expect(mocks.access).not.toHaveBeenCalled(); expect(mocks.get).not.toHaveBeenCalled();
 expect(mocks.analysis).not.toHaveBeenCalled(); expect(mocks.mutate).not.toHaveBeenCalled();
});
it('allows administrator finance reads without a remembered club', async () => {
 mocks.session.mockResolvedValue({roles:['admin']});
 const value=request(); value.cookies.delete('admin_last_club_id');
 expect((await GET(value,context)).status).toBe(200);
});
