ALTER TABLE "club_finance_categories" ADD COLUMN "sort_order" INTEGER NOT NULL DEFAULT 2147483647;
WITH ranked AS (
 SELECT id, (row_number() OVER (PARTITION BY club_id, kind ORDER BY name, id) - 1)::integer AS position
 FROM club_finance_categories
)
UPDATE club_finance_categories AS category SET sort_order = ranked.position FROM ranked WHERE category.id = ranked.id;
