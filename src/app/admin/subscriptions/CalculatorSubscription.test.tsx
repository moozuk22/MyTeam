import { expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
vi.mock('react',async original=>({
 ...await original<typeof import('react')>(),
 useState:(initial:unknown)=>[initial===null?{prices:[],revision:null}:initial,vi.fn()],
}));
import { SharedCalculatorPrices } from './CalculatorSubscription';
it('offers three billing choices but requires only one price',()=>{
 const html=renderToStaticMarkup(<SharedCalculatorPrices onSaved={()=>{}} onLoaded={()=>{}}/>);
 expect(html).toContain('name="billingMode"');
 for(const mode of ['monthly','yearly','lifetime'])expect(html).toContain(`value="${mode}"`);
 expect(html.match(/name="amount"/g)).toHaveLength(1);
 for(const mode of ['monthly','yearly','lifetime'])expect(html).not.toContain(`name="${mode}"`);
});

import { CalculatorHistory } from './CalculatorSubscription';
import type { CalculatorAdminView } from '@/lib/calculatorSubscriptions';
it('formats Sofia coverage dates and identifies voided payments without an action', () => {
 const data = {prices: [], grants: [{id: 'g', kind: 'paid', startsAt: '2026-09-30T21:00:00.000Z', endsAt: '2027-09-30T21:00:00.000Z', revokedAt: '2026-10-31T12:00:00Z', paymentId: 'p', amount: '10.00'}], payments: [{id: 'p', paidOn: '2026-10-31', billingMode: 'yearly', total: '10.00', voidedAt: '2026-10-31T12:00:00Z', note: ''}], changes: []} as unknown as CalculatorAdminView;
 const html = renderToStaticMarkup(<CalculatorHistory data={data} busy={false} onVoid={() => {}} />);
 expect(html).toContain('1 октомври 2026');
 expect(html).toContain('30 септември 2027');
 expect(html).toContain('Анулирано');
 expect(html).toContain('не предоставя достъп');
 expect(html).not.toContain('2026-09-30T21:00');
 expect(html).not.toContain('Анулирай плащането');
});
it('shows explanatory empty states for calculator history', () => {
 const data = {prices: [], grants: [], payments: [], changes: []} as unknown as CalculatorAdminView;
 const html = renderToStaticMarkup(<CalculatorHistory data={data} busy={false} onVoid={() => {}} />);
 expect(html).toContain('Използват се общите цени.');
 expect(html).toContain('Все още няма записани плащания.');
 expect(html).toContain('Няма записани промени.');
});

it('offers restoration on a voided receipt and retains the original amount', () => {
 const data = {prices: [], grants: [], payments: [{id:'p',paidOn:'2026-10-31',billingMode:'yearly',total:'10.00',voidedAt:'2026-10-31T12:00:00Z',note:''}], changes: [{id:'restore',action:'restore',createdAt:'2026-10-31T13:00:00Z',actorId:'admin',details:{total:'10.00',paidOn:'2026-10-31'}}]} as unknown as CalculatorAdminView;
 const html=renderToStaticMarkup(<CalculatorHistory data={data} busy={false} onVoid={()=>{}} onRestore={()=>{}} />);
 expect(html).toContain('Възстанови плащането и достъпа');
 expect(html).toContain('Възстановено плащане');
 expect(html).toContain('без второ плащане');
});

import { CalculatorPaymentConfirmation } from './CalculatorSubscription';
it.each(['restore', 'void'] as const)('renders a labelled custom %s confirmation with cancel and confirm actions', action => {
 const html = renderToStaticMarkup(<CalculatorPaymentConfirmation action={action} busy={false} onClose={() => {}} onConfirm={async () => {}} />);
 expect(html).toContain('<dialog');
 expect(html).toContain('aria-labelledby=');
 expect(html).toContain('aria-describedby=');
 expect(html).toContain('Отказ');
 expect(html).toContain(action === 'restore' ? 'Не се записва второ плащане.' : 'Записаните приходи и разходи се запазват.');
});
