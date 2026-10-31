import { describe, expect, it } from 'vitest';
import { financeDayStart, financePeriod, financePeriodLabel, playerDebt, type DebtPlayer } from './clubFinanceDomain';
const date = (month: string) => new Date(`${month}-01T00:00:00Z`);
const player: DebtPlayer = { id: 'p', status: 'overdue', fullName: 'Player', paymentAmount: '0', firstBillingMonth: date('2026-08'), remainingTrainingCredits: 0, paymentLogs: [], paymentWaivers: [] };
describe('club finance reporting', () => {
  it('includes the entire start and end months in a range across Sofia DST changes', () => {
    const range = financePeriod('2026-03..2026-10')!;
    expect(range.gte.toISOString()).toBe('2026-02-28T22:00:00.000Z');
    expect(range.lt.toISOString()).toBe('2026-10-31T22:00:00.000Z');
    expect(financePeriod('2026-10..2026-10')).toEqual(financePeriod('2026-10'));
    expect(financePeriod('2026-12..2027-01')!.lt.toISOString()).toBe('2027-01-31T22:00:00.000Z');
    expect(financePeriodLabel('2026-03..2026-10')).toBe('март 2026 г. – октомври 2026 г.');
    for (const invalid of ['2026-10..2026-03','2026-00..2026-10','2026-01..all','2026-01..2026-03..2026-05','..2026-10','0000-01..2026-10']) {
      expect(() => financePeriod(invalid)).toThrow();
    }
  });
  it('uses Sofia month boundaries including DST transitions', () => {
    const p = financePeriod('2026-10')!;
    expect(p.gte.toISOString()).toBe('2026-09-30T21:00:00.000Z');
    expect(p.lt.toISOString()).toBe('2026-10-31T22:00:00.000Z');
    expect(financePeriod('all')).toBeNull();
    expect(() => financePeriod('2026-13')).toThrow();
    expect(() => financeDayStart('2026-02-30')).toThrow();
  });
  it('counts all unpaid calendar months, excluding paid and waived gaps', () => {
    const result = playerDebt({ ...player, paymentLogs: [{ paidFor: date('2026-08') }], paymentWaivers: [{ waivedFor: date('2026-09') }] },'calendar_month','40',new Date('2026-10-29'));
    expect(result).toMatchObject({ periods: ['2026-10'], fee: '40.00', conflict: false });
    expect(playerDebt(player,'calendar_month','40',new Date('2026-10-29')).periods).toHaveLength(3);
  });
  it('does not charge before activation and respects personal/group prices and zero', () => {
    expect(playerDebt({ ...player, firstBillingMonth: null },'calendar_month','40').periods).toEqual([]);
    expect(playerDebt({ ...player, paymentAmount: '25' },'calendar_month','40').fee).toBe('25.00');
    expect(playerDebt({ ...player, coachGroups: [{ id: 'g', name: 'Group', paymentAmount: '0' }] },'calendar_month','40').fee).toBe('0.00');
    expect(playerDebt({ ...player, coachGroups: [{ id:'a',name:'A',paymentAmount:'30' }, { id:'b',name:'B',paymentAmount:'40' }] },'calendar_month','40').conflict).toBe(true);
  });
  it('counts a single renewal for expired windows or empty training credits', () => {
    expect(playerDebt(player,'rolling_30_days','40',new Date('2026-10-29')).periods).toEqual(['Подновяване']);
    expect(playerDebt(player,'training_credits','40').periods).toHaveLength(1);
    expect(playerDebt({ ...player, status:'paid', remainingTrainingCredits: 2 },'training_credits','40').periods).toEqual([]);
    expect(playerDebt({ ...player, status:'paid', paymentLogs: [{ paidFor: new Date('2026-10-20') }] },'rolling_30_days','40',new Date('2026-10-29')).periods).toEqual([]);
  });
});

it.each(['calendar_month','rolling_30_days','training_credits','training_credits_30_days'])('skips paid and paused players even with unpaid history or exhausted credits (%s)', workflow => {
 for(const status of ['paid','paused']) {
  const result=playerDebt({...player,status,coachGroups:[{id:'a',name:'A',paymentAmount:'30'},{id:'b',name:'B',paymentAmount:'40'}]},workflow,'40',new Date('2026-10-29'));
  expect(result.periods).toEqual([]);
  expect(result.conflict).toBe(false);
 }
});
it.each(['warning','overdue'])('uses saved %s status for renewal debts even when payment history or credits look paid', status => {
 for(const workflow of ['rolling_30_days','training_credits','training_credits_30_days']) {
  const result=playerDebt({...player,status,remainingTrainingCredits:5,paymentLogs:[{paidFor:new Date('2026-10-20')}]},workflow,'40',new Date('2026-10-29'));
  expect(result.periods).toEqual(['Подновяване']);
 }
});
it.each(['warning','overdue'])('counts unsettled monthly periods for saved %s players',status=>{
 expect(playerDebt({...player,status},'calendar_month','40',new Date('2026-10-29')).periods).toEqual(['2026-08','2026-09','2026-10']);
});
