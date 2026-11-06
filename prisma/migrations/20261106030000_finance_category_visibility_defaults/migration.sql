BEGIN;

-- Adjust only defaults that still have the original visible-for-both setting.
-- Explicitly scoped or fully hidden categories retain their current visibility.
-- Names identify the standard non-membership categories; custom names are untouched.
UPDATE club_finance_categories
SET hidden_for_revenue = true
WHERE is_active AND NOT hidden_for_expense AND NOT hidden_for_revenue
  AND NOT is_membership
  AND name IN ('Тренировъчна база','Наем на терени','Съдийски такси','Консумативи','Храна','Транспорт и гориво','Картотекиране','Реклама','Тренировъчни пособия','Заплати');

UPDATE club_finance_categories
SET hidden_for_expense = true
WHERE is_membership AND is_active
  AND NOT hidden_for_expense AND NOT hidden_for_revenue;

-- This function is invoked by the existing new-club trigger.
-- Keep the category names, colors, IDs, and independent ordering behavior unchanged.
CREATE OR REPLACE FUNCTION seed_club_finance_categories(target uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 INSERT INTO club_finance_categories(club_id,name,is_membership,color,hidden_for_expense,hidden_for_revenue) VALUES
 (target,'Членски внос',true,'#E53935',true,false),
 (target,'Тренировъчна база',false,'#1E88E5',false,true),
 (target,'Наем на терени',false,'#43A047',false,true),
 (target,'Съдийски такси',false,'#FB8C00',false,true),
 (target,'Консумативи',false,'#8E24AA',false,true),
 (target,'Храна',false,'#00838F',false,true),
 (target,'Транспорт и гориво',false,'#C0CA33',false,true),
 (target,'Картотекиране',false,'#6D4C41',false,true),
 (target,'Реклама',false,'#3949AB',false,true),
 (target,'Тренировъчни пособия',false,'#D81B60',false,true),
 (target,'Заплати',false,'#00796B',false,true),
 (target,'Мачове',false,'#F9A825',false,false),
 (target,'Екипировка',false,'#5E35B1',false,false),
 (target,'Лагери',false,'#546E7A',false,false),
 (target,'Премии',false,'#00ACC1',false,false),
 (target,'Други',false,'#212121',false,false);
END $$;

COMMIT;
