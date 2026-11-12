-- One-off custom-group sessions have their own scope keys. Keep their
-- upcoming rosters in sync when a coach adds a player to the custom group.
CREATE FUNCTION enroll_player_in_schedule2_sessions() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  enrolled_at timestamptz := clock_timestamp();
BEGIN
  WITH upcoming AS (
    SELECT s.id, s.club_id, s.scope_key, s.training_date, p.id AS player_id,
      p.full_name, p.team_group,
      c.payment_workflow::text IN ('training_credits', 'training_credits_30_days') AS requires_check_in
    FROM players p
    JOIN clubs c ON c.id = p.club_id
    JOIN training_sessions s ON s.club_id = p.club_id AND s.scope_id = NEW.group_id
    WHERE p.id = NEW.player_id AND p.is_active
      AND s.scope_type = 'customGroup' AND s.occurrence_key <> ''
      AND s.status = 'scheduled' AND NOT s.removed_from_schedule AND s.roster_locked_at IS NULL
      AND s.training_date >= (enrolled_at AT TIME ZONE 'Europe/Sofia')::date
      AND (s.training_date + COALESCE(s.training_time, '00:00')::time) AT TIME ZONE 'Europe/Sofia'
        >= GREATEST(enrolled_at, p.attendance_started_at)
    ORDER BY s.id
    FOR NO KEY UPDATE OF s
  )
  INSERT INTO training_session_players (
    id, training_session_id, player_id, player_name, team_group, present, reason_code, updated_at
  )
  SELECT gen_random_uuid(), s.id, s.player_id, s.full_name, s.team_group,
    e.scope_key IS NULL AND NOT s.requires_check_in,
    CASE WHEN e.scope_key IS NOT NULL AND NOT s.requires_check_in THEN 'limited_event' END,
    enrolled_at
  FROM upcoming s
  LEFT JOIN limited_training_events e
    ON e.club_id = s.club_id AND e.scope_key = s.scope_key AND e.training_date = s.training_date
  ON CONFLICT (training_session_id, player_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER enroll_player_in_schedule2_sessions
AFTER INSERT ON club_custom_training_group_players
FOR EACH ROW EXECUTE FUNCTION enroll_player_in_schedule2_sessions();
