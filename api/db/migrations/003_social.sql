ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'member' CHECK(role IN ('member','admin'));
ALTER TABLE users ADD COLUMN suspended INTEGER NOT NULL DEFAULT 0 CHECK(suspended IN (0,1));
ALTER TABLE users ADD COLUMN profile_complete INTEGER NOT NULL DEFAULT 1 CHECK(profile_complete IN (0,1));
ALTER TABLE users ADD COLUMN session_version INTEGER NOT NULL DEFAULT 0;
UPDATE users SET role='admin' WHERE email='mail@nico.dev' COLLATE NOCASE;

CREATE TABLE auth_requests (
 id INTEGER PRIMARY KEY, email TEXT NOT NULL COLLATE NOCASE, token_hash TEXT NOT NULL UNIQUE,
 expires_at TEXT NOT NULL, used_at TEXT
);
CREATE INDEX idx_auth_requests_expiry ON auth_requests(expires_at);
CREATE TABLE rate_limits (
 key_hash TEXT PRIMARY KEY, window_start INTEGER NOT NULL, attempts INTEGER NOT NULL
);
CREATE INDEX idx_rate_limits_window ON rate_limits(window_start);
CREATE TABLE friendships (
 user_low INTEGER NOT NULL REFERENCES users(id), user_high INTEGER NOT NULL REFERENCES users(id),
 requested_by INTEGER NOT NULL REFERENCES users(id), status TEXT NOT NULL CHECK(status IN ('pending','accepted')),
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
 PRIMARY KEY(user_low,user_high), CHECK(user_low < user_high),
 CHECK(requested_by=user_low OR requested_by=user_high)
);
CREATE INDEX idx_friendships_high ON friendships(user_high,status);
CREATE TABLE blocks (
 user_id INTEGER NOT NULL REFERENCES users(id), blocked_id INTEGER NOT NULL REFERENCES users(id),
 created_at TEXT NOT NULL, PRIMARY KEY(user_id,blocked_id), CHECK(user_id<>blocked_id)
);
