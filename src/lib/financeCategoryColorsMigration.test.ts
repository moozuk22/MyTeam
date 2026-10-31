import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { CUSTOM_TRAINING_GROUP_COLOR_PALETTE } from './customTrainingGroupColors';

it('colors existing categories, preserves chosen colors and seeds colored defaults while allowing no color', async () => {
 const db = new PGlite();
 try {
  await db.exec(`CREATE TABLE club_finance_categories (
   id uuid DEFAULT gen_random_uuid() PRIMARY KEY, club_id uuid, name text,
   is_membership boolean DEFAULT false, color text
  );
  INSERT INTO club_finance_categories(club_id,name,color) VALUES
  ('00000000-0000-0000-0000-000000000001','Chosen','#43A047'),
  ('00000000-0000-0000-0000-000000000001','Uncolored',NULL),
  ('00000000-0000-0000-0000-000000000001','Another',NULL);`);
  await db.exec(`INSERT INTO club_finance_categories(club_id,name) SELECT '00000000-0000-0000-0000-000000000003', 'Bulk ' || n FROM generate_series(1,40) n;`);
  await db.exec(readFileSync('prisma/migrations/20261030130000_default_finance_category_colors/migration.sql','utf8'));
  await db.exec(readFileSync('prisma/migrations/20261030140000_correct_finance_palette_backfill/migration.sql','utf8'));
  const existing = (await db.query<{name:string;color:string}>('SELECT name,color FROM club_finance_categories')).rows;
  expect(existing.find(c => c.name === 'Chosen')?.color).toBe('#43A047');
  for (const category of existing) expect(CUSTOM_TRAINING_GROUP_COLOR_PALETTE).toContain(category.color);
  expect(new Set(existing.filter(c => c.name === 'Uncolored' || c.name === 'Another').map(c => c.color)).size).toBe(2);
  await db.exec(`SELECT seed_club_finance_categories('00000000-0000-0000-0000-000000000002');`);
  const defaults = (await db.query<{color:string;is_membership:boolean}>(`SELECT color,is_membership FROM club_finance_categories WHERE club_id='00000000-0000-0000-0000-000000000002'`)).rows;
  expect(defaults).toHaveLength(16);
  expect(defaults.filter(c => c.is_membership)).toHaveLength(1);
  expect(new Set(defaults.map(c => c.color)).size).toBe(16);
  for (const category of defaults) expect(CUSTOM_TRAINING_GROUP_COLOR_PALETTE).toContain(category.color);
  await db.exec(`INSERT INTO club_finance_categories(name) VALUES ('Optional'); UPDATE club_finance_categories SET color=NULL WHERE name='Chosen';`);
  expect((await db.query(`SELECT count(*)::int AS n FROM club_finance_categories WHERE color IS NULL`)).rows).toEqual([{n:2}]);
 } finally { await db.close(); }
},20000);
