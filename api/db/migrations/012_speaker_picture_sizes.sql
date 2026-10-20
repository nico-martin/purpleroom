-- Existing originals and publications stay intact; new saves record pre-generated variants.
ALTER TABLE speaker_pictures ADD COLUMN variants TEXT NOT NULL DEFAULT '{}';
