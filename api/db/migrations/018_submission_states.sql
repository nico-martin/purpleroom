-- Consolidate retired statuses without changing dates, notes, or ownership.
CREATE TABLE submissions_new (
 id INTEGER PRIMARY KEY,
 owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 paper_id INTEGER REFERENCES papers(id) ON DELETE CASCADE,
 edition_id INTEGER NOT NULL REFERENCES editions(id) ON DELETE CASCADE,
 status TEXT NOT NULL DEFAULT 'interested' CHECK (status IN ('interested','submitted','accepted','rejected','waitlisted','other_talk_chosen','attended')),
 abstract_override TEXT, hide_title INTEGER NOT NULL DEFAULT 0, submitted_on TEXT,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
 updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
 notes TEXT, submitted_timezone TEXT,
 UNIQUE(paper_id,edition_id)
);
INSERT INTO submissions_new(id,owner_id,paper_id,edition_id,status,abstract_override,hide_title,submitted_on,created_at,updated_at,notes,submitted_timezone)
 SELECT id,owner_id,paper_id,edition_id,
  CASE status WHEN 'confirmed' THEN 'accepted' WHEN 'declined' THEN 'rejected' ELSE status END,
  abstract_override,hide_title,submitted_on,created_at,updated_at,notes,submitted_timezone
 FROM submissions;
DROP TABLE submissions;
ALTER TABLE submissions_new RENAME TO submissions;
CREATE INDEX idx_submissions_owner ON submissions(owner_id,edition_id);
CREATE UNIQUE INDEX idx_submissions_unassigned ON submissions(owner_id,edition_id) WHERE paper_id IS NULL;
CREATE TRIGGER submissions_owner_insert BEFORE INSERT ON submissions
 WHEN NEW.paper_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM papers WHERE id=NEW.paper_id AND owner_id=NEW.owner_id)
 BEGIN SELECT RAISE(ABORT,'Submission proposal must belong to its owner'); END;
CREATE TRIGGER submissions_owner_update BEFORE UPDATE OF paper_id,owner_id ON submissions
 WHEN NEW.paper_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM papers WHERE id=NEW.paper_id AND owner_id=NEW.owner_id)
 BEGIN SELECT RAISE(ABORT,'Submission proposal must belong to its owner'); END;
