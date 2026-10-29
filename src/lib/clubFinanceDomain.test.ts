import { describe, expect, it } from 'vitest';
import { financeDayStart, financePeriod, playerDebt, type DebtPlayer } from './clubFinanceDomain';
const date = (month: string) => new Date(`${month}-01T00:00:00Z`);
const player: DebtPlayer = { id: 'p', fullName: 'Player', paymentAmount: '0', firstBillingMonth: date('2026-08'), remainingTrainingCredits: 0, paymentLogs: [], paymentWaivers: [] };
describe('club finance reporting', () => {
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
    expect(playerDebt({ ...player, remainingTrainingCredits: 2 },'training_credits','40').periods).toEqual([]);
    expect(playerDebt({ ...player, paymentLogs: [{ paidFor: new Date('2026-10-20') }] },'rolling_30_days','40',new Date('2026-10-29')).periods).toEqual([]);
  });
});
