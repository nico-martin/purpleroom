-- A speaking opportunity belongs to its member even before a proposal is chosen.
CREATE TABLE submissions_new (
 id INTEGER PRIMARY KEY,
 owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 paper_id INTEGER REFERENCES papers(id) ON DELETE CASCADE,
 edition_id INTEGER NOT NULL REFERENCES editions(id) ON DELETE CASCADE,
 status TEXT NOT NULL DEFAULT 'interested' CHECK (status IN ('interested','submitted','accepted','rejected','waitlisted','confirmed','declined','attended')),
 abstract_override TEXT, hide_title INTEGER NOT NULL DEFAULT 0, submitted_on TEXT,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
 updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
 UNIQUE(paper_id,edition_id)
);
INSERT INTO submissions_new(id,owner_id,paper_id,edition_id,status,abstract_override,hide_title,submitted_on,created_at,updated_at)
 SELECT s.id,p.owner_id,s.paper_id,s.edition_id,s.status,s.abstract_override,s.hide_title,s.submitted_on,s.created_at,s.updated_at
 -- An inconsistent legacy reference fails the NOT NULL owner check instead of losing a row.
 FROM submissions s LEFT JOIN papers p ON p.id=s.paper_id;
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
