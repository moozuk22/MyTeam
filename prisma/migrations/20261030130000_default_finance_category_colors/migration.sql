BEGIN;
-- One-time assignment only: keep colors already chosen by administrators.
WITH uncolored AS (
 SELECT id,row_number() OVER (PARTITION BY club_id ORDER BY random()) AS position
 FROM club_finance_categories WHERE color IS NULL
)
UPDATE club_finance_categories c
SET color=(ARRAY['#E53935','#1E88E5','#43A047','#FB8C00','#8E24AA','#00838F','#C0CA33','#6D4C41','#3949AB','#D81B60','#00796B','#F9A825','#5E35B1','#546E7A','#00ACC1','#212121','#FAFAFA','#800020','#000080','#FF00FF','#00FFFF','#FFFF00','#00FF7F','#7FFF00','#A6A6A6','#004D1A','#FF6347','#7B3F00','#6B6B00','#B57EDC','#F2B6C6','#0099FF','#C8A26A','#4D0033','#141414'])[(1 + (u.position - 1) % 35)::int]
FROM uncolored u WHERE c.id=u.id;

-- Defaults receive stable palette colors; manually created categories stay optional.
CREATE OR REPLACE FUNCTION seed_club_finance_categories(target uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 INSERT INTO club_finance_categories(club_id,name,is_membership,color) VALUES
 (target,'Членски внос',true,'#E53935'),
 (target,'Тренировъчна база',false,'#1E88E5'),
 (target,'Наем на терени',false,'#43A047'),
 (target,'Съдийски такси',false,'#FB8C00'),
 (target,'Консумативи',false,'#8E24AA'),
 (target,'Храна',false,'#00838F'),
 (target,'Транспорт и гориво',false,'#C0CA33'),
 (target,'Картотекиране',false,'#6D4C41'),
 (target,'Реклама',false,'#3949AB'),
 (target,'Тренировъчни пособия',false,'#D81B60'),
 (target,'Заплати',false,'#00796B'),
 (target,'Мачове',false,'#F9A825'),
 (target,'Екипировка',false,'#5E35B1'),
 (target,'Лагери',false,'#546E7A'),
 (target,'Премии',false,'#00ACC1'),
 (target,'Други',false,'#212121');
END $$;
COMMIT;
