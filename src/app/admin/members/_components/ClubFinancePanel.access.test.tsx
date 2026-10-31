import { afterEach, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { CalculatorAccess } from '@/lib/calculatorSubscriptionDomain';
const hooks=vi.hoisted(()=>({effects:[] as Array<()=>void|(()=>void)>,state:[] as unknown[],setters:[] as ReturnType<typeof vi.fn>[]}));
vi.mock('react',async original=>({...await original<typeof import('react')>(),
 useEffect:(effect:()=>void|(()=>void))=>hooks.effects.push(effect),
 useState:(initial:unknown)=>{const setter=vi.fn();hooks.setters.push(setter);return [hooks.state.length?hooks.state.shift():initial,setter];},
 useRef:(current:unknown)=>({current}),
}));
import ClubFinancePanel from './ClubFinancePanel';
afterEach(()=>{hooks.effects=[];hooks.state=[];hooks.setters=[];vi.useRealTimers();vi.unstubAllGlobals();});
const access:CalculatorAccess={enabled:false,canView:false,billingMode:'monthly',price:'10.00',periods:[]};
it('shows dues and a blurred placeholder without financial totals or forms, keeping the report link',()=>{
 hooks.state=[{...access,debtSummary:{outstanding:'1785.00',count:8,incomplete:false}},'club-a',''];
 const html=renderToStaticMarkup(<ClubFinancePanel clubId="club-a" compact/>);
 expect(html).toContain('Финанси');expect(html).toContain('не е активиран');expect(html).not.toContain('10.00 EUR');
 expect(html).toContain('Баланс');expect(html).toContain('Задължения');expect(html).toContain('1785,00');expect(html).toContain('8 състезатели');expect(html).toContain('Балансът е заключен');expect(html).toContain('href="/admin/clubs/club-a/finance"');expect(html).toContain('Виж финансите');expect(html).not.toContain('<form');
});
it('checks access on focus and at expiry and never requests financial data while locked',async()=>{
 vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-31T12:00:00Z'));
 const events=new EventTarget();const listeners={addEventListener:events.addEventListener.bind(events),removeEventListener:events.removeEventListener.bind(events)};
 vi.stubGlobal('window',listeners);vi.stubGlobal('document',{...listeners,hidden:false});
 const fetch=vi.fn().mockImplementation(async()=>Response.json({...access,periods:[{kind:'paid',startsAt:'2026-10-01T00:00:00Z',endsAt:'2026-10-31T12:00:10Z'}]}));vi.stubGlobal('fetch',fetch);
 ClubFinancePanel({clubId:'club-a'});const cleanups=hooks.effects.map(e=>e());
 await vi.advanceTimersByTimeAsync(0);expect(fetch).toHaveBeenCalledTimes(1);
 await vi.advanceTimersByTimeAsync(10100);expect(fetch).toHaveBeenCalledTimes(2);
 events.dispatchEvent(new Event('focus'));await vi.advanceTimersByTimeAsync(0);expect(fetch).toHaveBeenCalledTimes(3);
 expect(fetch.mock.calls.every(c=>c[0]==='/api/admin/clubs/club-a/calculator-access')).toBe(true);
 expect(hooks.setters[0]).toHaveBeenLastCalledWith(expect.objectContaining({enabled:false}));
 cleanups.forEach(c=>c?.());
});
it('clears the entitlement on refresh failure so the dashboard unmounts',async()=>{
 const events=new EventTarget();const listeners={addEventListener:events.addEventListener.bind(events),removeEventListener:events.removeEventListener.bind(events)};
 vi.stubGlobal('window',listeners);vi.stubGlobal('document',{...listeners,hidden:false});vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json({error:'Unavailable'},{status:503})));
 ClubFinancePanel({clubId:'club-a'});const cleanups=hooks.effects.map(e=>e());
 await new Promise(resolve=>setTimeout(resolve,0));
 expect(hooks.setters[0]).toHaveBeenCalledWith(null);expect(hooks.setters[2]).toHaveBeenCalledWith('Unavailable');
 cleanups.forEach(c=>c?.());
});

it('does not show an access-checking loader while loading the widget',()=>{
 const html=renderToStaticMarkup(<ClubFinancePanel clubId="club-a" compact/>);
 expect(html).toContain('Баланс');expect(html).toContain('Задължения');expect(html).not.toContain('Проверка на достъпа');
});

it('keeps the inactive admin notice outside the reporting-period dropdown',()=>{
 hooks.state=[{...access,canView:true},'club-a',''];
 const html=renderToStaticMarkup(<ClubFinancePanel clubId="club-a"/>);
 const notice=html.indexOf('Калкулаторът е неактивен.');
 expect(notice).toBeGreaterThan(-1);expect(notice).toBeLessThan(html.indexOf('<details'));
});

it('renders a locked coach page preview instead of replacing the page with a lock message',()=>{
 hooks.state=[access,'club-a',''];
 const html=renderToStaticMarkup(<ClubFinancePanel clubId="club-a"/>);
 expect(html).toContain('Финанси на клуба');expect(html).toContain('aria-label="Калкулаторът е заключен"');
 expect(html).toContain('Данните в тази секция са достъпни');
 expect(html).not.toContain('Администраторският преглед');
});
