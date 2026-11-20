BEGIN;
ALTER TABLE training_session_documents
  DROP CONSTRAINT training_session_documents_document_id_key,
  DROP CONSTRAINT training_session_documents_document_id_club_id_key;
CREATE INDEX training_session_documents_document_id_club_id_idx
  ON training_session_documents(document_id, club_id);
COMMIT;
