ALTER TABLE editions ADD COLUMN title TEXT NOT NULL DEFAULT '';

UPDATE editions
SET title = COALESCE((SELECT name FROM conferences WHERE conferences.id = editions.conference_id), 'Conference')
WHERE trim(title) = '';
