-- Optional usernames and deliberately published snapshots; existing profiles stay private.
ALTER TABLE users ADD COLUMN username TEXT COLLATE NOCASE;
CREATE UNIQUE INDEX idx_users_username ON users(username) WHERE username IS NOT NULL;
CREATE TABLE speaker_information (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    speaker_id TEXT NOT NULL UNIQUE,
    draft TEXT NOT NULL DEFAULT '{}',
    published TEXT,
    revision TEXT
);
CREATE TABLE speaker_pictures (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    credit TEXT NOT NULL,
    filename TEXT NOT NULL
);
CREATE INDEX idx_speaker_pictures_owner ON speaker_pictures(user_id);
