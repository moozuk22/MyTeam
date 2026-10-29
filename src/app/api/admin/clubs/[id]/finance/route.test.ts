import { beforeEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
const mocks = vi.hoisted(() => ({ session: vi.fn(), get: vi.fn(), mutate: vi.fn() }));
vi.mock('@/lib/adminAuth', () => ({ verifyAdminToken: mocks.session }));
vi.mock('@/lib/clubFinance', () => ({ financeId: (id: string) => id, getClubFinance: mocks.get, mutateClubFinance: mocks.mutate }));
import { GET, POST } from './route';
const id = '00000000-0000-0000-0000-000000000001';
const context = { params: Promise.resolve({ id }) };
const request = (method = 'GET', body?: string, query = '') => new NextRequest(`http://localhost/api/admin/clubs/${id}/finance${query}`, { method, headers: { cookie: 'admin_session=test', 'content-type': 'application/json' }, ...(body ? { body } : {}) });
beforeEach(() => { vi.resetAllMocks(); mocks.get.mockResolvedValue({ outstanding: '40.00' }); mocks.mutate.mockResolvedValue({ ok: true }); });
it('requires a session and prevents cross-club coach access', async () => {
 mocks.session.mockResolvedValue(null);
 expect((await GET(request(),context)).status).toBe(401);
 mocks.session.mockResolvedValue({ roles: ['coach'], defaultClubId: 'other' });
 expect((await GET(request(),context)).status).toBe(403);
 mocks.session.mockResolvedValue({ roles: ['coach'], defaultClubId: null });
 expect((await GET(request(),context)).status).toBe(403);
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
