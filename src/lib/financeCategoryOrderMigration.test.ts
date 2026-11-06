import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
it('copies existing order into both kinds and permits independent changes',async()=>{
 const db=new PGlite();
 try {
  await db.exec(`CREATE TABLE club_finance_categories(id int PRIMARY KEY,sort_order int NOT NULL DEFAULT 2147483647);
   INSERT INTO club_finance_categories VALUES(1,7),(2,2);`);
  await db.exec(readFileSync('prisma/migrations/20261106020000_finance_category_kind_order/migration.sql','utf8'));
  expect((await db.query('SELECT expense_sort_order,revenue_sort_order FROM club_finance_categories ORDER BY id')).rows).toEqual([{expense_sort_order:7,revenue_sort_order:7},{expense_sort_order:2,revenue_sort_order:2}]);
  await db.exec('UPDATE club_finance_categories SET expense_sort_order=0 WHERE id=1; INSERT INTO club_finance_categories(id) VALUES(3);');
  expect((await db.query('SELECT sort_order,expense_sort_order,revenue_sort_order FROM club_finance_categories WHERE id=1')).rows).toEqual([{sort_order:7,expense_sort_order:0,revenue_sort_order:7}]);
  expect((await db.query('SELECT expense_sort_order,revenue_sort_order FROM club_finance_categories WHERE id=3')).rows).toEqual([{expense_sort_order:2147483647,revenue_sort_order:2147483647}]);
 } finally {await db.close();}
},20000);
