-- Permit configuring one billing option without requiring the other two.
-- Preserve every existing scheduled price by expanding it to independent rows.
ALTER TABLE calculator_price_revisions DROP CONSTRAINT calculator_price_revisions_effective_month_key;
ALTER TABLE calculator_price_revisions
 ADD COLUMN billing_mode text,
 ALTER COLUMN monthly DROP NOT NULL,
 ALTER COLUMN yearly DROP NOT NULL,
 ALTER COLUMN lifetime DROP NOT NULL;
UPDATE calculator_price_revisions SET billing_mode='monthly';
INSERT INTO calculator_price_revisions(id,effective_month,billing_mode,monthly,yearly,lifetime,actor_id,created_at)
 SELECT gen_random_uuid(),effective_month,'yearly',NULL,yearly,NULL,actor_id,created_at
 FROM calculator_price_revisions WHERE billing_mode='monthly';
INSERT INTO calculator_price_revisions(id,effective_month,billing_mode,monthly,yearly,lifetime,actor_id,created_at)
 SELECT gen_random_uuid(),effective_month,'lifetime',NULL,NULL,lifetime,actor_id,created_at
 FROM calculator_price_revisions WHERE billing_mode='monthly';
UPDATE calculator_price_revisions SET yearly=NULL,lifetime=NULL WHERE billing_mode='monthly';
ALTER TABLE calculator_price_revisions ALTER COLUMN billing_mode SET NOT NULL;
ALTER TABLE calculator_price_revisions ADD CONSTRAINT calculator_price_revisions_mode_price_check CHECK (
 (billing_mode='monthly' AND monthly IS NOT NULL AND yearly IS NULL AND lifetime IS NULL) OR
 (billing_mode='yearly' AND monthly IS NULL AND yearly IS NOT NULL AND lifetime IS NULL) OR
 (billing_mode='lifetime' AND monthly IS NULL AND yearly IS NULL AND lifetime IS NOT NULL)
);
CREATE UNIQUE INDEX calculator_price_revisions_effective_month_billing_mode_key
 ON calculator_price_revisions(effective_month,billing_mode);
