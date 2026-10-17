CREATE TABLE users (
 id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE COLLATE NOCASE,
 avatar_url TEXT, cal_token TEXT NOT NULL UNIQUE,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE TABLE login_tokens (
 id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 token_hash TEXT NOT NULL UNIQUE, expires_at TEXT NOT NULL, used_at TEXT
);
CREATE TABLE invites (
 id INTEGER PRIMARY KEY, token_hash TEXT NOT NULL UNIQUE, email TEXT,
 invited_by INTEGER NOT NULL REFERENCES users(id), accepted_by INTEGER REFERENCES users(id),
 expires_at TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE TABLE conferences (
 id INTEGER PRIMARY KEY, name TEXT NOT NULL, website TEXT, logo_url TEXT, description TEXT,
 created_by INTEGER NOT NULL REFERENCES users(id),
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
 updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')), deleted_at TEXT
);
CREATE TABLE reviews (
 id INTEGER PRIMARY KEY, conference_id INTEGER NOT NULL REFERENCES conferences(id) ON DELETE CASCADE,
 user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, tags TEXT NOT NULL DEFAULT '[]',
 would_submit_again INTEGER, text TEXT,
 updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
 UNIQUE (conference_id, user_id)
);
CREATE TABLE editions (
 id INTEGER PRIMARY KEY, conference_id INTEGER NOT NULL REFERENCES conferences(id) ON DELETE CASCADE,
 year INTEGER NOT NULL, city TEXT, country TEXT, online INTEGER NOT NULL DEFAULT 0,
 starts_on TEXT, ends_on TEXT, website TEXT, cfp_url TEXT, cfp_opens_on TEXT, cfp_closes_on TEXT,
 notes TEXT, created_by INTEGER NOT NULL REFERENCES users(id),
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
 updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')), deleted_at TEXT
);
CREATE INDEX idx_editions_cfp ON editions(cfp_closes_on);
CREATE INDEX idx_editions_start ON editions(starts_on);
CREATE TABLE papers (
 id INTEGER PRIMARY KEY, owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 title TEXT NOT NULL, abstract TEXT, notes TEXT,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
 updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE TABLE submissions (
 id INTEGER PRIMARY KEY, paper_id INTEGER NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
 edition_id INTEGER NOT NULL REFERENCES editions(id) ON DELETE CASCADE,
 status TEXT NOT NULL DEFAULT 'interested' CHECK (status IN ('interested','submitted','accepted','rejected','waitlisted','confirmed','declined','attended')),
 abstract_override TEXT, hide_title INTEGER NOT NULL DEFAULT 0, submitted_on TEXT,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
 updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
 UNIQUE (paper_id, edition_id)
);
CREATE TABLE attendance (
 id INTEGER PRIMARY KEY, edition_id INTEGER NOT NULL REFERENCES editions(id) ON DELETE CASCADE,
 user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 status TEXT NOT NULL CHECK (status IN ('maybe','going')), UNIQUE (edition_id, user_id)
);
CREATE TABLE comments (
 id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 conference_id INTEGER REFERENCES conferences(id) ON DELETE CASCADE,
 edition_id INTEGER REFERENCES editions(id) ON DELETE CASCADE, text TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
 CHECK ((conference_id IS NULL) <> (edition_id IS NULL))
);
CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);
