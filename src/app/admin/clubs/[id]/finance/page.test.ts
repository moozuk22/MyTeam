import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ session: vi.fn(), club: vi.fn() }));
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => ({ value: 'token' }) }) }));
vi.mock('next/navigation', () => ({ redirect: (url: string) => { throw new Error(`redirect:${url}`); }, notFound: () => { throw new Error('not-found'); } }));
vi.mock('@/lib/adminAuth', () => ({ verifyAdminToken: mocks.session }));
vi.mock('@/lib/db', () => ({ prisma: { club: { findUnique: mocks.club } } }));
vi.mock('@/app/admin/members/_components/ClubFinancePanel', () => ({ default: () => null }));
import Page from './page';
const id = '00000000-0000-0000-0000-000000000001';
const context = { params: Promise.resolve({ id }) };
beforeEach(() => { vi.resetAllMocks(); mocks.club.mockResolvedValue({ name: 'Club' }); });
it('redirects signed-out visitors and blocks coaches from other clubs before querying data', async () => {
 mocks.session.mockResolvedValue(null);
 await expect(Page(context)).rejects.toThrow('redirect:/admin/login');
 mocks.session.mockResolvedValue({roles:['coach'],defaultClubId:'other'});
 await expect(Page(context)).rejects.toThrow('not-found');
 expect(mocks.club).not.toHaveBeenCalled();
});
it('renders the dedicated page for club management and administrators', async () => {
 mocks.session.mockResolvedValue({roles:['coach'],defaultClubId:id});
 expect(await Page(context)).toBeTruthy();
 mocks.session.mockResolvedValue({roles:['admin']});
 expect(await Page(context)).toBeTruthy();
 expect(mocks.club).toHaveBeenCalledWith({where:{id},select:{name:true,imageUrl:true,emblemUrl:true}});
});

it('resolves stored club logo upload paths before passing them to the dashboard', async () => {
 vi.stubEnv('CLOUDINARY_CLOUD_NAME', 'test-cloud');
 mocks.session.mockResolvedValue({roles:['admin']});
 mocks.club.mockResolvedValue({name:'Club',imageUrl:'v123/clubs/logo.png',emblemUrl:null});
 try {
  const page = await Page(context);
  expect(page.props.children[1].props.clubLogoUrl).toBe('https://res.cloudinary.com/test-cloud/image/upload/w_120,h_120,c_limit,f_auto,q_auto:eco/v123/clubs/logo.png');
 } finally { vi.unstubAllEnvs(); }
});
