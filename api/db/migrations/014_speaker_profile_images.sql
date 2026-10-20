-- Image roles are explicit owner choices. Existing profiles/publications stay unchanged.
ALTER TABLE speaker_information ADD COLUMN header_picture_id INTEGER REFERENCES speaker_pictures(id) ON DELETE SET NULL;
ALTER TABLE speaker_information ADD COLUMN profile_picture_id INTEGER REFERENCES speaker_pictures(id) ON DELETE SET NULL;
