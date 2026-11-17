BEGIN;

-- A restoration cannot precede the month when tracking was installed.
-- Use that boundary to identify old initial periods without inventing activity
-- for legacy restorations. Same-month histories without provenance stay unchanged.
DO $$
DECLARE tracking_month text := to_char(CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Sofia', 'YYYY-MM');
BEGIN
 IF to_regclass('_prisma_migrations') IS NOT NULL THEN
  EXECUTE 'SELECT to_char(min(started_at) AT TIME ZONE ''Europe/Sofia'', ''YYYY-MM'')
    FROM _prisma_migrations WHERE migration_name = ''20261116230000_player_report_history''
    AND rolled_back_at IS NULL' INTO tracking_month;
  tracking_month := COALESCE(tracking_month, to_char(CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Sofia', 'YYYY-MM'));
 END IF;
 UPDATE players p
 SET report_activity = jsonb_set(
   jsonb_set(p.report_activity, '{0,from}', to_jsonb(to_char(
     COALESCE(p.first_billing_month, p.created_at) AT TIME ZONE 'Europe/Sofia', 'YYYY-MM'))),
   '{0,billingStart}', 'true'::jsonb)
 WHERE jsonb_typeof(p.report_activity) = 'array'
   AND jsonb_array_length(p.report_activity) > 0
   AND p.report_activity->0->>'billingStart' IS NULL
   AND p.report_activity->0->>'from' < tracking_month
   AND NOT EXISTS (
    SELECT 1 FROM payment_logs l WHERE l.player_id = p.id
      AND to_char(l.paid_for AT TIME ZONE 'UTC', 'YYYY-MM') = p.report_activity->0->>'from'
      AND to_char((l.paid_for AT TIME ZONE 'UTC') + interval '1 month', 'YYYY-MM') = p.report_activity->0->>'until'
   );
END $$;

CREATE OR REPLACE FUNCTION track_player_report_activity() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
 current_month text := to_char(CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Sofia', 'YYYY-MM');
 cutoff text;
BEGIN
 IF TG_OP = 'INSERT' THEN
  NEW.report_activity := CASE WHEN NEW.is_active THEN jsonb_build_array(jsonb_build_object(
   'from', to_char(COALESCE(NEW.first_billing_month, NEW.created_at) AT TIME ZONE 'Europe/Sofia', 'YYYY-MM'),
   'until', NULL, 'billingStart', true)) ELSE NULL END;
 ELSE
  NEW.report_activity := OLD.report_activity;
  IF NEW.first_billing_month IS DISTINCT FROM OLD.first_billing_month
     AND jsonb_typeof(OLD.report_activity) = 'array'
     AND jsonb_array_length(OLD.report_activity) > 0
     AND OLD.report_activity->0->>'billingStart' = 'true' THEN
   -- Only the first start can change. Keep every removal and restoration boundary.
   NEW.report_activity := jsonb_set(NEW.report_activity, '{0,from}', to_jsonb(
    to_char(COALESCE(NEW.first_billing_month, NEW.created_at) AT TIME ZONE 'Europe/Sofia', 'YYYY-MM')));
  END IF;
  IF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
   IF NEW.is_active THEN
    IF OLD.report_activity IS NULL THEN
     SELECT jsonb_agg(jsonb_build_object('from', to_char(period, 'YYYY-MM'),
       'until', to_char(period + interval '1 month', 'YYYY-MM')))
      INTO NEW.report_activity FROM (
       SELECT DISTINCT date_trunc('month', paid_for AT TIME ZONE 'UTC') period
       FROM payment_logs WHERE player_id = OLD.id
      ) paid;
    END IF;
    NEW.report_activity := COALESCE(NEW.report_activity, '[]'::jsonb)
     || jsonb_build_array(jsonb_build_object('from', current_month, 'until', NULL));
   ELSE
    cutoff := CASE WHEN NEW.report_include_removal_month
     THEN to_char((CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Sofia') + interval '1 month', 'YYYY-MM')
     ELSE current_month END;
    SELECT jsonb_agg(CASE WHEN item->>'until' IS NULL OR item->>'until' > cutoff
      THEN jsonb_set(item, '{until}', to_jsonb(cutoff)) ELSE item END)
     INTO NEW.report_activity FROM jsonb_array_elements(NEW.report_activity) item;
   END IF;
  END IF;
 END IF;
 RETURN NEW;
END $$;

DROP TRIGGER track_player_report_activity ON players;
CREATE TRIGGER track_player_report_activity
 BEFORE INSERT OR UPDATE OF is_active, first_billing_month ON players
 FOR EACH ROW EXECUTE FUNCTION track_player_report_activity();

COMMIT;
