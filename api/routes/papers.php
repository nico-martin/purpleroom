<?php
if (!defined('GREEN_ROOM')) exit;
function paper_with_submissions(array $p): array {
    $p['abstract_variants'] = json_decode($p['abstract_variants'], true, 64, JSON_THROW_ON_ERROR);
    $p['submissions'] = array_map(fn($s) => [...$s, 'edition' => one('SELECT * FROM editions WHERE id=?',[$s['edition_id']]), 'conference' => conference_record(one('SELECT * FROM conferences WHERE id=?',[$s['conference_id']]))], all('SELECT s.*,e.conference_id FROM submissions s JOIN editions e ON e.id=s.edition_id WHERE s.paper_id=? ORDER BY e.starts_on', [$p['id']]));
    return $p;
}
// Omitted keys keep stored values; null or "" clears a detail, [] or null clears the variants.
function paper_data(array $input, array $existing = []): array {
    $data = fields($input, ['title', 'abstract', 'notes', 'language']);
    if (array_key_exists('title', $data)) required($data, ['title']);
    if (isset($data['language']) && strlen($data['language']) > 100) fail(422, 'validation', 'Keep the language under 100 bytes.', ['language' => 'too_long']);
    foreach (['audience_level' => PAPER_AUDIENCE_LEVELS, 'format' => PAPER_FORMATS] as $key => $allowed) if (array_key_exists($key, $input)) {
        $data[$key] = $input[$key] === '' ? null : $input[$key];
        if ($data[$key] !== null && !in_array($data[$key], $allowed, true)) fail(422, 'validation', "Choose a valid $key.", [$key => 'invalid']);
    }
    // A duration is exact (duration_minutes) or a range up to duration_max_minutes; an omitted bound keeps its stored value.
    foreach (['duration_minutes', 'duration_max_minutes'] as $key) if (array_key_exists($key, $input)) {
        $data[$key] = $input[$key] === '' ? null : $input[$key];
        if ($data[$key] !== null && (!is_int($data[$key]) || $data[$key] < 1 || $data[$key] > 600)) fail(422, 'validation', 'Use whole minutes from 1 to 600.', [$key => 'invalid']);
    }
    if (array_key_exists('duration_minutes', $data) || array_key_exists('duration_max_minutes', $data)) {
        $min = array_key_exists('duration_minutes', $data) ? $data['duration_minutes'] : ($existing['duration_minutes'] ?? null);
        $max = array_key_exists('duration_max_minutes', $data) ? $data['duration_max_minutes'] : ($existing['duration_max_minutes'] ?? null);
        if ($max !== null && ($min === null || $max <= $min)) fail(422, 'validation', 'End a duration range above its start, for example 20-45.', ['duration_max_minutes' => 'invalid']);
    }
    if (array_key_exists('abstract_variants', $input)) {
        $variants = [];
        foreach (speaker_list($input, 'abstract_variants', 20) as $variant) {
            if (!is_array($variant)) fail(422, 'validation', 'Invalid abstract variant.', ['abstract_variants' => 'invalid']);
            $entry = ['label' => speaker_text($variant, 'label'), 'text' => speaker_text($variant, 'text', 20000)];
            required($entry, ['label', 'text']);
            $variants[] = $entry;
        }
        $data['abstract_variants'] = json_encode($variants, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
    }
    return $data;
}
route('GET', '/papers', fn() => json_response(array_map('paper_with_submissions', all('SELECT * FROM papers WHERE owner_id=? ORDER BY updated_at DESC', [require_login()['id']]))));
route('POST', '/papers', function () {
    $data = paper_data(body()); required($data, ['title']);
    $id = insert('papers', [...$data, 'owner_id' => require_login()['id']]); json_response(paper_with_submissions(paper($id)), 201);
});
route('GET', '/papers/{id}', fn($p) => json_response(paper_with_submissions(paper((int) $p['id']))));
route('PATCH', '/papers/{id}', function ($p) {
    $paper = paper((int) $p['id']); $data = paper_data(body(), $paper);
    update('papers', (int) $paper['id'], [...$data, 'updated_at' => now()]); json_response(paper_with_submissions(paper((int) $paper['id'])));
});
route('DELETE', '/papers/{id}', function ($p) { $paper = paper((int) $p['id']); query('DELETE FROM papers WHERE id=?', [$paper['id']]); json_response(null, 204); });
