-- Lock source payment rows until capture commits. A concurrent DELETE must either
-- finish first (so backfill skips it) or run its void trigger after capture is visible.
-- Do not add a club lock to DELETE: it already holds the payment row and would
-- invert the club-then-payment lock order used here.
CREATE OR REPLACE FUNCTION backfill_calculator_revenue(target uuid, purchase uuid) RETURNS void LANGUAGE plpgsql AS $$
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
 FOR KEY SHARE OF l
 ON CONFLICT(payment_reference) DO NOTHING;
END $$;
