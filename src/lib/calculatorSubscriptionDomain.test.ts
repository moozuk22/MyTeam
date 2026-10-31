import { describe, expect, it } from 'vitest';
import { calculatorHasAccess, calculatorPrice, calculatorPurchase, type CalculatorGrant } from './calculatorSubscriptionDomain';
import { financeDayStart } from './clubFinanceDomain';
const prices=[{id:'a',effectiveMonth:'2026-01',monthly:'10.00',yearly:'100.00',lifetime:'500.00'},{id:'b',effectiveMonth:'2027-01',monthly:'12.00',yearly:'120.00',lifetime:'600.00'}];
describe('calculator pricing and coverage',()=>{
 it('uses effective shared prices and per-mode overrides with restoration',()=>{
  const overrides=[{billingMode:'monthly',effectiveMonth:'2026-03',amount:'7.00'},{billingMode:'monthly',effectiveMonth:'2027-03',amount:null}];
  expect(calculatorPrice(prices,overrides,'monthly','2026-02')).toBe('10.00');
  expect(calculatorPrice(prices,overrides,'monthly','2027-02')).toBe('7.00');
  expect(calculatorPrice(prices,overrides,'yearly','2027-02')).toBe('120.00');
  expect(calculatorPrice(prices,overrides,'monthly','2027-03')).toBe('12.00');
 });
 it('prices skipped months independently across years without accruing gap debt',()=>{
  expect(calculatorPurchase('monthly',['2027-01','2026-10'],prices,[])).toEqual({total:'22.00',periods:[{month:'2026-10',end:'2026-11',amount:'10.00'},{month:'2027-01',end:'2027-02',amount:'12.00'}]});
 });
 it('charges one annual price for twelve calendar months and one permanent price',()=>{
  expect(calculatorPurchase('yearly',['2026-11'],prices,[])).toEqual({total:'100.00',periods:[{month:'2026-11',end:'2027-11',amount:'100.00'}]});
  expect(calculatorPurchase('lifetime',['2026-11'],prices,[]).periods[0].end).toBeNull();
 });
 it('rejects duplicates, invalid months, missing prices and multiple annual starts',()=>{
  for(const input of [[],['2026-01','2026-01'],['2026-13'],['1999-01'],['2025-12']])expect(()=>calculatorPurchase('monthly',input,prices,[])).toThrow();
  expect(()=>calculatorPurchase('yearly',['2026-01','2027-01'],prices,[])).toThrow();
  expect(()=>calculatorPurchase('yearly',['2199-12'],prices,[])).toThrow();
 });
 it('uses half-open Sofia periods across DST, current coverage despite prior gaps, and revoked grants',()=>{
  const grant:CalculatorGrant={id:'g',kind:'paid',startsAt:financeDayStart('2026-10-01').toISOString(),endsAt:financeDayStart('2026-11-01').toISOString(),revokedAt:null,paymentId:'p',amount:'10.00'};
  expect(calculatorHasAccess([grant],new Date('2026-09-30T20:59:59Z'))).toBe(false);
  expect(calculatorHasAccess([grant],new Date('2026-09-30T21:00:00Z'))).toBe(true);
  expect(calculatorHasAccess([grant],new Date('2026-10-31T21:59:59Z'))).toBe(true);
  expect(calculatorHasAccess([grant],new Date('2026-10-31T22:00:00Z'))).toBe(false);
  expect(calculatorHasAccess([{...grant,revokedAt:'2026-10-05T00:00:00Z'}],new Date('2026-10-20'))).toBe(false);
  expect(calculatorHasAccess([{...grant,endsAt:null}],new Date('2090-01-01'))).toBe(true);
 });
});

it('keeps the other billing options unchanged when a single shared price is revised',()=>{
 const independent=[{id:'monthly',effectiveMonth:'2026-01',monthly:'10.00',yearly:null,lifetime:null},{id:'yearly',effectiveMonth:'2026-02',monthly:null,yearly:'100.00',lifetime:null},{id:'monthly-new',effectiveMonth:'2026-03',monthly:'12.00',yearly:null,lifetime:null}];
 expect(calculatorPrice(independent,[],'monthly','2026-04')).toBe('12.00');
 expect(calculatorPrice(independent,[],'yearly','2026-04')).toBe('100.00');
 expect(calculatorPrice(independent,[],'lifetime','2026-04')).toBeNull();
});
