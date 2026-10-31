import { beforeEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
const mocks = vi.hoisted(() => ({ access:vi.fn(), session: vi.fn(), get: vi.fn(), analysis: vi.fn(), mutate: vi.fn() }));
vi.mock('@/lib/calculatorSubscriptions',()=>({calculatorAccess:mocks.access}));
vi.mock('@/lib/adminAuth', () => ({ verifyAdminToken: mocks.session }));
vi.mock('@/lib/clubFinance', () => ({ financeId: (id: string) => id, getClubFinance: mocks.get, getClubFinanceAnalysis: mocks.analysis, mutateClubFinance: mocks.mutate }));
import { GET, POST } from './route';
const id = '00000000-0000-0000-0000-000000000001';
const context = { params: Promise.resolve({ id }) };
const request = (method = 'GET', body?: string, query = '') => new NextRequest(`http://localhost/api/admin/clubs/${id}/finance${query}`, { method, headers: { cookie: 'admin_session=test', 'content-type': 'application/json' }, ...(body ? { body } : {}) });
beforeEach(() => { vi.resetAllMocks(); mocks.access.mockResolvedValue({enabled:true,canView:true}); mocks.get.mockResolvedValue({ outstanding: '40.00' }); mocks.mutate.mockResolvedValue({ ok: true }); });
it('requires a session and prevents cross-club coach access', async () => {
 mocks.session.mockResolvedValue(null);
 expect((await GET(request(),context)).status).toBe(401);
 mocks.session.mockResolvedValue({ roles: ['coach'], defaultClubId: 'other' });
 expect((await GET(request(),context)).status).toBe(403);
 expect(mocks.get).not.toHaveBeenCalled();
 mocks.session.mockResolvedValue({ roles: ['coach'], defaultClubId: null });
 expect((await GET(request(),context)).status).toBe(200);
 mocks.get.mockClear();
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

it('serves analysis only after the same club authorization as history', async () => {
 mocks.analysis.mockResolvedValue({year:2026,categories:[],rows:[]});
 mocks.session.mockResolvedValue({roles:['coach'],defaultClubId:'other'});
 expect((await GET(request('GET',undefined,'?view=analysis'),context)).status).toBe(403);
 expect(mocks.analysis).not.toHaveBeenCalled();
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
