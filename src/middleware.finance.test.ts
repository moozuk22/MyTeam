import { afterEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { SignJWT } from 'jose';
import { middleware } from './middleware';
afterEach(()=>vi.unstubAllEnvs());
it('lets assigned club coaches reach the finance page where entitlement is checked',async()=>{
 vi.stubEnv('ADMIN_SESSION_SECRET','finance-middleware-test');
 const clubId='00000000-0000-0000-0000-000000000001';
 const token=await new SignJWT({roles:['coach'],defaultClubId:clubId}).setProtectedHeader({alg:'HS256'}).setSubject('coach').sign(new TextEncoder().encode('finance-middleware-test'));
 const request=(path:string)=>new NextRequest(`http://localhost${path}`,{headers:{cookie:`admin_session=${token}`}});
 expect((await middleware(request(`/admin/clubs/${clubId}/finance`))).status).toBe(200);
 expect((await middleware(request(`/admin/clubs/${clubId}/billing`))).status).toBe(307);
 expect((await middleware(request('/admin/subscriptions'))).status).toBe(307);
 expect((await middleware(request('/admin/clubs/00000000-0000-0000-0000-000000000003/finance'))).status).toBe(307);
});

it('allows the finance page for the unscoped coach sessions issued by login',async()=>{
 vi.stubEnv('ADMIN_SESSION_SECRET','finance-middleware-test');
 const token=await new SignJWT({roles:['coach'],defaultClubId:null}).setProtectedHeader({alg:'HS256'}).setSubject('coach').sign(new TextEncoder().encode('finance-middleware-test'));
 const request=new NextRequest('http://localhost/admin/clubs/00000000-0000-0000-0000-000000000001/finance',{headers:{cookie:`admin_session=${token}`}});
 expect((await middleware(request)).status).toBe(200);
});
