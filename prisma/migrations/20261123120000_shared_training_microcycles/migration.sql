BEGIN;
LOCK TABLE training_microcycles IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE training_session_documents IN SHARE ROW EXCLUSIVE MODE;

-- Several groups of the same week can use one microcycle.
ALTER TABLE training_microcycles ADD UNIQUE (id, club_id, week);
CREATE TABLE training_microcycle_groups (
  cycle_id UUID NOT NULL,
  club_id UUID NOT NULL,
  group_key TEXT NOT NULL,
  group_name TEXT NOT NULL,
  week TEXT NOT NULL,
  PRIMARY KEY (club_id, group_key, week),
  UNIQUE (cycle_id, group_key),
  FOREIGN KEY (cycle_id, club_id, week) REFERENCES training_microcycles(id, club_id, week) ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO training_microcycle_groups (cycle_id, club_id, group_key, group_name, week)
SELECT id, club_id, group_key, group_name, week FROM training_microcycles;

-- A link of a group that does not use the microcycle cannot be opened. Each link must belong to a group of the microcycle.
DELETE FROM training_session_documents l
WHERE NOT EXISTS (SELECT 1 FROM training_microcycle_groups g WHERE g.cycle_id = l.cycle_id AND g.group_key = l.group_key);
ALTER TABLE training_session_documents ADD CONSTRAINT training_session_documents_cycle_id_group_key_fkey
  FOREIGN KEY (cycle_id, group_key) REFERENCES training_microcycle_groups(cycle_id, group_key) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE training_microcycles DROP COLUMN group_key, DROP COLUMN group_name;
CREATE INDEX training_microcycles_club_id_week_idx ON training_microcycles(club_id, week);
COMMIT;
