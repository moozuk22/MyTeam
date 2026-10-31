import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';
const mocks=vi.hoisted(()=>({
 $transaction:vi.fn(),$queryRaw:vi.fn(),$executeRaw:vi.fn(),
 club:{findUniqueOrThrow:vi.fn()},calculatorPriceRevision:{findMany:vi.fn(),findFirst:vi.fn(),findUnique:vi.fn(),create:vi.fn()},
 clubCalculatorSubscription:{findUnique:vi.fn(),upsert:vi.fn(),update:vi.fn()},
 clubCalculatorPrice:{upsert:vi.fn()},clubCalculatorGrant:{create:vi.fn(),updateMany:vi.fn()},
 clubCalculatorPayment:{findUnique:vi.fn(),create:vi.fn(),update:vi.fn()},
 notice:vi.fn(),deliver:vi.fn(),
}));
vi.mock('./db',()=>({prisma:mocks}));
vi.mock('./clubSubscriptions',()=>({saveSubscriptionNotification:mocks.notice,deliverSubscriptionNotification:mocks.deliver}));
import { calculatorAccess, changeCalculatorPrices, changeCalculatorSubscription } from './calculatorSubscriptions';
const club='00000000-0000-0000-0000-000000000001',paymentId='00000000-0000-0000-0000-000000000002';
const decimal=(s:string)=>new Prisma.Decimal(s);
let state:{version:number;billingMode:string;freeEnabled:boolean;prices:never[];grants:Array<{id:string;kind:string;startsAt:Date;endsAt:Date|null;revokedAt:Date|null;paymentId:string|null;amount:Prisma.Decimal|null}>;payments:Array<{id:string;clubId:string;paidOn:string;note:string|null;total:Prisma.Decimal;createdBy:string;request:unknown;voidedAt:Date|null}>};
let platform:{mode:string;trialEndDate:string|null};
beforeEach(()=>{
 vi.resetAllMocks();vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-31T12:00:00Z'));
 state={version:1,billingMode:'monthly',freeEnabled:false,prices:[],grants:[],payments:[]};platform={mode:'paid',trialEndDate:null};
 mocks.$transaction.mockImplementation(callback=>callback(mocks));mocks.$queryRaw.mockResolvedValue([{id:club}]);
 mocks.club.findUniqueOrThrow.mockImplementation(async()=>({billingStatus:'active',platformSubscription:platform}));
 mocks.clubCalculatorSubscription.findUnique.mockImplementation(async()=>state);
 mocks.calculatorPriceRevision.findMany.mockResolvedValue([{id:'price',effectiveMonth:'2026-01',monthly:decimal('10'),yearly:decimal('100'),lifetime:decimal('500')}]);
 mocks.clubCalculatorSubscription.update.mockImplementation(async({data})=>{if(data.version)state.version+=data.version.increment;if(data.billingMode)state.billingMode=data.billingMode;if('freeEnabled'in data)state.freeEnabled=data.freeEnabled;});
 mocks.clubCalculatorPayment.findUnique.mockImplementation(async({where})=>state.payments.find(p=>p.id===where.id)??null);
 mocks.clubCalculatorPayment.create.mockImplementation(async({data})=>{state.payments.push({...data,total:decimal(data.total),voidedAt:null});state.grants.push(...data.grants.create.map((g:typeof state.grants[number])=>({...g,id:'grant',paymentId:data.id,revokedAt:null,amount:decimal(String(g.amount))})));});
 mocks.deliver.mockResolvedValue({ok:true});
});
afterEach(()=>vi.useRealTimers());
const pay=(extra={})=>({action:'payment',expectedVersion:state.version,paymentId,months:['2026-10'],expectedTotal:'10.00',paidOn:'2026-10-31',note:'bank',...extra});
const change=(body:Record<string,unknown>)=>changeCalculatorSubscription(club,body,'admin');
describe('calculator billing mutations',()=>{
 it.each([
  {action:'configure',billingMode:'yearly'},
  {action:'price',billingMode:'monthly',effectiveMonth:'2026-10',amount:'15'},
  {action:'price',billingMode:'monthly',effectiveMonth:'2026-10',amount:null},
 ])('keeps configuration changes in the audit without notifying the club: %j',async body=>{
  await change({...body,expectedVersion:state.version});
  expect(mocks.clubCalculatorSubscription.update).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({changes:{create:expect.objectContaining({action:body.action})}})}));
  expect(mocks.notice).not.toHaveBeenCalled();
  expect(mocks.deliver).toHaveBeenCalledWith(club,null);
 });
 it('records immutable period/amount snapshots, backfills inside the transaction and delivers after commit',async()=>{
  await change(pay());
  expect(state.payments).toHaveLength(1);expect(state.payments[0].total.toFixed(2)).toBe('10.00');
  expect(state.grants[0]).toMatchObject({startsAt:new Date('2026-09-30T21:00:00Z'),endsAt:new Date('2026-10-31T22:00:00Z')});
  expect(mocks.$executeRaw.mock.calls.some(c=>c[0].join('').includes('backfill_calculator_revenue'))).toBe(true);
  expect(mocks.notice).toHaveBeenCalledTimes(1);expect(mocks.deliver).toHaveBeenCalledTimes(1);
  expect(mocks.notice.mock.invocationCallOrder[0]).toBeLessThan(mocks.deliver.mock.invocationCallOrder[0]);
 });
 it('retries matching UUIDs with stale versions without backfilling or notifying twice, even after void',async()=>{
  const request=pay();await change(request);state.payments[0].voidedAt=new Date();
  await change(request);
  expect(state.payments).toHaveLength(1);expect(mocks.notice).toHaveBeenCalledTimes(1);expect(mocks.deliver.mock.calls[1][1]).toBeNull();
  await expect(change({...request,note:'different'})).rejects.toMatchObject({status:409});
 });
 it('rejects stale input, changed totals and overlapping coverage',async()=>{
  await expect(change(pay({expectedVersion:0}))).rejects.toMatchObject({status:409});
  await expect(change(pay({expectedTotal:'9.99'}))).rejects.toMatchObject({status:409});
  await change(pay());
  await expect(change(pay({paymentId:'00000000-0000-0000-0000-000000000003'}))).rejects.toMatchObject({status:409});
 });
 it('records yearly and lifetime coverage using the selected mode',async()=>{
  state.billingMode='yearly';await change(pay({expectedTotal:'100.00',months:['2026-11']}));
  expect(state.grants[0]).toMatchObject({startsAt:new Date('2026-10-31T22:00:00Z'),endsAt:new Date('2027-10-31T22:00:00Z')});
  state.billingMode='lifetime';await change(pay({paymentId:'00000000-0000-0000-0000-000000000003',months:['2027-11'],expectedTotal:'500.00'}));
  expect(state.grants[1].endsAt).toBeNull();
 });
 it('voids entitlement without deleting revenue or expenses',async()=>{
  await change(pay());await change({action:'void',paymentId,expectedVersion:state.version});
  expect(mocks.clubCalculatorGrant.updateMany).toHaveBeenCalledWith({where:{paymentId},data:{revokedAt:expect.any(Date)}});
  expect(mocks.clubCalculatorPayment.update).toHaveBeenCalled();
 });
 it('ties free grants to the club trial or contract, and rejects paid calculator purchases for contracts',async()=>{
  platform={mode:'trial',trialEndDate:'2026-11-05'};
  await change({action:'grant',enabled:true,expectedVersion:1});
  expect(mocks.clubCalculatorGrant.create).toHaveBeenCalledWith({data:expect.objectContaining({kind:'trial',startsAt:new Date(),endsAt:new Date('2026-11-05T22:00:00Z')})});
  platform={mode:'contract',trialEndDate:null};
  await expect(change(pay())).rejects.toThrow('договор');
  state.freeEnabled=false;
  await change({action:'grant',enabled:true,expectedVersion:state.version});
  expect(mocks.clubCalculatorGrant.create).toHaveBeenLastCalledWith({data:expect.objectContaining({kind:'contract',endsAt:null})});
 });
 it('exposes a safe summary and permits admin viewing without enabling recording',async()=>{
  const access=await calculatorAccess(club,true);
  expect(access).toMatchObject({enabled:false,canView:true,billingMode:'monthly',price:'10.00',periods:[]});
  expect(access).not.toHaveProperty('payments');expect(access).not.toHaveProperty('changes');
  expect((await calculatorAccess(club)).canView).toBe(false);
 });
});
describe('shared calculator prices',()=>{
 it('allows initial historical pricing, validates amounts, and rejects stale/future-invalid revisions',async()=>{
  mocks.calculatorPriceRevision.findFirst.mockResolvedValue(null);mocks.calculatorPriceRevision.findUnique.mockResolvedValue(null);
  const body={effectiveMonth:'2026-01',billingMode:'monthly',amount:'10',expectedRevision:null};
  await changeCalculatorPrices(body,'admin');
  expect(mocks.calculatorPriceRevision.create).toHaveBeenCalledWith({data:{effectiveMonth:'2026-01',billingMode:'monthly',monthly:'10.00',yearly:null,lifetime:null,actorId:'admin'}});
  mocks.calculatorPriceRevision.findFirst.mockResolvedValue({id:'latest'});
  await expect(changeCalculatorPrices(body,'admin')).rejects.toMatchObject({status:409});
  await expect(changeCalculatorPrices({...body,expectedRevision:'latest'},'admin')).rejects.toThrow('бъдещ');
  await expect(changeCalculatorPrices({...body,effectiveMonth:'2026-11',expectedRevision:'latest',amount:'0'},'admin')).rejects.toThrow('положителна');
 });
});

it.each(['monthly','yearly','lifetime'])('saves only the selected shared %s price without requiring the other two',async billingMode=>{
 mocks.calculatorPriceRevision.findFirst.mockResolvedValue(null);
 mocks.calculatorPriceRevision.findUnique.mockResolvedValue(null);
 await changeCalculatorPrices({billingMode,amount:'25.00',effectiveMonth:'2026-10',expectedRevision:null},'admin');
 expect(mocks.calculatorPriceRevision.create).toHaveBeenCalledWith({data:{billingMode,effectiveMonth:'2026-10',monthly:billingMode==='monthly'?'25.00':null,yearly:billingMode==='yearly'?'25.00':null,lifetime:billingMode==='lifetime'?'25.00':null,actorId:'admin'}});
});

it('allows the first yearly price in the current month even when monthly pricing already exists',async()=>{
 mocks.calculatorPriceRevision.findFirst.mockImplementation(async args=>args?.where?.billingMode?null:{id:'monthly-revision'});
 mocks.calculatorPriceRevision.findUnique.mockResolvedValue(null);
 await changeCalculatorPrices({billingMode:'yearly',amount:'90.00',effectiveMonth:'2026-10',expectedRevision:'monthly-revision'},'admin');
 expect(mocks.calculatorPriceRevision.create).toHaveBeenCalledWith({data:expect.objectContaining({billingMode:'yearly',monthly:null,yearly:'90.00',lifetime:null})});
});

// Renewal restores the original receipt rather than recording another payment.
it('restores a voided payment and its original coverage without creating a second receipt', async () => {
 await change(pay());
 state.payments[0].voidedAt = new Date();
 state.grants[0].revokedAt = new Date();
 await change({action:'restore', paymentId, expectedVersion:state.version});
 expect(state.payments).toHaveLength(1);
 expect(mocks.clubCalculatorPayment.create).toHaveBeenCalledTimes(1);
 expect(mocks.clubCalculatorPayment.update).toHaveBeenCalledWith({where:{id:paymentId},data:{voidedAt:null,voidedBy:null}});
 expect(mocks.clubCalculatorGrant.updateMany).toHaveBeenCalledWith({where:{paymentId},data:{revokedAt:null}});
 expect(mocks.clubCalculatorSubscription.update).toHaveBeenLastCalledWith(expect.objectContaining({data:expect.objectContaining({changes:{create:expect.objectContaining({action:'restore'})}})}));
 expect(mocks.$executeRaw.mock.calls.filter(c=>c[0].join('').includes('backfill_calculator_revenue'))).toHaveLength(2);
});
it('rejects renewal when another paid period overlaps the cancelled coverage', async () => {
 await change(pay());state.payments[0].voidedAt=new Date();state.grants[0].revokedAt=new Date();
 state.grants.push({...state.grants[0],id:'other',paymentId:'other',revokedAt:null});
 await expect(change({action:'restore',paymentId,expectedVersion:state.version})).rejects.toMatchObject({status:409});
 expect(mocks.clubCalculatorPayment.update).not.toHaveBeenCalled();
});
it('directs duplicate purchases of cancelled coverage to restoring the original receipt', async () => {
 await change(pay());state.payments[0].voidedAt=new Date();state.grants[0].revokedAt=new Date();
 await expect(change(pay({paymentId:'00000000-0000-0000-0000-000000000003'}))).rejects.toThrow('Възстановете');
 expect(state.payments).toHaveLength(1);
});

it('keeps original yearly snapshots across restore retries, mode changes and new prices', async () => {
 state.billingMode='yearly';await change(pay({expectedTotal:'100.00'}));
 state.payments[0].voidedAt=new Date();state.grants[0].revokedAt=new Date();
 state.billingMode='monthly';mocks.calculatorPriceRevision.findMany.mockResolvedValue([]);
 mocks.clubCalculatorPayment.update.mockImplementation(async ({data})=>Object.assign(state.payments[0],data));
 mocks.clubCalculatorGrant.updateMany.mockImplementation(async ({data})=>Object.assign(state.grants[0],data));
 await change({action:'restore',paymentId,expectedVersion:state.version});
 const restoredVersion=state.version;
 await change({action:'restore',paymentId,expectedVersion:restoredVersion});
 expect(state.version).toBe(restoredVersion);
 expect(state.payments).toHaveLength(1);
 expect(state.payments[0].total.toFixed(2)).toBe('100.00');
 expect(state.grants[0].endsAt).toEqual(new Date('2027-09-30T21:00:00Z'));
 expect(state.grants[0].revokedAt).toBeNull();
 expect(mocks.clubCalculatorPayment.update).toHaveBeenCalledTimes(1);
 await expect(change({action:'restore',paymentId,expectedVersion:0})).rejects.toMatchObject({status:409});
});
