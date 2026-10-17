<?php
if (!defined('GREEN_ROOM')) exit;
function submission_data(array $input): array {
    $data = fields($input, ['paper_id', 'edition_id', 'status', 'abstract_override', 'hide_title', 'submitted_on']);
    if (isset($data['status']) && !in_array($data['status'], SUBMISSION_STATUSES, true) || array_key_exists('status', $data) && $data['status'] === null) fail(422, 'validation', 'Choose a valid submission status.');
    return $data;
}
function own_submission(int $id): array {
    $s = one('SELECT s.*, p.owner_id FROM submissions s JOIN papers p ON p.id=s.paper_id WHERE s.id=?', [$id]) ?? fail(404, 'not_found', 'Submission not found.');
    if ($s['owner_id'] !== require_login()['id']) fail(403, 'forbidden', 'This submission belongs to someone else.');
    unset($s['owner_id']); return $s;
}
route('POST', '/submissions', function () {
    $data = submission_data(body()); required($data, ['paper_id', 'edition_id']); paper($data['paper_id']); edition($data['edition_id']);
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
