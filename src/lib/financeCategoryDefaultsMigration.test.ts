import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';

const expenseOnly=['Тренировъчна база','Наем на терени','Съдийски такси','Консумативи','Храна','Транспорт и гориво','Картотекиране','Реклама','Тренировъчни пособия','Заплати'];
const both=['Мачове','Екипировка','Лагери','Премии','Други'];
const migration=readFileSync('prisma/migrations/20261106030000_finance_category_visibility_defaults/migration.sql','utf8');
it('updates untouched defaults, preserves custom settings and history, and seeds future clubs consistently',async()=>{
 const db=new PGlite();
 const club='00000000-0000-0000-0000-000000000001';
 const nextClub='00000000-0000-0000-0000-000000000002';
 try {
  await db.exec(`CREATE TABLE clubs(id uuid PRIMARY KEY);
   CREATE TABLE club_finance_categories(
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),club_id uuid REFERENCES clubs(id),name text NOT NULL,
    is_membership boolean NOT NULL DEFAULT false,color text,is_active boolean NOT NULL DEFAULT true,
    hidden_for_expense boolean NOT NULL DEFAULT false,hidden_for_revenue boolean NOT NULL DEFAULT false,
    sort_order int NOT NULL DEFAULT 2147483647,expense_sort_order int NOT NULL DEFAULT 2147483647,revenue_sort_order int NOT NULL DEFAULT 2147483647,
    UNIQUE(club_id,name));
   CREATE TABLE club_finance_entries(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),category_id uuid REFERENCES club_finance_categories(id),amount numeric);`);
  await db.exec(readFileSync('prisma/migrations/20261030130000_default_finance_category_colors/migration.sql','utf8'));
  await db.exec(`CREATE FUNCTION seed_new_club() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN PERFORM seed_club_finance_categories(NEW.id); RETURN NEW; END $$;
   CREATE TRIGGER seed_categories AFTER INSERT ON clubs FOR EACH ROW EXECUTE FUNCTION seed_new_club();
   INSERT INTO clubs VALUES('${club}');
   UPDATE club_finance_categories SET hidden_for_expense=true WHERE name='Заплати';
   UPDATE club_finance_categories SET hidden_for_expense=true,hidden_for_revenue=true,is_active=false WHERE name='Тренировъчна база';
   UPDATE club_finance_categories SET hidden_for_revenue=true WHERE name='Наем на терени';
   UPDATE club_finance_categories SET name='Моите членски такси' WHERE is_membership;
   UPDATE club_finance_categories SET color='#A6A6A6',sort_order=7,expense_sort_order=3,revenue_sort_order=5 WHERE name='Храна';
   INSERT INTO club_finance_categories(club_id,name) VALUES('${club}','Дарения');
   INSERT INTO club_finance_entries(category_id,amount) SELECT id,125 FROM club_finance_categories WHERE name IN ('Храна','Заплати');`);
  const before=(await db.query('SELECT id,club_id,name,color,is_active,sort_order,expense_sort_order,revenue_sort_order FROM club_finance_categories ORDER BY id')).rows;
  const entries=(await db.query('SELECT * FROM club_finance_entries ORDER BY id')).rows;
  await db.exec(migration);
  expect((await db.query('SELECT id,club_id,name,color,is_active,sort_order,expense_sort_order,revenue_sort_order FROM club_finance_categories ORDER BY id')).rows).toEqual(before);
  expect((await db.query('SELECT * FROM club_finance_entries ORDER BY id')).rows).toEqual(entries);
  const current=(await db.query<{name:string;hidden_for_expense:boolean;hidden_for_revenue:boolean}>('SELECT name,hidden_for_expense,hidden_for_revenue FROM club_finance_categories')).rows;
  expect(current.find(c=>c.name==='Храна')).toMatchObject({hidden_for_expense:false,hidden_for_revenue:true});
  expect(current.find(c=>c.name==='Заплати')).toMatchObject({hidden_for_expense:true,hidden_for_revenue:false});
  expect(current.find(c=>c.name==='Тренировъчна база')).toMatchObject({hidden_for_expense:true,hidden_for_revenue:true});
  expect(current.find(c=>c.name==='Моите членски такси')).toMatchObject({hidden_for_expense:true,hidden_for_revenue:false});
  expect(current.find(c=>c.name==='Дарения')).toMatchObject({hidden_for_expense:false,hidden_for_revenue:false});
  // Re-running the data update does not reset any category's resulting visibility.
  await db.exec(migration);
  expect((await db.query('SELECT name,hidden_for_expense,hidden_for_revenue FROM club_finance_categories')).rows).toEqual(current);
  await db.exec(`INSERT INTO clubs VALUES('${nextClub}')`);
  const seeded=(await db.query<{name:string;hidden_for_expense:boolean;hidden_for_revenue:boolean;is_active:boolean}>(`SELECT name,hidden_for_expense,hidden_for_revenue,is_active FROM club_finance_categories WHERE club_id='${nextClub}'`)).rows;
  expect(seeded).toHaveLength(16);
  for (const name of expenseOnly) expect(seeded.find(c=>c.name===name)).toMatchObject({hidden_for_expense:false,hidden_for_revenue:true,is_active:true});
  for (const name of both) expect(seeded.find(c=>c.name===name)).toMatchObject({hidden_for_expense:false,hidden_for_revenue:false,is_active:true});
  expect(seeded.find(c=>c.name==='Членски внос')).toMatchObject({hidden_for_expense:true,hidden_for_revenue:false,is_active:true});
 } finally {await db.close();}
},20000);
