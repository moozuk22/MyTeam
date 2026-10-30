import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

it('merges same-name categories without losing entries, amounts, visibility or payment links', async () => {
 const db = new PGlite();
 const club = '00000000-0000-0000-0000-000000000001';
 const other = '00000000-0000-0000-0000-000000000002';
 const player = '00000000-0000-0000-0000-000000000003';
 try {
  await db.exec(`CREATE TABLE clubs(id uuid PRIMARY KEY); CREATE TABLE players(id uuid PRIMARY KEY,club_id uuid,full_name text); CREATE TABLE payment_logs(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),player_id uuid REFERENCES players(id),paid_at timestamptz DEFAULT CURRENT_TIMESTAMP,amount numeric,currency text DEFAULT 'EUR'); INSERT INTO clubs VALUES('${club}'),('${other}');`);
  for (const migration of ['20261029160000_club_finance','20261029190000_manual_club_revenue','20261029210000_finance_category_order','20261029223000_finance_category_active']) {
   await db.exec(readFileSync(`prisma/migrations/${migration}/migration.sql`,'utf8'));
  }
  await db.exec(`
   INSERT INTO players VALUES('${player}','${club}','Player');
   UPDATE club_finance_categories SET is_active=false WHERE club_id='${club}' AND name='Храна';
   INSERT INTO club_finance_categories(club_id,name,kind,is_active) VALUES('${club}','Храна','revenue',true),('${club}','Членски внос','expense',true);
   INSERT INTO club_finance_entries(club_id,category_id,kind,amount,description,voided_at)
   SELECT club_id,id,kind,CASE WHEN kind='revenue' THEN 150 ELSE 45 END,'original',CASE WHEN kind='expense' THEN now() ELSE NULL END FROM club_finance_categories WHERE club_id='${club}' AND name='Храна';
   INSERT INTO club_finance_entries(club_id,category_id,kind,amount) SELECT club_id,id,kind,15 FROM club_finance_categories WHERE club_id='${club}' AND name='Членски внос' AND kind='expense';
   INSERT INTO payment_logs(player_id,amount) VALUES('${player}',60);
  `);
  const before = (await db.query('SELECT id,club_id,kind,amount,currency,description,voided_at,payment_reference FROM club_finance_entries ORDER BY id')).rows;
  const membershipId = (await db.query(`SELECT id FROM club_finance_categories WHERE club_id='${club}' AND is_membership`)).rows;
  await db.exec(readFileSync('prisma/migrations/20261030010000_shared_finance_categories/migration.sql','utf8'));
  expect((await db.query('SELECT id,club_id,kind,amount,currency,description,voided_at,payment_reference FROM club_finance_entries ORDER BY id')).rows).toEqual(before);
  expect((await db.query(`SELECT id FROM club_finance_categories WHERE club_id='${club}' AND is_membership`)).rows).toEqual(membershipId);
  expect((await db.query(`SELECT is_active FROM club_finance_categories WHERE club_id='${club}' AND name='Храна'`)).rows).toEqual([{is_active:true}]);
  expect((await db.query(`SELECT count(DISTINCT category_id)::int n FROM club_finance_entries e JOIN club_finance_categories c ON c.id=e.category_id WHERE c.name='Храна'`)).rows).toEqual([{n:1}]);
  expect((await db.query(`SELECT count(*)::int n FROM club_finance_categories WHERE name='Членски внос'`)).rows).toEqual([{n:2}]);
  await expect(db.exec(`INSERT INTO club_finance_categories(club_id,name) VALUES('${club}','Храна')`)).rejects.toThrow();
  // Both kinds can now use the same category, including one originally used only for revenue.
  await db.exec(`INSERT INTO club_finance_entries(club_id,category_id,kind,amount) SELECT club_id,id,'expense',20 FROM club_finance_categories WHERE club_id='${club}' AND is_membership;
   INSERT INTO club_finance_entries(club_id,category_id,kind,amount) SELECT club_id,id,'revenue',25 FROM club_finance_categories WHERE club_id='${club}' AND name='Храна';
   INSERT INTO payment_logs(player_id,amount) VALUES('${player}',70);
   INSERT INTO clubs VALUES('00000000-0000-0000-0000-000000000004');`);
  expect((await db.query(`SELECT amount::text FROM club_finance_entries WHERE payment_reference IS NOT NULL ORDER BY amount`)).rows).toEqual([{amount:'60.00'},{amount:'70.00'}]);
  expect((await db.query(`SELECT count(*)::int n FROM club_finance_categories WHERE club_id='00000000-0000-0000-0000-000000000004'`)).rows).toEqual([{n:16}]);
  expect((await db.query(`SELECT count(*)::int n FROM club_finance_categories WHERE club_id='${club}'`)).rows).toEqual([{n:16}]);
 } finally { await db.close(); }
},20000);
