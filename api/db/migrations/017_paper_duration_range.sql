-- Optional upper bound for talks offered as a duration range (e.g. 20–45 minutes).
-- duration_minutes stays the exact or lower value; existing rows keep a single duration.
ALTER TABLE papers ADD COLUMN duration_max_minutes INTEGER;
