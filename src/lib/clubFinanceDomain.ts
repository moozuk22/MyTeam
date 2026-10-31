import { resolveMemberFee, type FeePlayer } from './memberFee';

export class FinanceError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export function financeDateKey(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Sofia', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}
/** Convert a Sofia wall-clock midnight without assuming a fixed DST offset. */
export function financeDayStart(day: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new FinanceError('Невалидна дата.');
  const utc = new Date(`${day}T00:00:00Z`);
  if (Number.isNaN(utc.getTime()) || utc.toISOString().slice(0, 10) !== day) throw new FinanceError('Невалидна дата.');
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Sofia', timeZoneName: 'longOffset' }).formatToParts(utc);
  const offset = parts.find(p => p.type === 'timeZoneName')!.value.replace('GMT', '');
  return new Date(`${day}T00:00:00${offset}`);
}
export function financePeriod(month: string): { gte: Date; lt: Date } | null {
  if (month === 'all') return null;
  if (month.includes('..')) {
    const parts = month.split('..');
    if (parts.length !== 2 || parts.some(part => !/^\d{4}-(0[1-9]|1[0-2])$/.test(part)) || parts[0] > parts[1]) throw new FinanceError('Невалиден период.');
    return { gte: financePeriod(parts[0])!.gte, lt: financePeriod(parts[1])!.lt };
  }
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || Number(month.slice(0,4)) < 1900 || Number(month.slice(0,4)) > 9998) throw new FinanceError('Невалиден месец.');
  const next = new Date(`${month}-01T00:00:00Z`);
  next.setUTCMonth(next.getUTCMonth() + 1);
  return { gte: financeDayStart(`${month}-01`), lt: financeDayStart(next.toISOString().slice(0,10)) };
}
export function financePeriodLabel(period: string): string {
  if (period === 'all') return 'От началото';
  const formatter = new Intl.DateTimeFormat('bg-BG', { month: 'long', year: 'numeric' });
  return period.split('..').map(month => formatter.format(new Date(`${month}-15T12:00:00`))).join(' – ');
}
export type DebtPlayer = FeePlayer & {
  id: string; status: string; fullName: string; firstBillingMonth: Date | null; remainingTrainingCredits: number;
  paymentLogs: { paidFor: Date }[]; paymentWaivers: { waivedFor: Date }[];
};
export type ClubDebtSchedule = { overdueDay?: number | null; overdueHour?: number | null; overdueMinute?: number | null };
function hasReachedStatusUpdate(now: Date, schedule: ClubDebtSchedule) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone:'Europe/Sofia', day:'2-digit', hour:'2-digit', minute:'2-digit', hourCycle:'h23' }).formatToParts(now);
  const value = (type: string) => Number(parts.find(part => part.type === type)?.value);
  const day = schedule.overdueDay ?? 1;
  return value('day') > day || value('day') === day
    && value('hour') * 60 + value('minute') >= (schedule.overdueHour ?? 10) * 60 + (schedule.overdueMinute ?? 0);
}
export function playerDebt(player: DebtPlayer, workflow: string, clubAmount: unknown, now = new Date(), schedule: ClubDebtSchedule = {}) {
  const fee = resolveMemberFee(player, clubAmount);
  const periods: string[] = [];
  const eligible = player.status === 'warning' || player.status === 'overdue';
  if (eligible && workflow === 'calendar_month') {
    if (player.firstBillingMonth) {
      const start = player.firstBillingMonth.getUTCFullYear() * 12 + player.firstBillingMonth.getUTCMonth();
      const today = financeDateKey(now);
      const end = Number(today.slice(0,4)) * 12 + Number(today.slice(5,7)) - 1 - (hasReachedStatusUpdate(now,schedule) ? 0 : 1);
      const settled = new Set([...player.paymentLogs.map(p => p.paidFor), ...player.paymentWaivers.map(p => p.waivedFor)].map(d => d.getUTCFullYear() * 12 + d.getUTCMonth()));
      for (let i = start; i <= end; i++) if (!settled.has(i)) periods.push(`${Math.floor(i/12)}-${String(i%12+1).padStart(2,'0')}`);
    }
  } else if (eligible) periods.push('Подновяване');
  return { id: player.id, name: player.fullName, periods, fee: fee.amount, conflict: periods.length > 0 && fee.amount === null };
}
