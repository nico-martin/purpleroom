<?php
if (!defined('GREEN_ROOM')) exit;
function submission_data(array $input): array {
    $unassigned = array_key_exists('paper_id',$input) && $input['paper_id'] === null;
    if ($unassigned) unset($input['paper_id']);
    $data = fields($input, ['paper_id', 'edition_id', 'status', 'abstract_override', 'hide_title', 'submitted_on', 'notes']);
    if ($unassigned) $data['paper_id'] = null;
    if (isset($data['status']) && !in_array($data['status'], SUBMISSION_STATUSES, true) || array_key_exists('status', $data) && $data['status'] === null) fail(422, 'validation', 'Choose a valid submission status.');
    return $data;
}
function own_submission(int $id): array {
    $s = one('SELECT * FROM submissions WHERE id=?', [$id]) ?? fail(404, 'not_found', 'Submission not found.');
    if ($s['owner_id'] !== require_login()['id']) fail(403, 'forbidden', 'This submission belongs to someone else.');
    unset($s['owner_id']); return $s;
}
route('GET', '/submissions', function () {
    $sql='SELECT s.*,p.title AS paper_title,e.conference_id FROM submissions s LEFT JOIN papers p ON p.id=s.paper_id JOIN editions e ON e.id=s.edition_id WHERE s.owner_id=?';
    if (($_GET['unassigned'] ?? '')==='1') $sql.=' AND s.paper_id IS NULL';
    $rows=all($sql . ' ORDER BY e.starts_on,s.id',[require_login()['id']]);
    json_response(array_map(function($s) {
        unset($s['owner_id']);
        return [...$s,'edition'=>one('SELECT * FROM editions WHERE id=?',[$s['edition_id']]),'conference'=>conference_record(one('SELECT * FROM conferences WHERE id=?',[$s['conference_id']]))];
    },$rows));
});
route('POST', '/submissions', function () {
    $data = submission_data(body()); required($data, ['edition_id']);
    if (isset($data['paper_id'])) paper($data['paper_id']);
    edition($data['edition_id']);
    $data['owner_id'] = require_login()['id'];
    if (($data['status'] ?? '') === 'submitted' && empty($data['submitted_on'])) $data['submitted_on'] = gmdate('Y-m-d');
    $id = insert('submissions', $data); json_response(own_submission($id), 201);
});
route('PATCH', '/submissions/{id}', function ($p) {
    $s = own_submission((int) $p['id']); $data = submission_data(body());
    if (isset($data['paper_id'])) paper($data['paper_id']); if (isset($data['edition_id'])) edition($data['edition_id']);
    if (($data['status'] ?? '') === 'submitted' && empty($data['submitted_on'] ?? $s['submitted_on'])) $data['submitted_on'] = gmdate('Y-m-d');
    update('submissions', (int) $s['id'], [...$data, 'updated_at' => now()]); json_response(own_submission((int) $s['id']));
});
route('DELETE', '/submissions/{id}', function ($p) { $s = own_submission((int) $p['id']); query('DELETE FROM submissions WHERE id=?', [$s['id']]); json_response(null, 204); });
