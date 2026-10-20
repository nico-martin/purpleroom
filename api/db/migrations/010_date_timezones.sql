-- Preserve existing date-only values; no timezone can be inferred for legacy records.
ALTER TABLE editions ADD COLUMN starts_timezone TEXT;
ALTER TABLE editions ADD COLUMN ends_timezone TEXT;
ALTER TABLE editions ADD COLUMN cfp_opens_timezone TEXT;
ALTER TABLE editions ADD COLUMN cfp_closes_timezone TEXT;
ALTER TABLE editions ADD COLUMN cfp_closes_time TEXT;
ALTER TABLE editions ADD COLUMN cfp_opens_at TEXT;
ALTER TABLE editions ADD COLUMN cfp_closes_at TEXT;
ALTER TABLE submissions ADD COLUMN submitted_timezone TEXT;
CREATE INDEX idx_editions_cfp_instant ON editions(cfp_closes_at);
