import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
it('captures all payment insert styles atomically after launch and preserves club-owned history', async () => {
 const db = new PGlite();
 try {
  await db.exec(`CREATE TABLE clubs(id uuid PRIMARY KEY); CREATE TABLE players(id uuid PRIMARY KEY, club_id uuid, full_name text); CREATE TABLE payment_logs(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),player_id uuid REFERENCES players(id) ON DELETE CASCADE,paid_at timestamptz DEFAULT CURRENT_TIMESTAMP,amount numeric,currency text DEFAULT 'EUR'); INSERT INTO clubs VALUES ('00000000-0000-0000-0000-000000000001');`);
  await db.exec(readFileSync('prisma/migrations/20261029160000_club_finance/migration.sql','utf8'));
  await db.exec(readFileSync('prisma/migrations/20261029190000_manual_club_revenue/migration.sql','utf8'));
  await db.exec(readFileSync('prisma/migrations/20261029210000_finance_category_order/migration.sql','utf8'));
  await db.exec(readFileSync('prisma/migrations/20261029223000_finance_category_active/migration.sql','utf8'));
  expect((await db.query('SELECT DISTINCT is_active FROM club_finance_categories')).rows).toEqual([{is_active:true}]);
  expect((await db.query('SELECT sort_order FROM club_finance_categories ORDER BY sort_order LIMIT 1')).rows).toEqual([{sort_order:0}]);
  await db.exec(`INSERT INTO clubs VALUES ('00000000-0000-0000-0000-000000000004'); INSERT INTO players VALUES ('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001','Player');`);
  expect((await db.query('SELECT * FROM club_finance_categories')).rows).toHaveLength(32);
  await db.exec(`INSERT INTO club_finance_categories(club_id,name,kind) VALUES ('00000000-0000-0000-0000-000000000001','Спонсори','revenue');`);
  await db.exec(`INSERT INTO payment_logs(player_id,paid_at,amount) VALUES ('00000000-0000-0000-0000-000000000002','2020-01-01',40); INSERT INTO payment_logs(id,player_id,amount) VALUES ('00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000002',40); INSERT INTO payment_logs(player_id,amount) VALUES ('00000000-0000-0000-0000-000000000002',30),('00000000-0000-0000-0000-000000000002',20);`);
  expect((await db.query('SELECT * FROM club_finance_entries')).rows).toHaveLength(3);
  expect((await db.query(`SELECT DISTINCT c.is_membership FROM club_finance_entries e JOIN club_finance_categories c ON c.id=e.category_id`)).rows).toEqual([{is_membership:true}]);
  await db.exec(`INSERT INTO club_finance_entries(club_id,category_id,kind,amount) SELECT club_id,id,'revenue',12.34 FROM club_finance_categories WHERE name='Спонсори';`);
  await expect(db.exec(`INSERT INTO club_finance_entries(club_id,category_id,kind,amount) SELECT club_id,id,'revenue',0 FROM club_finance_categories WHERE name='Спонсори'`)).rejects.toThrow();
  await db.exec(`DELETE FROM club_finance_entries WHERE payment_reference IS NULL;`);
  await expect(db.exec(`INSERT INTO payment_logs(id,player_id,amount) VALUES ('00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000002',40)`)).rejects.toThrow();
  await expect(db.exec(`INSERT INTO payment_logs(player_id,amount) VALUES ('00000000-0000-0000-0000-000000000002',NULL)`)).rejects.toThrow();
  await db.exec(`DELETE FROM payment_logs WHERE amount=20;`);
  expect((await db.query('SELECT sum(amount)::text total FROM club_finance_entries WHERE voided_at IS NULL')).rows).toEqual([{total:'70.00'}]);
  await db.exec(`UPDATE club_finance_categories SET name='Custom fees' WHERE is_membership=true AND club_id='00000000-0000-0000-0000-000000000001'; UPDATE players SET club_id='00000000-0000-0000-0000-000000000004'; DELETE FROM players; DELETE FROM payment_logs;`);
  expect((await db.query('SELECT sum(amount)::text total FROM club_finance_entries')).rows).toEqual([{ total: '90.00' }]);
  expect((await db.query(`SELECT name FROM club_finance_categories WHERE is_membership=true AND club_id='00000000-0000-0000-0000-000000000004'`)).rows).toEqual([{name:'Членски внос'}]);
 } finally { await db.close(); }
},20000);
