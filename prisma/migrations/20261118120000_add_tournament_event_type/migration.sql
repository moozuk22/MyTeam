ALTER TABLE "club_matches"
  DROP CONSTRAINT "club_matches_event_type_check",
  ADD CONSTRAINT "club_matches_event_type_check"
    CHECK ("event_type" IN ('match', 'duel', 'competition', 'participation', 'tournament'));
