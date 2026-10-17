<?php
if (!defined('GREEN_ROOM')) exit;
route('POST', '/comments', function () {
    $data = fields(body(), ['conference_id', 'edition_id', 'text']); required($data, ['text']);
    if (isset($data['conference_id']) === isset($data['edition_id'])) fail(422, 'validation', 'Choose exactly one discussion target.');
    if (isset($data['conference_id'])) conference($data['conference_id']); else edition($data['edition_id']);
    $id = insert('comments', [...$data, 'user_id' => require_login()['id']]); json_response([...one('SELECT * FROM comments WHERE id=?', [$id]), 'user' => public_user(require_login())], 201);
});
route('DELETE', '/comments/{id}', function ($p) {
    $c = one('SELECT * FROM comments WHERE id=?', [$p['id']]) ?? fail(404, 'not_found', 'Comment not found.');
    if ($c['user_id'] !== require_login()['id']) fail(403, 'forbidden', 'This comment belongs to someone else.');
    query('DELETE FROM comments WHERE id=?', [$c['id']]); json_response(null, 204);
});
