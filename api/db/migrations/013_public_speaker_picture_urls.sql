-- Public capability URLs expose only image bytes, never the private speaker/account payload.
ALTER TABLE speaker_pictures ADD COLUMN public_token TEXT NOT NULL DEFAULT '';
UPDATE speaker_pictures SET public_token=lower(hex(randomblob(24)));
CREATE UNIQUE INDEX idx_speaker_picture_public_token ON speaker_pictures(public_token) WHERE public_token<>'';
CREATE TRIGGER speaker_picture_public_token AFTER INSERT ON speaker_pictures
WHEN NEW.public_token=''
BEGIN
    UPDATE speaker_pictures SET public_token=lower(hex(randomblob(24))) WHERE id=NEW.id;
END;
