import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
it('preserves old visibility, defaults new categories to visible, and retains history',async()=>{
 const db=new PGlite();
 try {
  await db.exec(`CREATE TABLE club_finance_categories(id int PRIMARY KEY,is_active boolean NOT NULL DEFAULT true);
   CREATE TABLE club_finance_entries(id int PRIMARY KEY,category_id int REFERENCES club_finance_categories(id),amount numeric);
   INSERT INTO club_finance_categories VALUES(1,true),(2,false);
   INSERT INTO club_finance_entries VALUES(1,2,125);`);
  await db.exec(readFileSync('prisma/migrations/20261106010000_finance_category_visibility/migration.sql','utf8'));
  expect((await db.query('SELECT hidden_for_expense,hidden_for_revenue FROM club_finance_categories ORDER BY id')).rows).toEqual([{hidden_for_expense:false,hidden_for_revenue:false},{hidden_for_expense:true,hidden_for_revenue:true}]);
  await db.exec('INSERT INTO club_finance_categories(id) VALUES(3)');
  expect((await db.query('SELECT hidden_for_expense,hidden_for_revenue FROM club_finance_categories WHERE id=3')).rows).toEqual([{hidden_for_expense:false,hidden_for_revenue:false}]);
  expect((await db.query('SELECT amount::text FROM club_finance_entries')).rows).toEqual([{amount:'125'}]);
 } finally {await db.close();}
},20000);
