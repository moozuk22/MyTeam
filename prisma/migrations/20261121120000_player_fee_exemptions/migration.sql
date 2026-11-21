ALTER TABLE players
 ADD COLUMN fee_exempt boolean NOT NULL DEFAULT false,
 ADD CONSTRAINT players_fee_exempt_requires_zero CHECK (NOT fee_exempt OR payment_amount = 0);

CREATE OR REPLACE FUNCTION record_club_finance_revenue() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE target uuid; player_label text; category uuid; launch timestamptz;
BEGIN
 IF NEW.amount = 0 THEN RETURN NEW; END IF;
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

CREATE OR REPLACE FUNCTION backfill_calculator_revenue(target uuid, purchase uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 PERFORM id FROM clubs WHERE id=target FOR UPDATE;
 INSERT INTO club_finance_entries(club_id,category_id,kind,amount,currency,occurred_at,player_name,payment_reference)
 SELECT target,c.id,'revenue',l.amount,l.currency,l.paid_at,p.full_name,l.id
 FROM payment_logs l JOIN players p ON p.id=l.player_id
 JOIN clubs club ON club.id=target
 JOIN club_finance_categories c ON c.club_id=target AND c.is_membership=true
 WHERE l.finance_club_id=target AND l.amount <> 0 AND l.paid_at>=club.finance_started_at
 AND EXISTS(SELECT 1 FROM club_calculator_grants g WHERE g.club_id=target AND g.payment_id=purchase
  AND g.revoked_at IS NULL AND g.starts_at<=l.paid_at AND (g.ends_at IS NULL OR g.ends_at>l.paid_at))
 FOR KEY SHARE OF l
 ON CONFLICT(payment_reference) DO NOTHING;
END $$;
