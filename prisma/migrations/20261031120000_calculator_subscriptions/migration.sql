CREATE TABLE calculator_price_revisions (
 revision serial NOT NULL UNIQUE,
 id uuid PRIMARY KEY, effective_month varchar(7) NOT NULL UNIQUE,
 monthly numeric(10,2) NOT NULL CHECK(monthly>0), yearly numeric(10,2) NOT NULL CHECK(yearly>0), lifetime numeric(10,2) NOT NULL CHECK(lifetime>0),
 actor_id text NOT NULL, created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE club_calculator_subscriptions (
 club_id uuid PRIMARY KEY REFERENCES clubs(id) ON DELETE CASCADE,
 free_enabled boolean NOT NULL DEFAULT false, billing_mode text NOT NULL DEFAULT 'monthly' CHECK(billing_mode IN ('monthly','yearly','lifetime')), version integer NOT NULL DEFAULT 1
);
CREATE TABLE club_calculator_prices (
 id uuid PRIMARY KEY, club_id uuid NOT NULL REFERENCES club_calculator_subscriptions(club_id) ON DELETE CASCADE,
 billing_mode text NOT NULL CHECK(billing_mode IN ('monthly','yearly','lifetime')), effective_month varchar(7) NOT NULL, amount numeric(10,2) CHECK(amount>0), UNIQUE(club_id,billing_mode,effective_month)
);
CREATE TABLE club_calculator_payments (
 id uuid PRIMARY KEY, club_id uuid NOT NULL REFERENCES club_calculator_subscriptions(club_id) ON DELETE CASCADE,
 billing_mode text NOT NULL CHECK(billing_mode IN ('monthly','yearly','lifetime')), paid_on varchar(10) NOT NULL,
 note text, total numeric(14,2) NOT NULL CHECK(total>0), request jsonb NOT NULL,
 created_by text NOT NULL, created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP, voided_at timestamptz, voided_by text
);
CREATE INDEX club_calculator_payments_club_id_created_at_idx ON club_calculator_payments(club_id,created_at);
CREATE TABLE club_calculator_grants (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), club_id uuid NOT NULL REFERENCES club_calculator_subscriptions(club_id) ON DELETE CASCADE,
 kind text NOT NULL CHECK(kind IN ('paid','trial','contract')), starts_at timestamptz NOT NULL, ends_at timestamptz,
 revoked_at timestamptz, payment_id uuid REFERENCES club_calculator_payments(id) ON DELETE CASCADE, amount numeric(10,2),
 CHECK(ends_at IS NULL OR ends_at>=starts_at), CHECK((kind='paid')=(payment_id IS NOT NULL))
);
CREATE INDEX club_calculator_grants_club_id_starts_at_idx ON club_calculator_grants(club_id,starts_at);
CREATE TABLE club_calculator_changes (
 id uuid PRIMARY KEY, club_id uuid NOT NULL REFERENCES club_calculator_subscriptions(club_id) ON DELETE CASCADE,
 actor_id text NOT NULL, action text NOT NULL, details jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX club_calculator_changes_club_id_created_at_idx ON club_calculator_changes(club_id,created_at);

-- Snapshot ownership of payments even when capture is disabled. Otherwise moving a
-- player before reactivation could backfill revenue into the wrong club.
ALTER TABLE payment_logs ADD COLUMN finance_club_id uuid;
UPDATE payment_logs l SET finance_club_id=p.club_id FROM players p WHERE p.id=l.player_id;
CREATE FUNCTION remember_finance_payment_club() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 SELECT club_id INTO NEW.finance_club_id FROM players WHERE id=NEW.player_id;
 RETURN NEW;
END $$;
CREATE TRIGGER remember_finance_payment_club BEFORE INSERT ON payment_logs FOR EACH ROW EXECUTE FUNCTION remember_finance_payment_club();
CREATE INDEX payment_logs_finance_club_period ON payment_logs(finance_club_id,paid_at);

-- VOLATILE deliberately obtains fresh snapshots after the shared club lock.
CREATE FUNCTION calculator_enabled_at(target uuid, moment timestamptz) RETURNS boolean LANGUAGE sql VOLATILE AS $$
 SELECT EXISTS(SELECT 1 FROM club_calculator_grants WHERE club_id=target AND revoked_at IS NULL
 AND starts_at<=moment AND (ends_at IS NULL OR ends_at>moment))
$$;
CREATE OR REPLACE FUNCTION record_club_finance_revenue() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE target uuid; player_label text; category uuid; launch timestamptz;
BEGIN
 target := NEW.finance_club_id;
 SELECT finance_started_at INTO launch FROM clubs WHERE id=target FOR UPDATE;
 IF NEW.amount IS NULL THEN RAISE EXCEPTION 'New player payments require a recorded amount'; END IF;
 IF NEW.paid_at<launch OR NOT calculator_enabled_at(target,clock_timestamp()) OR NOT calculator_enabled_at(target,NEW.paid_at) THEN RETURN NEW; END IF;
 SELECT full_name INTO player_label FROM players WHERE id=NEW.player_id;
 SELECT id INTO category FROM club_finance_categories WHERE club_id=target AND is_membership=true;
 INSERT INTO club_finance_entries(club_id,category_id,kind,amount,currency,occurred_at,player_name,payment_reference)
 VALUES(target,category,'revenue',NEW.amount,NEW.currency,NEW.paid_at,player_label,NEW.id)
 ON CONFLICT(payment_reference) DO NOTHING;
 RETURN NEW;
END $$;
CREATE FUNCTION backfill_calculator_revenue(target uuid, purchase uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 PERFORM id FROM clubs WHERE id=target FOR UPDATE;
 INSERT INTO club_finance_entries(club_id,category_id,kind,amount,currency,occurred_at,player_name,payment_reference)
 SELECT target,c.id,'revenue',l.amount,l.currency,l.paid_at,p.full_name,l.id
 FROM payment_logs l JOIN players p ON p.id=l.player_id
 JOIN clubs club ON club.id=target
 JOIN club_finance_categories c ON c.club_id=target AND c.is_membership=true
 WHERE l.finance_club_id=target AND l.amount IS NOT NULL AND l.paid_at>=club.finance_started_at
 AND EXISTS(SELECT 1 FROM club_calculator_grants g WHERE g.club_id=target AND g.payment_id=purchase
  AND g.revoked_at IS NULL AND g.starts_at<=l.paid_at AND (g.ends_at IS NULL OR g.ends_at>l.paid_at))
 ON CONFLICT(payment_reference) DO NOTHING;
END $$;

-- Also enforce date eligibility for manual writes outside the finance API.
CREATE FUNCTION guard_calculator_entry_date() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.payment_reference IS NOT NULL THEN RETURN NEW; END IF;
 IF TG_OP='UPDATE' THEN
  IF NEW.occurred_at=OLD.occurred_at AND NEW.club_id=OLD.club_id THEN RETURN NEW; END IF;
 END IF;
 PERFORM id FROM clubs WHERE id=NEW.club_id FOR UPDATE;
 -- Manual dates represent whole Sofia dates; grants can begin during a day.
 IF NOT EXISTS(SELECT 1 FROM club_calculator_grants g WHERE g.club_id=NEW.club_id AND g.revoked_at IS NULL
  AND g.starts_at < (((NEW.occurred_at AT TIME ZONE 'Europe/Sofia')::date+1)::timestamp AT TIME ZONE 'Europe/Sofia')
  AND (g.ends_at IS NULL OR g.ends_at>NEW.occurred_at)) THEN
  RAISE EXCEPTION 'CALCULATOR_INACTIVE_DATE' USING ERRCODE='P0001';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_calculator_entry_date BEFORE INSERT OR UPDATE OF occurred_at,club_id ON club_finance_entries
 FOR EACH ROW EXECUTE FUNCTION guard_calculator_entry_date();

-- Follow trial edits/conversion atomically, retaining elapsed grant history.
CREATE FUNCTION sync_calculator_trial() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE desired_end timestamptz; current_grant record; moment timestamptz := clock_timestamp();
BEGIN
 SELECT * INTO current_grant FROM club_calculator_grants WHERE club_id=NEW.club_id AND kind='trial' AND revoked_at IS NULL
 ORDER BY starts_at DESC LIMIT 1;
 IF NOT FOUND THEN RETURN NEW; END IF;
 UPDATE club_calculator_subscriptions SET version=version+1 WHERE club_id=NEW.club_id;
 IF NEW.mode='trial' AND EXISTS(SELECT 1 FROM club_calculator_subscriptions WHERE club_id=NEW.club_id AND free_enabled) THEN
  desired_end := CASE WHEN NEW.trial_end_date IS NULL THEN NULL ELSE ((NEW.trial_end_date::date+1)::timestamp AT TIME ZONE 'Europe/Sofia') END;
  IF current_grant.ends_at IS NULL OR current_grant.ends_at>moment THEN
   UPDATE club_calculator_grants SET ends_at=GREATEST(starts_at,desired_end) WHERE id=current_grant.id;
   -- GREATEST ignores null in PostgreSQL; explicitly preserve unlimited trials.
   IF desired_end IS NULL THEN UPDATE club_calculator_grants SET ends_at=NULL WHERE id=current_grant.id; END IF;
  ELSIF desired_end IS NULL OR desired_end>moment THEN
   INSERT INTO club_calculator_grants(club_id,kind,starts_at,ends_at) VALUES(NEW.club_id,'trial',moment,desired_end);
  END IF;
 ELSE
  UPDATE club_calculator_subscriptions SET free_enabled=false WHERE club_id=NEW.club_id;
  UPDATE club_calculator_grants SET ends_at=GREATEST(starts_at,LEAST(COALESCE(ends_at,moment),moment))
   WHERE club_id=NEW.club_id AND kind='trial' AND revoked_at IS NULL;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER sync_calculator_trial AFTER UPDATE OF mode,trial_end_date ON club_subscriptions FOR EACH ROW
 WHEN (OLD.mode IS DISTINCT FROM NEW.mode OR OLD.trial_end_date IS DISTINCT FROM NEW.trial_end_date)
 EXECUTE FUNCTION sync_calculator_trial();
