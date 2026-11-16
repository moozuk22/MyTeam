ALTER TABLE players ADD COLUMN report_activity jsonb;
ALTER TABLE players ADD COLUMN report_include_removal_month boolean NOT NULL DEFAULT true;
-- Past inactive dates are unknown. Do not infer them from updated_at.
UPDATE players SET report_activity=jsonb_build_array(jsonb_build_object(
 'from',to_char(COALESCE(first_billing_month,created_at) AT TIME ZONE 'Europe/Sofia','YYYY-MM'),'until',NULL))
WHERE is_active;

CREATE FUNCTION track_player_report_activity() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE current_month text := to_char(CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Sofia','YYYY-MM'); cutoff text;
BEGIN
 IF TG_OP='INSERT' THEN
  NEW.report_activity := CASE WHEN NEW.is_active THEN jsonb_build_array(jsonb_build_object(
   'from',to_char(COALESCE(NEW.first_billing_month,NEW.created_at) AT TIME ZONE 'Europe/Sofia','YYYY-MM'),'until',NULL)) ELSE NULL END;
 ELSIF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
  IF NEW.is_active THEN
   IF OLD.report_activity IS NULL THEN
    SELECT jsonb_agg(jsonb_build_object('from',to_char(period,'YYYY-MM'),'until',to_char(period+interval '1 month','YYYY-MM')))
     INTO NEW.report_activity FROM (SELECT DISTINCT date_trunc('month',paid_for AT TIME ZONE 'UTC') period FROM payment_logs WHERE player_id=OLD.id) paid;
   ELSE NEW.report_activity := OLD.report_activity;
   END IF;
   NEW.report_activity := COALESCE(NEW.report_activity,'[]'::jsonb) || jsonb_build_array(jsonb_build_object('from',current_month,'until',NULL));
  ELSE
   cutoff := CASE WHEN NEW.report_include_removal_month THEN to_char((CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Sofia')+interval '1 month','YYYY-MM') ELSE current_month END;
   SELECT jsonb_agg(CASE WHEN item->>'until' IS NULL OR item->>'until'>cutoff THEN jsonb_set(item,'{until}',to_jsonb(cutoff)) ELSE item END)
    INTO NEW.report_activity FROM jsonb_array_elements(OLD.report_activity) item;
  END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER track_player_report_activity BEFORE INSERT OR UPDATE OF is_active ON players
 FOR EACH ROW EXECUTE FUNCTION track_player_report_activity();

CREATE TABLE player_report_archives (
 id uuid PRIMARY KEY,
 club_id uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
 coach_group_ids uuid[] NOT NULL DEFAULT '{}',
 custom_group_ids uuid[] NOT NULL DEFAULT '{}',
 report jsonb NOT NULL,
 deleted_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX player_report_archives_club_id_idx ON player_report_archives(club_id);

-- Snapshot before foreign-key cascades remove payment and group records.
-- No player foreign key: the club owns this report history.
CREATE FUNCTION archive_player_report() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE activity jsonb := OLD.report_activity;
BEGIN
 -- Club deletion removes its archives as well. Do not recreate them in its cascade.
 IF NOT EXISTS(SELECT 1 FROM clubs WHERE id=OLD.club_id) THEN RETURN OLD; END IF;
 IF OLD.is_active THEN
  SELECT jsonb_agg(CASE WHEN item->>'until' IS NULL THEN jsonb_set(item,'{until}',
   to_jsonb(to_char((CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Sofia')+interval '1 month','YYYY-MM'))) ELSE item END)
   INTO activity FROM jsonb_array_elements(activity) item;
 END IF;
 INSERT INTO player_report_archives(id,club_id,coach_group_ids,custom_group_ids,report)
 SELECT OLD.id,OLD.club_id,
  ARRAY(SELECT "A" FROM "_PlayerCoachGroups" WHERE "B"=OLD.id),
  ARRAY(SELECT group_id FROM club_custom_training_group_players WHERE player_id=OLD.id),
  jsonb_build_object('id',OLD.id,'fullName',OLD.full_name,'teamGroup',OLD.team_group,
   'isActive',false,'isDeleted',true,'reportActivity',activity,'paymentAmount',NULL,
   'firstBillingMonth',OLD.first_billing_month,'paymentWorkflow',c.payment_workflow,
   'paymentLogs',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',l.id,'paidFor',l.paid_for,'paidAt',l.paid_at,'amount',l.amount::text,'currency',l.currency)) FROM payment_logs l WHERE l.player_id=OLD.id),'[]'::jsonb),
   'paymentWaivers',COALESCE((SELECT jsonb_agg(jsonb_build_object('waivedFor',w.waived_for)) FROM payment_waivers w WHERE w.player_id=OLD.id),'[]'::jsonb))
 FROM clubs c WHERE c.id=OLD.club_id;
 RETURN OLD;
END $$;
CREATE TRIGGER archive_player_report BEFORE DELETE ON players FOR EACH ROW EXECUTE FUNCTION archive_player_report();
