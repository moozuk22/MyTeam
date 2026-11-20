BEGIN;
LOCK TABLE training_microcycles IN SHARE ROW EXCLUSIVE MODE;
-- Abort before changing stored data if a cycle has an unknown row format.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM training_microcycles
    WHERE jsonb_typeof(content->'rows') IS DISTINCT FROM 'array'
  ) OR EXISTS (
    SELECT 1 FROM training_microcycles c, jsonb_array_elements(c.content->'rows') r
    WHERE CASE WHEN jsonb_typeof(r) = 'array' THEN
      jsonb_array_length(r) <> 5 OR EXISTS (
        SELECT 1 FROM jsonb_array_elements(r) cell WHERE jsonb_typeof(cell) <> 'string'
      )
    ELSE true END
  ) THEN
    RAISE EXCEPTION 'Unexpected training microcycle row format';
  END IF;
END $$;
UPDATE training_microcycles c
SET content = jsonb_set(c.content, '{rows}', COALESCE((
  SELECT jsonb_agg(jsonb_build_object('id', gen_random_uuid(), 'cells', cells) ORDER BY n)
  FROM jsonb_array_elements(c.content->'rows') WITH ORDINALITY AS r(cells, n)
), '[]'::jsonb)) || '{"version":2}'::jsonb,
revision = revision + 1;

ALTER TABLE training_microcycles ADD CONSTRAINT training_microcycle_version
  CHECK ((content->>'version' = '2') IS TRUE);
ALTER TABLE training_microcycles ADD UNIQUE (id, club_id);
ALTER TABLE training_plan_documents ADD COLUMN origin_key TEXT;
CREATE TABLE training_session_documents (
  cycle_id UUID NOT NULL,
  club_id UUID NOT NULL,
  group_key TEXT NOT NULL,
  row_id UUID NOT NULL,
  document_id UUID NOT NULL UNIQUE,
  PRIMARY KEY (cycle_id, group_key, row_id),
  UNIQUE (document_id, club_id),
  FOREIGN KEY (cycle_id, club_id) REFERENCES training_microcycles(id, club_id) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (document_id, club_id) REFERENCES training_plan_documents(id, club_id) ON DELETE CASCADE ON UPDATE CASCADE
);
COMMIT;
