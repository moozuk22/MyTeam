import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
const club='00000000-0000-0000-0000-000000000001';const player='00000000-0000-0000-0000-000000000002';const other='00000000-0000-0000-0000-000000000003';
it('gates live capture, backfills paid periods once, leaves gaps empty and preserves earlier history',async()=>{
 const db=new PGlite();
 try{
  await db.exec(`CREATE TABLE clubs(id uuid PRIMARY KEY);CREATE TABLE players(id uuid PRIMARY KEY,club_id uuid,full_name text);CREATE TABLE payment_logs(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),player_id uuid REFERENCES players(id) ON DELETE CASCADE,paid_at timestamptz DEFAULT CURRENT_TIMESTAMP,amount numeric,currency text DEFAULT 'EUR');CREATE TABLE club_subscriptions(club_id uuid PRIMARY KEY,mode text,trial_end_date text);INSERT INTO clubs VALUES('${club}'),('${other}');INSERT INTO players VALUES('${player}','${club}','Player');`);
  for(const migration of ['20261029160000_club_finance','20261029190000_manual_club_revenue'])await db.exec(readFileSync(`prisma/migrations/${migration}/migration.sql`,'utf8'));
  await db.exec(`UPDATE clubs SET finance_started_at='2020-01-01';INSERT INTO payment_logs(player_id,amount,paid_at)VALUES('${player}',5,'2021-01-01');`);
  await db.exec(readFileSync('prisma/migrations/20261031120000_calculator_subscriptions/migration.sql','utf8'));
  await db.exec(readFileSync('prisma/migrations/20261101003000_finance_backfill_payment_lock/migration.sql','utf8'));
  // Existing data survives rollout, but disabled capture adds nothing.
  await db.exec(`INSERT INTO payment_logs(player_id,amount,paid_at)VALUES('${player}',10,'2026-01-03'),('${player}',20,'2026-02-03'),('${player}',30,'2026-03-03');`);
  expect((await db.query('SELECT amount::text FROM club_finance_entries')).rows).toEqual([{amount:'5.00'}]);
  await db.exec(`INSERT INTO club_calculator_subscriptions(club_id)VALUES('${club}');INSERT INTO club_calculator_payments(id,club_id,billing_mode,paid_on,total,request,created_by)VALUES('10000000-0000-0000-0000-000000000001','${club}','monthly','2026-01-15',10,'{}','admin');INSERT INTO club_calculator_grants(club_id,kind,starts_at,ends_at,payment_id)VALUES('${club}','paid','2026-01-01 Europe/Sofia','2026-02-01 Europe/Sofia','10000000-0000-0000-0000-000000000001');SELECT backfill_calculator_revenue('${club}','10000000-0000-0000-0000-000000000001');SELECT backfill_calculator_revenue('${club}','10000000-0000-0000-0000-000000000001');`);
  expect((await db.query('SELECT sum(amount)::text total FROM club_finance_entries')).rows).toEqual([{total:'15.00'}]);
  await db.exec(`INSERT INTO club_finance_entries(club_id,category_id,kind,amount,occurred_at)SELECT '${club}',id,'expense',3,'2026-01-20 Europe/Sofia' FROM club_finance_categories WHERE club_id='${club}' AND name='Наем на терени';`);
  await expect(db.exec(`INSERT INTO club_finance_entries(club_id,category_id,kind,amount,occurred_at)SELECT '${club}',id,'expense',3,'2026-02-20 Europe/Sofia' FROM club_finance_categories WHERE club_id='${club}' AND name='Наем на терени';`)).rejects.toThrow('CALCULATOR_INACTIVE_DATE');
  // A backdated payment entered while inactive must not be pulled into an
  // unrelated future purchase, even though its receipt date was once covered.
  await db.exec(`INSERT INTO payment_logs(player_id,amount,paid_at)VALUES('${player}',13,'2026-01-25');INSERT INTO club_calculator_payments(id,club_id,billing_mode,paid_on,total,request,created_by)VALUES('10000000-0000-0000-0000-000000000002','${club}','monthly','2026-03-15',10,'{}','admin');INSERT INTO club_calculator_grants(club_id,kind,starts_at,ends_at,payment_id)VALUES('${club}','paid','2026-03-01 Europe/Sofia','2026-04-01 Europe/Sofia','10000000-0000-0000-0000-000000000002');SELECT backfill_calculator_revenue('${club}','10000000-0000-0000-0000-000000000002');`);
  expect((await db.query("SELECT sum(CASE WHEN kind='revenue' THEN amount ELSE -amount END)::text balance FROM club_finance_entries")).rows).toEqual([{balance:'42.00'}]);
  expect((await db.query("SELECT count(*)::int count FROM club_finance_entries WHERE occurred_at>='2026-02-01 Europe/Sofia' AND occurred_at<'2026-03-01 Europe/Sofia'")).rows).toEqual([{count:0}]);
  await expect(db.exec(`UPDATE club_finance_entries SET occurred_at='2026-02-20 Europe/Sofia' WHERE kind='expense'`)).rejects.toThrow('CALCULATOR_INACTIVE_DATE');
  // Snapshots keep uncaptured payments attached to their original club when players move.
  await db.exec(`UPDATE players SET club_id='${other}';INSERT INTO club_calculator_subscriptions(club_id)VALUES('${other}');INSERT INTO club_calculator_grants(club_id,kind,starts_at)VALUES('${other}','contract','2020-01-01');SELECT backfill_calculator_revenue('${other}','10000000-0000-0000-0000-000000000001');`);
  expect((await db.query(`SELECT count(*)::int count FROM club_finance_entries WHERE club_id='${other}'`)).rows).toEqual([{count:0}]);
  await db.exec(`UPDATE players SET club_id='${club}';INSERT INTO club_calculator_grants(club_id,kind,starts_at)VALUES('${club}','contract',clock_timestamp()-interval '1 minute');INSERT INTO payment_logs(player_id,amount,currency)VALUES('${player}',7,'USD');`);
  expect((await db.query("SELECT amount::text,currency FROM club_finance_entries WHERE currency='USD'")).rows).toEqual([{amount:'7.00',currency:'USD'}]);
  await db.exec(`UPDATE club_calculator_grants SET ends_at=clock_timestamp() WHERE club_id='${club}' AND kind='contract';INSERT INTO payment_logs(player_id,amount)VALUES('${player}',11);`);
  expect((await db.query('SELECT count(*)::int count FROM club_finance_entries WHERE amount=11')).rows).toEqual([{count:0}]);
  // Voiding entitlement never deletes financial history. Explicit player payment undo still voids revenue.
  await db.exec(`UPDATE club_calculator_grants SET revoked_at=clock_timestamp() WHERE payment_id IS NOT NULL;DELETE FROM payment_logs WHERE amount=30;`);
  expect((await db.query('SELECT count(*)::int count FROM club_finance_entries WHERE amount=30 AND voided_at IS NOT NULL')).rows).toEqual([{count:1}]);
  expect((await db.query('SELECT count(*)::int count FROM club_finance_entries WHERE kind=\'expense\'')).rows).toEqual([{count:1}]);
  // Trial follows regular subscription dates; disabling it prevents later extension from re-enabling it.
  await db.exec(`INSERT INTO club_subscriptions VALUES('${club}','trial',NULL);UPDATE club_calculator_subscriptions SET free_enabled=true WHERE club_id='${club}';INSERT INTO club_calculator_grants(club_id,kind,starts_at)VALUES('${club}','trial',clock_timestamp());UPDATE club_subscriptions SET trial_end_date='2090-10-31' WHERE club_id='${club}';`);
  expect((await db.query(`SELECT to_char(ends_at AT TIME ZONE 'Europe/Sofia','YYYY-MM-DD HH24:MI') ending FROM club_calculator_grants WHERE kind='trial'`)).rows).toEqual([{ending:'2090-11-01 00:00'}]);
  await db.exec(`UPDATE club_subscriptions SET trial_end_date=NULL WHERE club_id='${club}';`);
  expect((await db.query("SELECT ends_at FROM club_calculator_grants WHERE kind='trial'")).rows).toEqual([{ends_at:null}]);
  await db.exec(`UPDATE club_subscriptions SET mode='paid' WHERE club_id='${club}';`);
  expect((await db.query(`SELECT calculator_enabled_at('${club}',clock_timestamp()) enabled`)).rows).toEqual([{enabled:false}]);
 }finally{await db.close();}
},30000);
