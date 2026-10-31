import { afterEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { SignJWT } from 'jose';
import { middleware } from './middleware';
afterEach(()=>vi.unstubAllEnvs());
it('lets assigned club coaches reach the finance page where entitlement is checked',async()=>{
 vi.stubEnv('ADMIN_SESSION_SECRET','finance-middleware-test');
 const clubId='00000000-0000-0000-0000-000000000001';
 const token=await new SignJWT({roles:['coach'],defaultClubId:clubId}).setProtectedHeader({alg:'HS256'}).setSubject('coach').sign(new TextEncoder().encode('finance-middleware-test'));
 const request=(path:string)=>new NextRequest(`http://localhost${path}`,{headers:{cookie:`admin_session=${token}; admin_last_club_id=${clubId}`}});
 expect((await middleware(request(`/admin/clubs/${clubId}/finance`))).status).toBe(200);
 expect((await middleware(request(`/admin/clubs/${clubId}/billing`))).status).toBe(307);
 expect((await middleware(request('/admin/subscriptions'))).status).toBe(307);
 expect((await middleware(request('/admin/clubs/00000000-0000-0000-0000-000000000003/finance'))).status).toBe(307);
});

it('redirects coaches without a remembered club away from finance',async()=>{
 vi.stubEnv('ADMIN_SESSION_SECRET','finance-middleware-test');
 const token=await new SignJWT({roles:['coach'],defaultClubId:null}).setProtectedHeader({alg:'HS256'}).setSubject('coach').sign(new TextEncoder().encode('finance-middleware-test'));
 const request=new NextRequest('http://localhost/admin/clubs/00000000-0000-0000-0000-000000000001/finance',{headers:{cookie:`admin_session=${token}`}});
 expect((await middleware(request)).status).toBe(307);
});

it('remembers a members-page club before calculator requests and switches access with that cookie',async()=>{
 vi.stubEnv('ADMIN_SESSION_SECRET','finance-middleware-test');
 const clubA='00000000-0000-0000-0000-000000000001',clubB='00000000-0000-0000-0000-000000000002';
 const token=await new SignJWT({roles:['coach'],defaultClubId:null}).setProtectedHeader({alg:'HS256'}).setSubject('coach').sign(new TextEncoder().encode('finance-middleware-test'));
 const request=(path:string,remembered?:string)=>new NextRequest(`http://localhost${path}`,{headers:{cookie:`admin_session=${token}${remembered?`; admin_last_club_id=${remembered}`:''}`}});
 const response=await middleware(request(`/admin/members?clubId=${clubB}`,clubA));
 expect(response.cookies.get('admin_last_club_id')?.value).toBe(clubB);
 expect((await middleware(request(`/admin/clubs/${clubB}/finance`,clubB))).status).toBe(200);
 expect((await middleware(request(`/admin/clubs/${clubA}/finance`,clubB))).status).toBe(307);
 expect((await middleware(request('/admin/members?clubId=invalid',clubA))).cookies.get('admin_last_club_id')).toBeUndefined();
});
