<?php
if (!defined('GREEN_ROOM')) exit;
const EDITION_FIELDS = ['conference_id', 'title', 'year', 'city', 'country', 'online', 'starts_on', 'ends_on', 'starts_timezone', 'ends_timezone', 'website', 'cfp_url', 'cfp_opens_on', 'cfp_closes_on', 'cfp_opens_timezone', 'cfp_closes_timezone', 'cfp_closes_time', 'notes'];
route('GET', '/editions', function () {
    $sql = 'SELECT e.* FROM editions e JOIN conferences c ON c.id=e.conference_id WHERE e.deleted_at IS NULL AND c.deleted_at IS NULL'; $params = [];
    foreach (['from' => '>=', 'to' => '<='] as $key => $op) if (!empty($_GET[$key])) { $sql .= " AND e.starts_on $op ?"; $params[] = $_GET[$key]; }
    if (($_GET['cfp_open'] ?? '') === '1') { $sql .= ' AND '.cfp_open_sql('e'); $params = [...$params,...cfp_open_params()]; }
    json_response(array_map(fn($e) => [...$e, 'conference' => conference_summary(conference((int) $e['conference_id']))], all($sql . ' ORDER BY e.starts_on', $params)));
});
route('POST', '/editions', function () {
    $data = edition_date_fields(fields(body(), EDITION_FIELDS)); required($data, ['conference_id']);
    $parent = conference((int) $data['conference_id']);
    if (!array_key_exists('title', $data)) $data['title'] = $parent['name'];
    required($data, ['title']); validate_edition($data);
    $data = with_edition_legacy_year($data);
    $id = insert('editions', [...$data, 'created_by' => require_login()['id']]); json_response(edition($id), 201);
});
route('GET', '/editions/{id}', function ($p) {
    $e = edition((int) $p['id']);
    json_response([...$e, 'conference' => conference_summary(conference((int) $e['conference_id'])), 'submitted_friends' => submitted_friends((int)$e['id']), 'attendance' => attendance_for((int) $e['id']), ...people_for((int) $e['id']), 'my_submissions' => all('SELECT s.*, p.title AS paper_title FROM submissions s LEFT JOIN papers p ON p.id=s.paper_id WHERE s.edition_id=? AND s.owner_id=?', [$e['id'], require_login()['id']])]);
});
route('PATCH', '/editions/{id}', function ($p) {
    $e = edition((int) $p['id']); $data = edition_date_fields(fields(body(), EDITION_FIELDS),$e);
    if (isset($data['conference_id'])) {
        $parent = conference($data['conference_id']);
        if (!array_key_exists('title', $data) && $e['title'] === conference((int) $e['conference_id'])['name']) $data['title'] = $parent['name'];
    }
    if (array_key_exists('title', $data)) required($data, ['title']);
    validate_edition([...$e, ...$data]);
    $data = with_edition_legacy_year($data, $e);
    update('editions', (int) $e['id'], [...$data, 'updated_at' => now()]); json_response(edition((int) $e['id']));
});
route('DELETE', '/editions/{id}', function ($p) { $e = edition((int) $p['id']); update('editions', (int) $e['id'], ['deleted_at' => now()]); json_response(null, 204); });
route('POST', '/editions/{id}/restore', function ($p) {
    $e = one('SELECT * FROM editions WHERE id=?', [$p['id']]) ?? fail(404, 'not_found', 'Edition not found.');
    conference((int) $e['conference_id']); update('editions', (int) $e['id'], ['deleted_at' => null]); json_response(edition((int) $e['id']));
});
