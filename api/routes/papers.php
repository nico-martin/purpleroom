<?php
if (!defined('GREEN_ROOM')) exit;
function paper_with_submissions(array $p): array {
    $p['submissions'] = array_map(fn($s) => [...$s, 'edition' => edition((int) $s['edition_id']), 'conference' => conference((int) $s['conference_id'])], all('SELECT s.*,e.conference_id FROM submissions s JOIN editions e ON e.id=s.edition_id JOIN conferences c ON c.id=e.conference_id WHERE s.paper_id=? AND e.deleted_at IS NULL AND c.deleted_at IS NULL ORDER BY e.starts_on', [$p['id']]));
    return $p;
}
route('GET', '/papers', fn() => json_response(array_map('paper_with_submissions', all('SELECT * FROM papers WHERE owner_id=? ORDER BY updated_at DESC', [require_login()['id']]))));
route('POST', '/papers', function () {
    $data = fields(body(), ['title', 'abstract', 'notes']); required($data, ['title']);
    $id = insert('papers', [...$data, 'owner_id' => require_login()['id']]); json_response(paper_with_submissions(paper($id)), 201);
});
route('GET', '/papers/{id}', fn($p) => json_response(paper_with_submissions(paper((int) $p['id']))));
route('PATCH', '/papers/{id}', function ($p) {
    $paper = paper((int) $p['id']); $data = fields(body(), ['title', 'abstract', 'notes']);
    if (array_key_exists('title', $data)) required($data, ['title']);
    update('papers', (int) $paper['id'], [...$data, 'updated_at' => now()]); json_response(paper_with_submissions(paper((int) $paper['id'])));
});
route('DELETE', '/papers/{id}', function ($p) { $paper = paper((int) $p['id']); query('DELETE FROM papers WHERE id=?', [$paper['id']]); json_response(null, 204); });
