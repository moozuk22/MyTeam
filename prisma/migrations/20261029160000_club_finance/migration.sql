-- Financial history belongs to the club independently of player lifecycle.
ALTER TABLE clubs ADD COLUMN finance_started_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP;
CREATE TABLE club_finance_categories (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 club_id uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
 name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 100),
 kind text NOT NULL CHECK (kind IN ('revenue','expense')),
 UNIQUE(club_id, kind, name),
 UNIQUE(id, club_id)
);
CREATE TABLE club_finance_entries (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 club_id uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
 category_id uuid NOT NULL,
 kind text NOT NULL CHECK (kind IN ('revenue','expense')),
 amount numeric(10,2) NOT NULL CHECK (amount >= 0),
 currency text NOT NULL DEFAULT 'EUR' CHECK (currency ~ '^[A-Z]{3}$'),
 occurred_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
 description text,
 player_name text,
 payment_reference uuid UNIQUE,
 created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
 voided_at timestamptz,
 FOREIGN KEY(category_id, club_id) REFERENCES club_finance_categories(id, club_id),
 CHECK ((kind = 'revenue' AND payment_reference IS NOT NULL) OR (kind = 'expense' AND payment_reference IS NULL AND amount > 0))
);
CREATE INDEX club_finance_entries_period ON club_finance_entries(club_id, occurred_at);
CREATE FUNCTION seed_club_finance_categories(target uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 INSERT INTO club_finance_categories(club_id,name,kind) VALUES(target,'Членски внос','revenue');
 INSERT INTO club_finance_categories(club_id,name,kind)
 SELECT target, name, 'expense' FROM unnest(ARRAY['Тренировъчна база','Наем на терени','Съдийски такси','Консумативи','Храна','Транспорт и гориво','Картотекиране','Реклама','Тренировъчни пособия','Заплати','Мачове','Екипировка','Лагери','Премии','Други']) AS name;
END $$;
SELECT seed_club_finance_categories(id) FROM clubs;
CREATE FUNCTION initialize_club_finance() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 PERFORM seed_club_finance_categories(NEW.id);
 RETURN NEW;
END $$;
CREATE TRIGGER initialize_club_finance AFTER INSERT ON clubs FOR EACH ROW EXECUTE FUNCTION initialize_club_finance();
-- An insert trigger covers all manual/online payment writers atomically.
CREATE FUNCTION record_club_finance_revenue() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE target uuid; player_label text; category uuid; launch timestamptz;
BEGIN
 SELECT p.club_id,p.full_name,c.finance_started_at INTO target,player_label,launch
 FROM players p JOIN clubs c ON c.id=p.club_id WHERE p.id=NEW.player_id;
 IF NEW.paid_at < launch THEN RETURN NEW; END IF;
 IF NEW.amount IS NULL THEN RAISE EXCEPTION 'New player payments require a recorded amount'; END IF;
 SELECT id INTO category FROM club_finance_categories WHERE club_id=target AND kind='revenue';
 INSERT INTO club_finance_entries(club_id,category_id,kind,amount,currency,occurred_at,player_name,payment_reference)
 VALUES(target,category,'revenue',NEW.amount,NEW.currency,NEW.paid_at,player_label,NEW.id);
 RETURN NEW;
END $$;
CREATE TRIGGER record_club_finance_revenue AFTER INSERT ON payment_logs FOR EACH ROW EXECUTE FUNCTION record_club_finance_revenue();

-- Explicit payment undo voids revenue; cascading player deletion preserves it.
CREATE FUNCTION void_club_finance_revenue() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF EXISTS (SELECT 1 FROM players WHERE id=OLD.player_id) THEN
  UPDATE club_finance_entries SET voided_at=CURRENT_TIMESTAMP
  WHERE payment_reference=OLD.id AND kind='revenue' AND voided_at IS NULL;
 END IF;
 RETURN OLD;
END $$;
CREATE TRIGGER void_club_finance_revenue AFTER DELETE ON payment_logs FOR EACH ROW EXECUTE FUNCTION void_club_finance_revenue();
