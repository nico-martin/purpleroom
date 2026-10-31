-- Shared talk details and named abstract variants. Legacy abstracts stay stored and are
-- copied once, verbatim, into an "Abstract" variant; updated_at is deliberately untouched.
ALTER TABLE papers ADD COLUMN duration_minutes INTEGER;
ALTER TABLE papers ADD COLUMN audience_level TEXT;
ALTER TABLE papers ADD COLUMN language TEXT;
ALTER TABLE papers ADD COLUMN format TEXT;
ALTER TABLE papers ADD COLUMN abstract_variants TEXT NOT NULL DEFAULT '[]';
UPDATE papers SET abstract_variants = json_array(json_object('label', 'Abstract', 'text', abstract))
 WHERE abstract IS NOT NULL AND trim(abstract, ' ' || char(9, 10, 13)) <> '';
