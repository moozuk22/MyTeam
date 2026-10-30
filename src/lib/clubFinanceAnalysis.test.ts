import { PGlite } from '@electric-sql/pglite';
import { beforeEach, expect, it, vi } from 'vitest';
const tx = vi.hoisted(() => ({club:{findUnique:vi.fn()},clubFinanceCategory:{findMany:vi.fn()},$queryRaw:vi.fn()}));
vi.mock('./db',() => ({prisma:{$transaction:(callback:(value:unknown)=>unknown)=>callback(tx)}}));
import { getClubFinanceAnalysis } from './clubFinance';
const club = '00000000-0000-0000-0000-000000000001';
const category = '00000000-0000-0000-0000-000000000002';
beforeEach(() => {
 vi.resetAllMocks();
 tx.club.findUnique.mockResolvedValue({id:club});
 tx.clubFinanceCategory.findMany.mockResolvedValue([{id:category,name:'Обща'}]);
 tx.$queryRaw.mockResolvedValue([]);
});
it('aggregates exact amounts by Sofia month and type, excluding voided, other-club and future-month entries', async () => {
 const db = new PGlite();
 try {
  await db.exec(`CREATE TABLE club_finance_entries(club_id uuid,category_id uuid,kind text,currency text,amount numeric,occurred_at timestamptz,voided_at timestamptz);
   INSERT INTO club_finance_entries VALUES
   ('${club}','${category}','revenue','EUR',0.10,'2025-12-31 22:00Z',NULL),
   ('${club}','${category}','revenue','EUR',0.20,'2026-10-01 12:00Z',NULL),
   ('${club}','${category}','expense','EUR',5,'2026-10-10 12:00Z',NULL),
   ('${club}','${category}','revenue','USD',8,'2026-09-30 21:30Z',NULL),
   ('${club}','${category}','revenue','EUR',1000,'2025-12-31 21:59Z',NULL),
   ('${club}','${category}','revenue','EUR',2000,'2026-10-31 22:00Z',NULL),
   ('${club}','${category}','revenue','EUR',3000,'2026-10-20 12:00Z',now()),
   ('00000000-0000-0000-0000-000000000004','${category}','revenue','EUR',4000,'2026-10-20 12:00Z',NULL);`);
  tx.$queryRaw.mockImplementation(async (sql:{text:string;values:unknown[]}) => (await db.query(sql.text,sql.values)).rows);
  const result = await getClubFinanceAnalysis(club,new Date('2026-10-30T12:00:00Z'));
  expect(result.rows.map(row=>row.key)).toEqual(['year','2026-10','2026-09','2026-08','2026-07','2026-06','2026-05','2026-04','2026-03','2026-02','2026-01']);
  expect(result.rows[0].label).toBe('Текуща година');
  expect(result.rows[0].values).toEqual(expect.arrayContaining([
   {categoryId:category,kind:'revenue',currency:'EUR',amount:'0.30'},
   {categoryId:category,kind:'expense',currency:'EUR',amount:'5.00'},
   {categoryId:category,kind:'revenue',currency:'USD',amount:'8.00'},
  ]));
  expect(result.rows[0].values).toHaveLength(3);
  expect(result.rows[1].values).toContainEqual({categoryId:category,kind:'revenue',currency:'USD',amount:'8.00'});
  expect(result.rows.at(-1)?.values).toEqual([{categoryId:category,kind:'revenue',currency:'EUR',amount:'0.10'}]);
  expect(result.rows[2].values).toEqual([]);
  expect(tx.clubFinanceCategory.findMany).toHaveBeenCalledWith(expect.objectContaining({where:{clubId:club}}));
 } finally { await db.close(); }
},20000);
it('starts a new year using Sofia time and still returns empty months and categories', async () => {
 const result = await getClubFinanceAnalysis(club,new Date('2026-12-31T22:30:00Z'));
 expect(result.year).toBe(2027);
 expect(result.currentMonth).toBe('2027-01');
 expect(result.rows.map(row=>row.key)).toEqual(['year','2027-01']);
 expect(result.categories).toEqual([{id:category,name:'Обща'}]);
 expect(result.rows.every(row=>row.values.length===0)).toBe(true);
 tx.club.findUnique.mockResolvedValue(null);
 await expect(getClubFinanceAnalysis(club)).rejects.toThrow('Клубът не е намерен');
});
