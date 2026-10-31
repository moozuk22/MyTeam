import { beforeEach, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';
const access=vi.hoisted(()=>vi.fn());
vi.mock('./calculatorSubscriptions',()=>({calculatorAccess:access}));
const tx = vi.hoisted(() => ({ $queryRaw:vi.fn(), clubCalculatorGrant:{findFirst:vi.fn()}, club: { findUnique: vi.fn() }, player: { findMany: vi.fn() }, clubFinanceCategory: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), updateMany: vi.fn() }, clubFinanceEntry: { findFirst:vi.fn(), groupBy: vi.fn(), findMany: vi.fn(), count: vi.fn(), create: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn() } }));
vi.mock('./db', () => ({ prisma: { $transaction: (fn: (value: unknown) => unknown) => fn(tx) } }));
import { getClubDebtSummary, getClubFinance, mutateClubFinance } from './clubFinance';
const club = '00000000-0000-0000-0000-000000000001';
const category = '00000000-0000-0000-0000-000000000002';
const expense = { action: 'createExpense', categoryId: category, amount: '12,34', date: '2026-10-29', description: '' };
beforeEach(() => { vi.resetAllMocks(); access.mockResolvedValue({enabled:true}); tx.clubCalculatorGrant.findFirst.mockResolvedValue({id:"grant"}); tx.clubFinanceCategory.findFirst.mockResolvedValue({ id: category }); });
it('uses a shared category owned by this club and stores exact amounts', async () => {
 await mutateClubFinance(club,expense);
 expect(tx.clubFinanceCategory.findFirst).toHaveBeenCalledWith({ where: { id: category, clubId: club, isActive:true } });
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
it('creates shared categories without a type and scopes renames by club', async () => {
 await mutateClubFinance(club,{ action:'createCategory', name:'  Custom  ' });
 expect(tx.clubFinanceCategory.create).toHaveBeenCalledWith({ data:{ clubId:club, name:'Custom' } });
 tx.clubFinanceCategory.updateMany.mockResolvedValue({count:1});
 await mutateClubFinance(club,{ action:'renameCategory', id:category,name:'Renamed' });
 expect(tx.clubFinanceCategory.updateMany).toHaveBeenCalledWith({where:{id:category,clubId:club},data:{name:'Renamed'}});
});

it('reports exact decimal totals per currency and separates debt from period filters', async () => {
 tx.club.findUnique.mockResolvedValue({ financeStartedAt:new Date('2026-10-29'),paymentWorkflow:'calendar_month',defaultPaymentAmount:'40',billingStatus:'active' });
 tx.player.findMany.mockResolvedValue([{ id:'p',status:'overdue',images:[{imageUrl:'https://example.com/other.jpg',isAdminView:false},{imageUrl:'https://example.com/admin.jpg',isAdminView:true}],fullName:'Player',paymentAmount:'0',firstBillingMonth:new Date('2026-01-01'),remainingTrainingCredits:0,paymentLogs:[],paymentWaivers:[] }]);
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
 expect(result.subtotals).toEqual([
  {kind:'revenue',categoryId:category,currency:'EUR',amount:'0.30'},
  {kind:'expense',categoryId:category,currency:'EUR',amount:'0.10'},
  {kind:'revenue',categoryId:category,currency:'USD',amount:'10.00'},
 ]);
 expect(result.debts[0].periods).toContain('2026-01');
 expect(result.debts[0].avatarUrl).toBe('https://example.com/admin.jpg');
 expect(tx.player.findMany).toHaveBeenCalledWith(expect.objectContaining({select:expect.objectContaining({images:{select:{imageUrl:true,isAdminView:true}}})}));
 expect(tx.clubFinanceEntry.groupBy).toHaveBeenCalledWith(expect.objectContaining({where:{clubId:club,voidedAt:null,occurredAt:expect.any(Object)}}));
 expect(tx.clubFinanceEntry.findMany).toHaveBeenCalledWith(expect.objectContaining({where:expect.objectContaining({kind:'expense'})}));
});

it('includes existing unpaid player months even when platform billing is demo', async () => {
 tx.club.findUnique.mockResolvedValue({financeStartedAt:new Date(),paymentWorkflow:'calendar_month',defaultPaymentAmount:'40',billingStatus:'demo'});
 tx.player.findMany.mockResolvedValue([{id:'p',status:'overdue',fullName:'Player',paymentAmount:'0',firstBillingMonth:new Date('2026-01-01'),remainingTrainingCredits:0,paymentLogs:[],paymentWaivers:[]}]);
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
 expect(tx.clubFinanceCategory.findFirst).toHaveBeenCalledWith({where:{id:category,clubId:club,isActive:true}});
 tx.clubFinanceEntry.updateMany.mockResolvedValue({count:0});
 await expect(mutateClubFinance(club,{...expense,action:'updateRevenue',id:category})).rejects.toThrow('автоматично');
 expect(tx.clubFinanceEntry.updateMany).toHaveBeenCalledWith(expect.objectContaining({where:{id:category,clubId:club,kind:'revenue',paymentReference:null}}));
 tx.clubFinanceEntry.deleteMany.mockResolvedValue({count:0});
 await expect(mutateClubFinance(club,{action:'deleteRevenue',id:category})).rejects.toThrow('автоматично');
 expect(tx.clubFinanceEntry.deleteMany).toHaveBeenCalledWith({where:{id:category,clubId:club,kind:'revenue',paymentReference:null,category:{isMembership:false}}});
});

it('updates and deletes manual revenue and rejects categories from another club', async () => {
 tx.clubFinanceEntry.updateMany.mockResolvedValue({count:1});
 await mutateClubFinance(club,{...expense,action:'updateRevenue',id:category});
 expect(tx.clubFinanceEntry.updateMany).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({amount:'12.34'})}));
 tx.clubFinanceEntry.deleteMany.mockResolvedValue({count:1});
 await expect(mutateClubFinance(club,{action:'deleteRevenue',id:category})).resolves.toEqual({ok:true});
 tx.clubFinanceCategory.findFirst.mockResolvedValue(null);
 await expect(mutateClubFinance(club,{...expense,action:'createRevenue'})).rejects.toThrow('категория');
});

it('saves category priority only for the complete set belonging to this club', async () => {
 const second = '00000000-0000-0000-0000-000000000003';
 tx.clubFinanceCategory.findMany.mockResolvedValue([{id:category},{id:second}]);
 await mutateClubFinance(club,{action:'reorderCategories',ids:[second,category]});
 expect(tx.clubFinanceCategory.findMany).toHaveBeenCalledWith({where:{clubId:club},select:{id:true}});
 expect(tx.clubFinanceCategory.updateMany).toHaveBeenNthCalledWith(1,{where:{id:second,clubId:club},data:{sortOrder:0}});
 expect(tx.clubFinanceCategory.updateMany).toHaveBeenNthCalledWith(2,{where:{id:category,clubId:club},data:{sortOrder:1}});
 tx.clubFinanceCategory.updateMany.mockClear();
 for (const ids of [[category],[category,category],[category,club]]) {
  await expect(mutateClubFinance(club,{action:'reorderCategories',ids})).rejects.toThrow();
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

it.each(['deleteRevenue','deleteExpense'])('excludes membership fee categories when handling %s', async action => {
 tx.clubFinanceEntry.deleteMany.mockResolvedValue({count:0});
 await expect(mutateClubFinance(club,{action,id:category})).rejects.toThrow();
 expect(tx.clubFinanceEntry.deleteMany).toHaveBeenCalledWith({where:{id:category,clubId:club,kind:action === 'deleteRevenue' ? 'revenue' : 'expense',paymentReference:null,category:{isMembership:false}}});
});

it('marks membership fees as non-deletable even after the category is renamed', async () => {
 tx.club.findUnique.mockResolvedValue({financeStartedAt:new Date(),paymentWorkflow:'calendar_month',defaultPaymentAmount:'60'});
 tx.player.findMany.mockResolvedValue([]);
 tx.clubFinanceCategory.findMany.mockResolvedValue([]);
 tx.clubFinanceEntry.groupBy.mockResolvedValue([]);
 tx.clubFinanceEntry.count.mockResolvedValue(3);
 const entry = {id:category,categoryId:category,kind:'revenue',amount:new Prisma.Decimal('60'),currency:'EUR',occurredAt:new Date(),description:null,playerName:null,paymentReference:null};
 tx.clubFinanceEntry.findMany.mockResolvedValue([
  {...entry,category:{name:'Преименуван членски внос',isMembership:true}},
  {...entry,id:'manual',category:{name:'Дарения',isMembership:false}},
  {...entry,id:'automatic',paymentReference:'payment',category:{name:'Членски внос',isMembership:true}},
 ]);
 const result = await getClubFinance(club,new URLSearchParams({month:'all'}));
 expect(result.entries.map(({editable,deletable}) => ({editable,deletable}))).toEqual([
  {editable:true,deletable:false},{editable:true,deletable:true},{editable:false,deletable:false},
 ]);
});

it('stores optional palette colors and supports clearing without overwriting omitted colors', async () => {
 await mutateClubFinance(club,{action:'createCategory',name:'Colored',color:'#E53935'});
 expect(tx.clubFinanceCategory.create).toHaveBeenLastCalledWith({data:{clubId:club,name:'Colored',color:'#E53935'}});
 tx.clubFinanceCategory.updateMany.mockResolvedValue({count:1});
 await mutateClubFinance(club,{action:'renameCategory',id:category,name:'Clear',color:null});
 expect(tx.clubFinanceCategory.updateMany).toHaveBeenLastCalledWith({where:{id:category,clubId:club},data:{name:'Clear',color:null}});
 await expect(mutateClubFinance(club,{action:'createCategory',name:'Invalid',color:'#123456'})).rejects.toThrow('палитрата');
 await expect(mutateClubFinance(club,{action:'createCategory',name:'Invalid',color:123})).rejects.toThrow('палитрата');
});

it('rejects inactive calculator writes and manual entries dated in gaps',async()=>{
 access.mockResolvedValue({enabled:false});
 await expect(mutateClubFinance(club,expense)).rejects.toMatchObject({status:403});
 access.mockResolvedValue({enabled:true});tx.clubCalculatorGrant.findFirst.mockResolvedValue(null);
 await expect(mutateClubFinance(club,expense)).rejects.toThrow('период');
 expect(tx.clubFinanceEntry.create).not.toHaveBeenCalled();
});

it('returns membership dues without reading calculator records or requiring entitlement',async()=>{
 tx.club.findUnique.mockResolvedValue({paymentWorkflow:'calendar_month',defaultPaymentAmount:'40'});
 tx.player.findMany.mockResolvedValue([{id:'p',status:'overdue',fullName:'Player',paymentAmount:'25',firstBillingMonth:new Date('2026-10-01'),remainingTrainingCredits:0,paymentLogs:[],paymentWaivers:[]}]);
 const summary=await getClubDebtSummary(club);
 expect(Number(summary.outstanding)).toBeGreaterThanOrEqual(25);
 expect(summary).toMatchObject({count:1,incomplete:false});
 expect(summary).not.toHaveProperty('totals');expect(summary).not.toHaveProperty('debts');
 expect(tx.clubFinanceEntry.groupBy).not.toHaveBeenCalled();expect(tx.clubFinanceEntry.findMany).not.toHaveBeenCalled();expect(access).not.toHaveBeenCalled();
 expect(tx.player.findMany).toHaveBeenCalledWith(expect.objectContaining({where:{clubId:club,isActive:true,status:{in:['warning','overdue']}}}));
});

it('loads dues without querying transaction history or chart and analysis totals',async()=>{
 tx.club.findUnique.mockResolvedValue({financeStartedAt:new Date('2026-01-01'),paymentWorkflow:'calendar_month',defaultPaymentAmount:'40'});
 tx.player.findMany.mockResolvedValue([]);
 const result=await getClubFinance(club,new URLSearchParams({month:'all',view:'dues'}));
 expect(result.entries).toEqual([]);expect(result.subtotals).toEqual([]);expect(result.outstanding).toBe('0.00');
 expect(tx.clubFinanceEntry.findMany).not.toHaveBeenCalled();expect(tx.clubFinanceEntry.groupBy).not.toHaveBeenCalled();expect(tx.clubFinanceEntry.count).not.toHaveBeenCalled();
});

it.each(['all','dues'])('excludes paid and paused players from totals, counts and incomplete flags (%s)',async view=>{
 tx.club.findUnique.mockResolvedValue({financeStartedAt:new Date('2026-01-01'),paymentWorkflow:'calendar_month',defaultPaymentAmount:'40'});
 tx.clubFinanceCategory.findMany.mockResolvedValue([]);tx.clubFinanceEntry.groupBy.mockResolvedValue([]);
 tx.clubFinanceEntry.findMany.mockResolvedValue([]);tx.clubFinanceEntry.count.mockResolvedValue(0);
 const base={fullName:'Player',firstBillingMonth:new Date('2026-01-01'),remainingTrainingCredits:0,paymentAmount:'25',paymentLogs:[],paymentWaivers:[]};
 tx.player.findMany.mockResolvedValue(['warning','overdue','paid','paused'].map(status=>({...base,id:status,status,paymentAmount:status==='paid'||status==='paused'?null:'25',coachGroups:status==='paid'||status==='paused'?[{id:'a',name:'A',paymentAmount:'30'},{id:'b',name:'B',paymentAmount:'40'}]:[]})));
 const report=await getClubFinance(club,new URLSearchParams({month:'all',...(view==='dues'?{view:'dues'}:{})}));
 const summary=await getClubDebtSummary(club);
 expect(report.debts.map(player=>player.id)).toEqual(['warning','overdue']);
 expect(summary).toEqual({outstanding:report.outstanding,count:2,incomplete:false});
 expect(report.incomplete).toBe(false);
 expect(tx.player.findMany).toHaveBeenCalledWith(expect.objectContaining({where:{clubId:club,isActive:true,status:{in:['warning','overdue']}},select:expect.objectContaining({status:true})}));
});

it('uses the club update schedule consistently in the report and widget dues',async()=>{
 vi.useFakeTimers();vi.setSystemTime(new Date('2026-11-03T08:29:59Z'));
 try {
  tx.club.findUnique.mockResolvedValue({financeStartedAt:new Date('2026-01-01'),paymentWorkflow:'calendar_month',defaultPaymentAmount:'75',overdueDay:3,overdueHour:10,overdueMinute:30});
  tx.player.findMany.mockResolvedValue([{id:'p',status:'warning',fullName:'Player',paymentAmount:'75',firstBillingMonth:new Date('2026-09-01'),remainingTrainingCredits:0,paymentLogs:[],paymentWaivers:[{waivedFor:new Date('2026-09-01')}]}]);
  tx.clubFinanceCategory.findMany.mockResolvedValue([]);tx.clubFinanceEntry.groupBy.mockResolvedValue([]);tx.clubFinanceEntry.findMany.mockResolvedValue([]);tx.clubFinanceEntry.count.mockResolvedValue(0);
  const before=await getClubFinance(club,new URLSearchParams({month:'all'}));
  expect(before.debts[0].periods).toEqual(['2026-10']);expect(before.outstanding).toBe('75.00');
  expect((await getClubDebtSummary(club)).outstanding).toBe('75.00');
  vi.setSystemTime(new Date('2026-11-03T08:30:00Z'));
  const after=await getClubFinance(club,new URLSearchParams({month:'all'}));
  expect(after.debts[0].periods).toEqual(['2026-10','2026-11']);expect(after.outstanding).toBe('150.00');
  expect((await getClubDebtSummary(club)).outstanding).toBe('150.00');
 } finally {vi.useRealTimers();}
});
