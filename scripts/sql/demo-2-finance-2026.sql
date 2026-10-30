-- Demo 2 only. Run in a transaction. Re-runnable; preserves existing records.
DO $$
DECLARE target uuid := '4fed63dd-fbe2-42e8-a8bc-c7036496a3e5';
BEGIN
 IF NOT EXISTS (SELECT 1 FROM clubs WHERE id=target AND name='Demo 2' AND payment_workflow='calendar_month') THEN
  RAISE EXCEPTION 'Expected Demo 2 with calendar-month billing';
 END IF;
 PERFORM pg_advisory_xact_lock(hashtext(target::text));
 UPDATE clubs SET finance_started_at=LEAST(finance_started_at, '2026-01-01 00:00:00+02'::timestamptz) WHERE id=target;
 INSERT INTO club_finance_categories(club_id,name)
 VALUES(target,'Спонсорство'),(target,'Дарения')
 ON CONFLICT (club_id,name) DO NOTHING;

 INSERT INTO club_finance_entries(id,club_id,category_id,kind,amount,currency,occurred_at,description)
 SELECT md5(target::text || ':demo2026:' || m || ':' || v.name)::uuid,
 target,c.id,v.kind,(v.base + m*v.step)::numeric(10,2),'EUR',
 (make_date(2026,m,v.day)::timestamp + interval '12 hours') AT TIME ZONE 'Europe/Sofia',
 '[DEMO 2026] ' || v.name || ' — ' || to_char(make_date(2026,m,1),'YYYY-MM')
 FROM generate_series(1,12) m
 CROSS JOIN (VALUES
 ('Спонсорство','revenue',850,25,3),('Дарения','revenue',120,12,14),
 ('Наем на терени','expense',300,5,5),('Заплати','expense',450,10,25),
 ('Транспорт и гориво','expense',85,7,12),('Консумативи','expense',25,3,18),
 ('Мачове','expense',65,5,21),('Храна','expense',45,4,23)
 ) v(name,kind,base,step,day)
 JOIN club_finance_categories c ON c.club_id=target AND c.name=v.name
 ON CONFLICT(id) DO NOTHING;

 -- Give the seven demo players different paid-through months (June–October).
 UPDATE players SET first_billing_month='2026-01-01 00:00:00+00',updated_at=now()
 WHERE club_id=target AND is_active AND (first_billing_month IS NULL OR first_billing_month>'2026-01-01 00:00:00+00');
 INSERT INTO payment_logs(id,player_id,paid_at,recorded_by,paid_for,amount,currency)
 SELECT md5(p.id::text || ':demo2026:payment:' || m)::uuid,p.id,
 (make_date(2026,m,8)::timestamp + interval '12 hours') AT TIME ZONE 'Europe/Sofia',
 'demo-seed-2026',make_date(2026,m,1)::timestamp AT TIME ZONE 'UTC',
 COALESCE(NULLIF(p.payment_amount,0),NULLIF(c.default_payment_amount,0),60),'EUR'
 FROM (SELECT *,row_number() OVER(ORDER BY full_name,id) rn FROM players WHERE club_id=target AND is_active) p
 JOIN clubs c ON c.id=p.club_id
 CROSS JOIN generate_series(1,10) m
 WHERE m<=6+((p.rn-1)%5)
 AND NOT EXISTS(SELECT 1 FROM payment_logs l WHERE l.player_id=p.id AND date_trunc('month',l.paid_for AT TIME ZONE 'UTC')=make_date(2026,m,1)::timestamp)
 AND NOT EXISTS(SELECT 1 FROM payment_waivers w WHERE w.player_id=p.id AND date_trunc('month',w.waived_for AT TIME ZONE 'UTC')=make_date(2026,m,1)::timestamp)
 ON CONFLICT(id) DO NOTHING;
 -- Payment insert trigger records membership revenue; never insert it twice.
 UPDATE players p SET last_payment_date=(SELECT max(l.paid_at) FROM payment_logs l WHERE l.player_id=p.id),
 status=CASE WHEN EXISTS(
 SELECT 1 FROM generate_series('2026-01-01'::timestamp,date_trunc('month',now() AT TIME ZONE 'Europe/Sofia'),interval '1 month') d
 WHERE NOT EXISTS(SELECT 1 FROM payment_logs l WHERE l.player_id=p.id AND date_trunc('month',l.paid_for AT TIME ZONE 'UTC')=d)
 AND NOT EXISTS(SELECT 1 FROM payment_waivers w WHERE w.player_id=p.id AND date_trunc('month',w.waived_for AT TIME ZONE 'UTC')=d)
 ) THEN 'overdue'::player_status ELSE 'paid'::player_status END,updated_at=now()
 WHERE p.club_id=target AND p.is_active;
END $$;
