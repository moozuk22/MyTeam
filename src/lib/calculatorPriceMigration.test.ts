import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
it('preserves existing prices and permits saving one billing option at a time',async()=>{
 const db=new PGlite();
 try{
  const old=readFileSync('prisma/migrations/20261031120000_calculator_subscriptions/migration.sql','utf8').split('CREATE TABLE club_calculator_subscriptions')[0];
  await db.exec(old);
  await db.exec(`INSERT INTO calculator_price_revisions(id,effective_month,monthly,yearly,lifetime,actor_id) VALUES('00000000-0000-0000-0000-000000000001','2026-01',10,100,500,'admin'),('00000000-0000-0000-0000-000000000002','2026-05',12,120,600,'admin');`);
  await db.exec(readFileSync('prisma/migrations/20261031140000_independent_calculator_prices/migration.sql','utf8'));
  expect((await db.query(`SELECT effective_month,billing_mode,COALESCE(monthly,yearly,lifetime)::text amount FROM calculator_price_revisions ORDER BY effective_month,billing_mode`)).rows).toEqual([
   {effective_month:'2026-01',billing_mode:'lifetime',amount:'500.00'},{effective_month:'2026-01',billing_mode:'monthly',amount:'10.00'},{effective_month:'2026-01',billing_mode:'yearly',amount:'100.00'},
   {effective_month:'2026-05',billing_mode:'lifetime',amount:'600.00'},{effective_month:'2026-05',billing_mode:'monthly',amount:'12.00'},{effective_month:'2026-05',billing_mode:'yearly',amount:'120.00'},
  ]);
  await db.exec(`INSERT INTO calculator_price_revisions(id,effective_month,billing_mode,monthly,actor_id)VALUES(gen_random_uuid(),'2026-11','monthly',15,'admin');INSERT INTO calculator_price_revisions(id,effective_month,billing_mode,yearly,actor_id)VALUES(gen_random_uuid(),'2026-11','yearly',150,'admin');`);
  await expect(db.exec(`INSERT INTO calculator_price_revisions(id,effective_month,billing_mode,actor_id)VALUES(gen_random_uuid(),'2026-12','monthly','admin');`)).rejects.toThrow();
  await expect(db.exec(`INSERT INTO calculator_price_revisions(id,effective_month,billing_mode,monthly,yearly,actor_id)VALUES(gen_random_uuid(),'2026-12','monthly',10,100,'admin');`)).rejects.toThrow();
  await expect(db.exec(`INSERT INTO calculator_price_revisions(id,effective_month,billing_mode,monthly,actor_id)VALUES(gen_random_uuid(),'2026-11','monthly',20,'admin');`)).rejects.toThrow();
 }finally{await db.close();}
},20000);
