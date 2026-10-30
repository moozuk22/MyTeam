import { beforeEach, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';
const tx = vi.hoisted(() => ({ club: { findUnique: vi.fn() }, player: { findMany: vi.fn() }, clubFinanceCategory: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), updateMany: vi.fn() }, clubFinanceEntry: { groupBy: vi.fn(), findMany: vi.fn(), count: vi.fn(), create: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn() } }));
vi.mock('./db', () => ({ prisma: { $transaction: (fn: (value: unknown) => unknown) => fn(tx) } }));
import { getClubFinance, mutateClubFinance } from './clubFinance';
const club = '00000000-0000-0000-0000-000000000001';
const category = '00000000-0000-0000-0000-000000000002';
const expense = { action: 'createExpense', categoryId: category, amount: '12,34', date: '2026-10-29', description: '' };
beforeEach(() => { vi.resetAllMocks(); tx.clubFinanceCategory.findFirst.mockResolvedValue({ id: category }); });
it('requires an expense category owned by this club and stores exact amounts', async () => {
 await mutateClubFinance(club,expense);
 expect(tx.clubFinanceCategory.findFirst).toHaveBeenCalledWith({ where: { id: category, clubId: club, kind: 'expense', isActive:true } });
 expect(tx.clubFinanceEntry.create).toHaveBeenCalledWith({ data: expect.objectContaining({ amount:'12.34', currency:'EUR', clubId:club, kind:'expense', description:null }) });
 tx.clubFinanceCategory.findFirst.mockResolvedValue(null);
 await expect(mutateClubFinance(club,expense)).rejects.toThrow('категория');
});
it('rejects invalid values for manual entries', async () => {
 for (const amount of ['0','-1','2.345','Infinity','999999999']) await expect(mutateClubFinance(club,{ ...expense, amount })).rejects.toThrow();
 await expect(mutateClubFinance(club,{ ...expense, action:'createRevenue', amount:'0' })).rejects.toThrow();
 expect(tx.clubFinanceEntry.create).not.toHaveBeenCalled();
});
it('scopes corrections to club expenses so revenue cannot be edited or deleted', async () => {
 tx.clubFinanceEntry.updateMany.mockResolvedValue({ count: 1 });
 await mutateClubFinance(club,{ ...expense, action:'updateExpense', id:category });
 expect(tx.clubFinanceEntry.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id:category, clubId:club, kind:'expense', paymentReference:null } }));
 tx.clubFinanceEntry.deleteMany.mockResolvedValue({ count:0 });
 await expect(mutateClubFinance(club,{ action:'deleteExpense', id:category })).rejects.toThrow('не е намерен');
});
it('creates categories of either kind and scopes renames by club', async () => {
 await mutateClubFinance(club,{ action:'createCategory', name:'  Custom  ', kind:'revenue' });
 expect(tx.clubFinanceCategory.create).toHaveBeenCalledWith({ data:{ clubId:club, name:'Custom',kind:'revenue' } });
 tx.clubFinanceCategory.updateMany.mockResolvedValue({count:1});
 await mutateClubFinance(club,{ action:'renameCategory', id:category,name:'Renamed' });
 expect(tx.clubFinanceCategory.updateMany).toHaveBeenCalledWith({where:{id:category,clubId:club},data:{name:'Renamed'}});
});

it('reports exact decimal totals per currency and separates debt from period filters', async () => {
 tx.club.findUnique.mockResolvedValue({ financeStartedAt:new Date('2026-10-29'),paymentWorkflow:'calendar_month',defaultPaymentAmount:'40',billingStatus:'active' });
 tx.player.findMany.mockResolvedValue([{ id:'p',images:[{imageUrl:'https://example.com/other.jpg',isAdminView:false},{imageUrl:'https://example.com/admin.jpg',isAdminView:true}],fullName:'Player',paymentAmount:'0',firstBillingMonth:new Date('2026-01-01'),remainingTrainingCredits:0,paymentLogs:[],paymentWaivers:[] }]);
 tx.clubFinanceCategory.findMany.mockResolvedValue([]);
 tx.clubFinanceEntry.findMany.mockResolvedValue([]);
 tx.clubFinanceEntry.count.mockResolvedValue(0);
 tx.clubFinanceEntry.groupBy.mockResolvedValue([
  {kind:'revenue',currency:'EUR',categoryId:category,_sum:{amount:new Prisma.Decimal('0.30')}},
  {kind:'expense',currency:'EUR',categoryId:category,_sum:{amount:new Prisma.Decimal('0.10')}},
  {kind:'revenue',currency:'USD',categoryId:category,_sum:{amount:new Prisma.Decimal('10')}},
 ]);
 const result=await getClubFinance(club,new URLSearchParams({month:'2026-03',kind:'expense'}));
 expect(result.totals).toEqual([{currency:'EUR',revenue:'0.30',expense:'0.10',balance:'0.20'},{currency:'USD',revenue:'10.00',expense:'0.00',balance:'10.00'}]);
 expect(result.debts[0].periods).toContain('2026-01');
 expect(result.debts[0].avatarUrl).toBe('https://example.com/admin.jpg');
 expect(tx.player.findMany).toHaveBeenCalledWith(expect.objectContaining({select:expect.objectContaining({images:{select:{imageUrl:true,isAdminView:true}}})}));
 expect(tx.clubFinanceEntry.groupBy).toHaveBeenCalledWith(expect.objectContaining({where:{clubId:club,voidedAt:null,occurredAt:expect.any(Object)}}));
 expect(tx.clubFinanceEntry.findMany).toHaveBeenCalledWith(expect.objectContaining({where:expect.objectContaining({kind:'expense'})}));
});

it('includes existing unpaid player months even when platform billing is demo', async () => {
 tx.club.findUnique.mockResolvedValue({financeStartedAt:new Date(),paymentWorkflow:'calendar_month',defaultPaymentAmount:'40',billingStatus:'demo'});
 tx.player.findMany.mockResolvedValue([{id:'p',fullName:'Player',paymentAmount:'0',firstBillingMonth:new Date('2026-01-01'),remainingTrainingCredits:0,paymentLogs:[],paymentWaivers:[]}]);
 tx.clubFinanceCategory.findMany.mockResolvedValue([]);
 tx.clubFinanceEntry.findMany.mockResolvedValue([]);
 tx.clubFinanceEntry.count.mockResolvedValue(0);
 tx.clubFinanceEntry.groupBy.mockResolvedValue([]);
 const result=await getClubFinance(club,new URLSearchParams({month:'all'}));
 expect(result.debts).toHaveLength(1);
 expect(Number(result.outstanding)).toBeGreaterThan(0);
});

it('creates manual revenue with exact amounts and protects automatic player payments', async () => {
 await mutateClubFinance(club,{...expense,action:'createRevenue'});
 expect(tx.clubFinanceEntry.create).toHaveBeenCalledWith({data:expect.objectContaining({kind:'revenue',amount:'12.34',clubId:club})});
 expect(tx.clubFinanceCategory.findFirst).toHaveBeenCalledWith({where:{id:category,clubId:club,kind:'revenue',isActive:true}});
 tx.clubFinanceEntry.updateMany.mockResolvedValue({count:0});
 await expect(mutateClubFinance(club,{...expense,action:'updateRevenue',id:category})).rejects.toThrow('автоматично');
 expect(tx.clubFinanceEntry.updateMany).toHaveBeenCalledWith(expect.objectContaining({where:{id:category,clubId:club,kind:'revenue',paymentReference:null}}));
 tx.clubFinanceEntry.deleteMany.mockResolvedValue({count:0});
 await expect(mutateClubFinance(club,{action:'deleteRevenue',id:category})).rejects.toThrow('автоматично');
 expect(tx.clubFinanceEntry.deleteMany).toHaveBeenCalledWith({where:{id:category,clubId:club,kind:'revenue',paymentReference:null}});
});

it('updates and deletes manual revenue and rejects categories from another kind or club', async () => {
 tx.clubFinanceEntry.updateMany.mockResolvedValue({count:1});
 await mutateClubFinance(club,{...expense,action:'updateRevenue',id:category});
 expect(tx.clubFinanceEntry.updateMany).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({amount:'12.34'})}));
 tx.clubFinanceEntry.deleteMany.mockResolvedValue({count:1});
 await expect(mutateClubFinance(club,{action:'deleteRevenue',id:category})).resolves.toEqual({ok:true});
 tx.clubFinanceCategory.findFirst.mockResolvedValue(null);
 await expect(mutateClubFinance(club,{...expense,action:'createRevenue'})).rejects.toThrow('категория');
});

it('saves category priority only for the complete set belonging to this club and kind', async () => {
 const second = '00000000-0000-0000-0000-000000000003';
 tx.clubFinanceCategory.findMany.mockResolvedValue([{id:category},{id:second}]);
 await mutateClubFinance(club,{action:'reorderCategories',kind:'expense',ids:[second,category]});
 expect(tx.clubFinanceCategory.findMany).toHaveBeenCalledWith({where:{clubId:club,kind:'expense'},select:{id:true}});
 expect(tx.clubFinanceCategory.updateMany).toHaveBeenNthCalledWith(1,{where:{id:second,clubId:club,kind:'expense'},data:{sortOrder:0}});
 expect(tx.clubFinanceCategory.updateMany).toHaveBeenNthCalledWith(2,{where:{id:category,clubId:club,kind:'expense'},data:{sortOrder:1}});
 tx.clubFinanceCategory.updateMany.mockClear();
 for (const ids of [[category],[category,category],[category,club]]) {
  await expect(mutateClubFinance(club,{action:'reorderCategories',kind:'expense',ids})).rejects.toThrow();
 }
 expect(tx.clubFinanceCategory.updateMany).not.toHaveBeenCalled();
});

it('deactivates and reactivates categories within the current club without touching entries', async () => {
 tx.clubFinanceCategory.updateMany.mockResolvedValue({count:1});
 for (const isActive of [false,true]) {
  await mutateClubFinance(club,{action:'setCategoryActive',id:category,isActive});
  expect(tx.clubFinanceCategory.updateMany).toHaveBeenLastCalledWith({where:{id:category,clubId:club},data:{isActive}});
 }
 expect(tx.clubFinanceEntry.deleteMany).not.toHaveBeenCalled();
 await expect(mutateClubFinance(club,{action:'setCategoryActive',id:category,isActive:'false'})).rejects.toThrow();
 tx.clubFinanceCategory.updateMany.mockResolvedValue({count:0});
 await expect(mutateClubFinance(club,{action:'setCategoryActive',id:category,isActive:false})).rejects.toThrow('не е намерена');
});

it('applies the same inclusive month range to totals, categories and paginated entries', async () => {
 tx.club.findUnique.mockResolvedValue({financeStartedAt:new Date('2026-01-01'),paymentWorkflow:'calendar_month',defaultPaymentAmount:'60'});
 tx.player.findMany.mockResolvedValue([]);
 tx.clubFinanceCategory.findMany.mockResolvedValue([]);
 tx.clubFinanceEntry.groupBy.mockResolvedValue([]);
 tx.clubFinanceEntry.findMany.mockResolvedValue([]);
 tx.clubFinanceEntry.count.mockResolvedValue(0);
 const result = await getClubFinance(club,new URLSearchParams({month:'2026-03..2026-10',page:'2',kind:'expense',category}));
 const occurredAt = {gte:new Date('2026-02-28T22:00:00Z'),lt:new Date('2026-10-31T22:00:00Z')};
 expect(result.month).toBe('2026-03..2026-10');
 expect(tx.clubFinanceEntry.groupBy).toHaveBeenCalledWith(expect.objectContaining({where:{clubId:club,voidedAt:null,occurredAt}}));
 expect(tx.clubFinanceEntry.findMany).toHaveBeenCalledWith(expect.objectContaining({where:{clubId:club,voidedAt:null,occurredAt,kind:'expense',categoryId:category},skip:20,take:20}));
 expect(tx.clubFinanceEntry.count).toHaveBeenCalledWith({where:{clubId:club,voidedAt:null,occurredAt,kind:'expense',categoryId:category}});
 await expect(getClubFinance(club,new URLSearchParams({month:'2026-10..2026-03'}))).rejects.toThrow();
});
