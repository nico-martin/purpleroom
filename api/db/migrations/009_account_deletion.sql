-- Rebuild under the migration runner's foreign-key-safe transaction.
-- Never reuse a deleted identity: old PHP sessions must not authenticate as a new member.
CREATE TABLE users_new (
 id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE COLLATE NOCASE,
 avatar_url TEXT, cal_token TEXT NOT NULL UNIQUE,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
 role TEXT NOT NULL DEFAULT 'member' CHECK(role IN ('member','admin')),
 suspended INTEGER NOT NULL DEFAULT 0 CHECK(suspended IN (0,1)),
 profile_complete INTEGER NOT NULL DEFAULT 1 CHECK(profile_complete IN (0,1)),
 session_version INTEGER NOT NULL DEFAULT 0,
 homepage_url TEXT, github_url TEXT, linkedin_url TEXT, x_url TEXT,
 bluesky_url TEXT, instagram_url TEXT, youtube_url TEXT, mastodon_url TEXT
);
INSERT INTO users_new SELECT * FROM users;
DROP TABLE users;
ALTER TABLE users_new RENAME TO users;

CREATE TABLE conferences_new (
 id INTEGER PRIMARY KEY, name TEXT NOT NULL, website TEXT, logo_url TEXT, description TEXT,
 created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
 updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')), deleted_at TEXT,
 tags TEXT NOT NULL DEFAULT '[]'
);
INSERT INTO conferences_new SELECT * FROM conferences;
DROP TABLE conferences;
ALTER TABLE conferences_new RENAME TO conferences;

CREATE TABLE editions_new (
 id INTEGER PRIMARY KEY, conference_id INTEGER NOT NULL REFERENCES conferences(id) ON DELETE CASCADE,
 year INTEGER NOT NULL, city TEXT, country TEXT, online INTEGER NOT NULL DEFAULT 0,
 starts_on TEXT, ends_on TEXT, website TEXT, cfp_url TEXT, cfp_opens_on TEXT, cfp_closes_on TEXT,
 notes TEXT, created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
 updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')), deleted_at TEXT,
 title TEXT NOT NULL DEFAULT ''
);
INSERT INTO editions_new SELECT * FROM editions;
DROP TABLE editions;
ALTER TABLE editions_new RENAME TO editions;
CREATE INDEX idx_editions_cfp ON editions(cfp_closes_on);
CREATE INDEX idx_editions_start ON editions(starts_on);

-- Files become inaccessible with account removal; retain only paths until physical cleanup succeeds.
CREATE TABLE account_deletion_files (path TEXT PRIMARY KEY, attempts INTEGER NOT NULL DEFAULT 0);
