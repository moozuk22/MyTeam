BEGIN;
LOCK TABLE club_finance_categories, club_finance_entries IN SHARE ROW EXCLUSIVE MODE;
-- Keep membership-category IDs stable and reconnect both kinds of entry before merging names.
CREATE TEMP TABLE finance_category_merge ON COMMIT DROP AS
SELECT id, first_value(id) OVER (
 PARTITION BY club_id,name ORDER BY is_membership DESC,sort_order,id
) AS keep_id FROM club_finance_categories;
UPDATE club_finance_entries e SET category_id=m.keep_id
FROM finance_category_merge m WHERE e.category_id=m.id AND m.id<>m.keep_id;
WITH merged AS (
 SELECT m.keep_id,bool_or(c.is_active) AS is_active,min(c.sort_order) AS sort_order
 FROM finance_category_merge m JOIN club_finance_categories c ON c.id=m.id GROUP BY m.keep_id
)
UPDATE club_finance_categories c SET is_active=m.is_active,sort_order=m.sort_order
FROM merged m WHERE c.id=m.keep_id;
DELETE FROM club_finance_categories c USING finance_category_merge m WHERE c.id=m.id AND m.id<>m.keep_id;
ALTER TABLE club_finance_categories DROP COLUMN kind;
ALTER TABLE club_finance_categories ADD CONSTRAINT club_finance_categories_club_id_name_key UNIQUE(club_id,name);
WITH ranked AS (
 SELECT id,(row_number() OVER(PARTITION BY club_id ORDER BY sort_order,name,id)-1)::int position
 FROM club_finance_categories
)
UPDATE club_finance_categories c SET sort_order=r.position FROM ranked r WHERE c.id=r.id;
CREATE OR REPLACE FUNCTION seed_club_finance_categories(target uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 INSERT INTO club_finance_categories(club_id,name,is_membership) VALUES(target,'Членски внос',true);
 INSERT INTO club_finance_categories(club_id,name)
 SELECT target,name FROM unnest(ARRAY['Тренировъчна база','Наем на терени','Съдийски такси','Консумативи','Храна','Транспорт и гориво','Картотекиране','Реклама','Тренировъчни пособия','Заплати','Мачове','Екипировка','Лагери','Премии','Други']) AS name;
END $$;
COMMIT;
