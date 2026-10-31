-- Preserve the original membership category even after renaming or adding revenue categories.
ALTER TABLE club_finance_categories ADD COLUMN is_membership boolean NOT NULL DEFAULT false;
UPDATE club_finance_categories SET is_membership=true WHERE kind='revenue';
CREATE UNIQUE INDEX club_finance_membership_category ON club_finance_categories(club_id) WHERE is_membership;
ALTER TABLE club_finance_entries DROP CONSTRAINT club_finance_entries_check;
ALTER TABLE club_finance_entries ADD CONSTRAINT club_finance_entries_source_check CHECK (
 (payment_reference IS NOT NULL AND kind='revenue') OR
 (payment_reference IS NULL AND amount > 0)
);
CREATE OR REPLACE FUNCTION seed_club_finance_categories(target uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 INSERT INTO club_finance_categories(club_id,name,kind,is_membership) VALUES(target,'Членски внос','revenue',true);
 INSERT INTO club_finance_categories(club_id,name,kind)
 SELECT target, name, 'expense' FROM unnest(ARRAY['Тренировъчна база','Наем на терени','Съдийски такси','Консумативи','Храна','Транспорт и гориво','Картотекиране','Реклама','Тренировъчни пособия','Заплати','Мачове','Екипировка','Лагери','Премии','Други']) AS name;
END $$;
CREATE OR REPLACE FUNCTION record_club_finance_revenue() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE target uuid; player_label text; category uuid; launch timestamptz;
BEGIN
 SELECT p.club_id,p.full_name,c.finance_started_at INTO target,player_label,launch
 FROM players p JOIN clubs c ON c.id=p.club_id WHERE p.id=NEW.player_id;
 IF NEW.paid_at < launch THEN RETURN NEW; END IF;
 IF NEW.amount IS NULL THEN RAISE EXCEPTION 'New player payments require a recorded amount'; END IF;
 SELECT id INTO category FROM club_finance_categories WHERE club_id=target AND is_membership=true;
 INSERT INTO club_finance_entries(club_id,category_id,kind,amount,currency,occurred_at,player_name,payment_reference)
 VALUES(target,category,'revenue',NEW.amount,NEW.currency,NEW.paid_at,player_label,NEW.id);
 RETURN NEW;
END $$;
