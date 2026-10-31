import { afterEach, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { CalculatorSummary } from './ClubSubscriptionSummary';
import type { CalculatorAccess } from '@/lib/calculatorSubscriptionDomain';
const base:CalculatorAccess={enabled:true,canView:true,billingMode:'yearly',price:'100.00',periods:[{kind:'paid',startsAt:'2026-09-30T21:00:00Z',endsAt:'2027-09-30T21:00:00Z'}]};
afterEach(()=>vi.useRealTimers());
it('shows active calculator status, billing mode and Sofia coverage dates without pricing',()=>{
 vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-31T12:00:00Z'));
 const html=renderToStaticMarkup(<CalculatorSummary asOf={new Date('2026-10-31T12:00:00Z').getTime()} calculator={base}/>);
 expect(html).toContain('Активен');expect(html).not.toContain('100.00 EUR');expect(html).not.toContain('Годишен');expect(html).toContain('Изтича на');expect(html).toContain('1.10.2026');expect(html).toContain('30.09.2027');
});
it('shows only inactive status without expiry, pricing or coverage',()=>{
 const html=renderToStaticMarkup(<CalculatorSummary asOf={new Date('2026-10-31T12:00:00Z').getTime()} calculator={{...base,enabled:false}}/>);
 expect(html).toContain('Неактивен');expect(html).not.toContain('100.00 EUR');expect(html).not.toContain('Годишен');expect(html).not.toContain('Изтича на');expect(html).not.toContain('Активно покритие');
});
it('shows free trial access instead of the paid price',()=>{
 vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-31T12:00:00Z'));
 const html=renderToStaticMarkup(<CalculatorSummary asOf={new Date('2026-10-31T12:00:00Z').getTime()} calculator={{...base,periods:[{...base.periods[0],kind:'trial'}]}}/>);
 expect(html).not.toContain('Текуща цена');expect(html).toContain('30.09.2027');expect(html).not.toContain('100.00 EUR');
});

it('shows the end of consecutive paid coverage instead of the first monthly boundary',()=>{
 const calculator={...base,periods:[{kind:'paid',startsAt:'2026-09-30T21:00:00Z',endsAt:'2026-10-31T22:00:00Z'},{kind:'paid',startsAt:'2026-10-31T22:00:00Z',endsAt:'2026-11-30T22:00:00Z'}]};
 const html=renderToStaticMarkup(<CalculatorSummary calculator={calculator} asOf={new Date('2026-10-31T12:00:00Z').getTime()}/>);
 expect(html).toContain('30.11.2026 г. включително');
});
it('shows permanent access without an expiry date',()=>{
 const html=renderToStaticMarkup(<CalculatorSummary calculator={{...base,periods:[{...base.periods[0],endsAt:null}]}} asOf={new Date('2026-10-31T12:00:00Z').getTime()}/>);
 expect(html).toContain('Безсрочно');
});
