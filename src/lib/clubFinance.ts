import { applyCloudinaryTransformToUrl, buildCloudinaryUrlFromUploadPath } from './cloudinaryImagePath';
import { isCustomTrainingGroupPaletteColor } from './customTrainingGroupColors';
import { Prisma } from '@prisma/client';
import { prisma } from './db';
import { financeDateKey, financeDayStart, financePeriod, financePeriodLabel, FinanceError, playerDebt } from './clubFinanceDomain';
import { parsePaymentAmount } from './paymentAmount';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function financeId(value: unknown): string {
  if (typeof value !== 'string' || !uuid.test(value)) throw new FinanceError('Невалиден идентификатор.');
  return value;
}
export async function getClubFinanceAnalysis(clubId: string, now = new Date()) {
  const currentMonth = financeDateKey(now).slice(0,7);
  const year = Number(currentMonth.slice(0,4));
  const period = financePeriod(`${year}-01..${year}-12`)!;
  return prisma.$transaction(async tx => {
    const club = await tx.club.findUnique({ where: { id: clubId }, select: { id: true } });
    if (!club) throw new FinanceError('Клубът не е намерен.',404);
    const [categories, monthly] = await Promise.all([
      tx.clubFinanceCategory.findMany({ where: { clubId }, orderBy: [{ sortOrder:'asc' }, { name:'asc' }, { id:'asc' }], select: { id:true, name:true, color:true } }),
      tx.$queryRaw<{ month:string; categoryId:string; kind:string; currency:string; amount:string }[]>(Prisma.sql`
        SELECT to_char(occurred_at AT TIME ZONE 'Europe/Sofia','YYYY-MM') AS month,
          category_id AS "categoryId",kind,currency,sum(amount)::text AS amount
        FROM club_finance_entries
        WHERE club_id=${clubId}::uuid AND voided_at IS NULL
          AND occurred_at>=${period.gte} AND occurred_at<${period.lt}
        GROUP BY 1,category_id,kind,currency
      `),
    ]);
    const latestMonth = monthly.reduce((latest,value) => value.month > latest ? value.month : latest, '') || currentMonth;
    const monthCount = Number(latestMonth.slice(5,7));
    const annual = new Map<string, { categoryId:string; kind:string; currency:string; amount:Prisma.Decimal }>();
    for (const value of monthly) {
      const key = `${value.categoryId}:${value.kind}:${value.currency}`;
      const total = annual.get(key) ?? { categoryId:value.categoryId,kind:value.kind,currency:value.currency,amount:new Prisma.Decimal(0) };
      total.amount = total.amount.add(value.amount);
      annual.set(key,total);
    }
    return { year, currentMonth:latestMonth, categories, rows: [
      { key:'year', label:'Текуща година', values:[...annual.values()].map(value => ({...value,amount:value.amount.toFixed(2)})) },
      ...Array.from({length:monthCount},(_,index) => {
        const month = `${year}-${String(monthCount-index).padStart(2,'0')}`;
        return { key:month, label:financePeriodLabel(month), values:monthly.filter(value => value.month === month).map(({categoryId,kind,currency,amount}) => ({categoryId,kind,currency,amount:new Prisma.Decimal(amount).toFixed(2)})) };
      }),
    ] };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
}
export async function getClubFinance(clubId: string, params: URLSearchParams) {
  const month = params.get('month') ?? financeDateKey().slice(0,7);
  const period = financePeriod(month);
  const page = Number(params.get('page') ?? '1');
  if (!Number.isInteger(page) || page < 1 || page > 100000) throw new FinanceError('Невалидна страница.');
  const kind = params.get('kind');
  if (kind && kind !== 'revenue' && kind !== 'expense') throw new FinanceError('Невалиден вид.');
  const category = params.get('category');
  if (category) financeId(category);
  return prisma.$transaction(async tx => {
    const club = await tx.club.findUnique({ where: { id: clubId }, select: { financeStartedAt: true, paymentWorkflow: true, defaultPaymentAmount: true } });
    if (!club) throw new FinanceError('Клубът не е намерен.',404);
    const where = { clubId, voidedAt: null, ...(period ? { occurredAt: period } : {}) };
    const listWhere = { ...where, ...(kind ? { kind } : {}), ...(category ? { categoryId: category } : {}) };
    const [categories, totals, entries, count, players] = await Promise.all([
      tx.clubFinanceCategory.findMany({ where: { clubId }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }, { id: 'asc' }] }),
      tx.clubFinanceEntry.groupBy({ by: ['kind','currency','categoryId'], where, _sum: { amount: true } }),
      tx.clubFinanceEntry.findMany({ where: listWhere, orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }], skip: (page-1)*20, take: 20, include: { category: { select: { name: true, isMembership: true } } } }),
      tx.clubFinanceEntry.count({ where: listWhere }),
      tx.player.findMany({ where: { clubId, isActive: true }, select: { id: true, fullName: true, images: { select: { imageUrl: true, isAdminView: true } }, firstBillingMonth: true, remainingTrainingCredits: true, paymentAmount: true, billingCoachGroupId: true, coachGroups: { select: { id: true, name: true, paymentAmount: true } }, paymentLogs: { select: { paidFor: true } }, paymentWaivers: { select: { waivedFor: true } } } }),
    ]);
    const currencies = new Map<string, { revenue: Prisma.Decimal; expense: Prisma.Decimal }>();
    currencies.set('EUR', { revenue: new Prisma.Decimal(0), expense: new Prisma.Decimal(0) });
    for (const row of totals) {
      const sums = currencies.get(row.currency) ?? { revenue: new Prisma.Decimal(0), expense: new Prisma.Decimal(0) };
      if (row.kind === 'revenue') sums.revenue = sums.revenue.add(row._sum.amount ?? 0);
      else sums.expense = sums.expense.add(row._sum.amount ?? 0);
      currencies.set(row.currency,sums);
    }
    const debt = players.map(p => {
      const imagePath = (p.images?.find(image => image.isAdminView) ?? p.images?.[0])?.imageUrl;
      const cloudName = process.env.CLOUDINARY_CLOUD_NAME ?? '';
      const transform = 'w_80,h_80,c_fill,g_face,f_auto,q_auto';
      const avatarUrl = !imagePath ? null : imagePath.startsWith('http')
        ? applyCloudinaryTransformToUrl(imagePath, transform)
        : cloudName ? buildCloudinaryUrlFromUploadPath(imagePath, cloudName, transform) : null;
      return { ...playerDebt(p,club.paymentWorkflow,club.defaultPaymentAmount), avatarUrl };
    }).filter(p => p.periods.length);
    let outstanding = new Prisma.Decimal(0);
    const debts = debt.map(p => { const amount = p.fee === null ? null : new Prisma.Decimal(p.fee).mul(p.periods.length); if (amount) outstanding = outstanding.add(amount); return { ...p, amount: amount?.toFixed(2) ?? null }; });
    return { month, page, count, startedAt: club.financeStartedAt.toISOString(), categories,
      totals: [...currencies].map(([currency,s]) => ({ currency, revenue: s.revenue.toFixed(2), expense: s.expense.toFixed(2), balance: s.revenue.sub(s.expense).toFixed(2) })),
      subtotals: totals.map(r => ({ kind: r.kind, categoryId: r.categoryId, currency: r.currency, amount: r._sum.amount?.toFixed(2) ?? '0.00' })),
      outstanding: outstanding.toFixed(2), debts, incomplete: debt.some(d => d.conflict),
      entries: entries.map(e => ({ id: e.id, categoryId: e.categoryId, category: e.category.name, kind: e.kind, amount: e.amount.toFixed(2), currency: e.currency, date: financeDateKey(e.occurredAt), description: e.description, playerName: e.playerName, deletable: e.paymentReference === null && !e.category.isMembership, editable: e.paymentReference === null })) };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
}
function text(value: unknown, max: number) {
  if (typeof value !== 'string' || value.trim().length > max) throw new FinanceError('Невалиден текст.');
  return value.trim();
}
export async function mutateClubFinance(clubId: string, body: Record<string, unknown>) {
  const action = body.action;
  return prisma.$transaction(async tx => {
    if (action === 'setCategoryActive') {
      if (typeof body.isActive !== 'boolean') throw new FinanceError('Невалиден статус.');
      const changed = await tx.clubFinanceCategory.updateMany({ where: { id: financeId(body.id), clubId }, data: { isActive: body.isActive } });
      if (!changed.count) throw new FinanceError('Категорията не е намерена.',404);
      return { ok: true };
    }
    if (action === 'reorderCategories') {
      if (!Array.isArray(body.ids) || !body.ids.length) throw new FinanceError('Невалидна подредба.');
      const ids = body.ids.map(financeId);
      const categories = await tx.clubFinanceCategory.findMany({ where: { clubId }, select: { id: true } });
      if (new Set(ids).size !== ids.length || categories.length !== ids.length || categories.some(c => !ids.includes(c.id))) throw new FinanceError('Категориите са променени. Обновете страницата.');
      for (const [sortOrder,id] of ids.entries()) await tx.clubFinanceCategory.updateMany({ where: { id, clubId }, data: { sortOrder } });
      return { ok: true };
    }
    if (action === 'createCategory' || action === 'renameCategory') {
      const name = text(body.name,100);
      if (!name) throw new FinanceError('Въведете име.');
      const color = body.color === undefined ? undefined : body.color === null || body.color === '' ? null : body.color;
      if (color !== undefined && color !== null && (typeof color !== 'string' || !isCustomTrainingGroupPaletteColor(color))) throw new FinanceError('Изберете цвят от палитрата.');
      const categoryData = { name, ...(color !== undefined ? { color } : {}) };
      if (action === 'createCategory') {
        return tx.clubFinanceCategory.create({ data: { clubId, ...categoryData } });
      }
      const changed = await tx.clubFinanceCategory.updateMany({ where: { id: financeId(body.id), clubId }, data: categoryData });
      if (!changed.count) throw new FinanceError('Категорията не е намерена.',404);
      return { ok: true };
    }
    if (!['createExpense','updateExpense','deleteExpense','createRevenue','updateRevenue','deleteRevenue'].includes(String(action))) throw new FinanceError('Невалидна операция.');
    const kind = String(action).endsWith('Revenue') ? 'revenue' : 'expense';
    const label = kind === 'revenue' ? 'Приходът' : 'Разходът';
    const id = String(action).startsWith('create') ? undefined : financeId(body.id);
    if (String(action).startsWith('delete')) {
      const removed = await tx.clubFinanceEntry.deleteMany({ where: { id, clubId, kind, paymentReference: null, category: { isMembership: false } } });
      if (!removed.count) throw new FinanceError(`${label} не е намерен, е автоматично отчетен или е членски внос и не може да бъде изтрит.`,404);
      return { ok: true };
    }
    const categoryId = financeId(body.categoryId);
    const category = await tx.clubFinanceCategory.findFirst({ where: { id: categoryId, clubId, ...(!id ? { isActive: true } : {}) } });
    if (!category) throw new FinanceError('Изберете подходяща категория от този клуб.');
    const amount = parsePaymentAmount(body.amount);
    if (amount === null || new Prisma.Decimal(amount).lte(0)) throw new FinanceError('Въведете положителна сума с до 2 десетични знака.');
    const occurredAt = financeDayStart(text(body.date,10));
    const description = body.description == null ? null : text(body.description,2000) || null;
    const data = { categoryId, amount, occurredAt, description };
    if (!id) return tx.clubFinanceEntry.create({ data: { ...data, clubId, kind, currency: 'EUR' } });
    const updated = await tx.clubFinanceEntry.updateMany({ where: { id, clubId, kind, paymentReference: null }, data });
    if (!updated.count) throw new FinanceError(`${label} не е намерен или е автоматично отчетен.`,404);
    return { ok: true };
  });
}
