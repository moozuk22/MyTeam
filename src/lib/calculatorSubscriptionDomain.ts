import { amountCents, isMonth, money, nextMonth, SubscriptionError } from './clubSubscriptionDomain';
export const calculatorModes = ['monthly', 'yearly', 'lifetime'] as const;
export type CalculatorMode = typeof calculatorModes[number];
export type CalculatorPrice = {
  id: string;
  effectiveMonth: string;
  monthly: string | null;
  yearly: string | null;
  lifetime: string | null;
};
export type CalculatorOverride = {
  effectiveMonth: string;
  billingMode: string;
  amount: string | null;
};
export type CalculatorGrant = {
  id: string;
  kind: string;
  startsAt: string;
  endsAt: string | null;
  revokedAt: string | null;
  paymentId: string | null;
  amount: string | null;
};
export type CalculatorAccess = {
  enabled: boolean;
  canView: boolean;
  billingMode: CalculatorMode;
  price: string | null;
  periods: Pick<CalculatorGrant, 'kind' | 'startsAt' | 'endsAt'>[];
};
export function calculatorMode(value: unknown): CalculatorMode {
  if (!calculatorModes.includes(value as CalculatorMode)) throw new SubscriptionError('Невалиден период за калкулатора.');
  return value as CalculatorMode;
}
export function calculatorPrice(prices: CalculatorPrice[], overrides: CalculatorOverride[], mode: CalculatorMode, month: string): string | null {
  const override = overrides.filter(p => p.billingMode === mode && p.effectiveMonth <= month).sort((a, b) => b.effectiveMonth.localeCompare(a.effectiveMonth))[0];
  if (override?.amount != null) return override.amount;
  return prices.filter(p => p.effectiveMonth <= month && p[mode] !== null).sort((a, b) => b.effectiveMonth.localeCompare(a.effectiveMonth))[0]?.[mode] ?? null;
}
export function calculatorPurchase(mode: CalculatorMode, input: unknown, prices: CalculatorPrice[], overrides: CalculatorOverride[]) {
  if (!Array.isArray(input) || !input.length || input.length > 120 || !input.every(isMonth) || new Set(input).size !== input.length) throw new SubscriptionError('Изберете от 1 до 120 различни месеца.');
  const months = (input as string[]).slice().sort();
  if (mode !== 'monthly' && months.length !== 1) throw new SubscriptionError('Изберете един начален месец.');
  const periods = months.map(month => {
    const amount = calculatorPrice(prices, overrides, mode, month);
    if (!amount || amountCents(amount) <= 0) throw new SubscriptionError(`Няма зададена цена за ${month}.`);
    let end: string | null = null;
    if (mode !== 'lifetime') {
      end = month;
      for (let i = 0; i < (mode === 'yearly' ? 12 : 1); i++) end = nextMonth(end!);
    }
    if (end && end > '2200-01') throw new SubscriptionError('Периодът е извън поддържаните години.');
    return {
      month,
      end,
      amount
    };
  });
  return {
    periods,
    total: money(periods.reduce((sum, p) => sum + amountCents(p.amount), 0))
  };
}
export function calculatorHasAccess(grants: CalculatorGrant[], at = new Date()): boolean {
  return grants.some(g => !g.revokedAt && new Date(g.startsAt) <= at && (!g.endsAt || new Date(g.endsAt) > at));
}
