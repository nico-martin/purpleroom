CREATE TABLE login_codes (
 id INTEGER PRIMARY KEY,
 email TEXT NOT NULL COLLATE NOCASE,
 request_hash TEXT NOT NULL UNIQUE,
 code_hash TEXT NOT NULL,
 attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts >= 0),
 expires_at TEXT NOT NULL,
 used_at TEXT
);
CREATE INDEX idx_login_codes_email ON login_codes(email);
CREATE INDEX idx_login_codes_expiry ON login_codes(expires_at);
