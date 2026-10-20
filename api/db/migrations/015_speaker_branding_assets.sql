-- Separate custom covers and profile snapshots from downloadable speaker photos.
CREATE TABLE speaker_branding_assets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    public_token TEXT NOT NULL UNIQUE,
    filename TEXT NOT NULL,
    label TEXT NOT NULL,
    UNIQUE(user_id, filename, label)
);
ALTER TABLE speaker_information ADD COLUMN header_asset_id INTEGER REFERENCES speaker_branding_assets(id) ON DELETE SET NULL;
