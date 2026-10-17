<?php
if (!defined('GREEN_ROOM')) exit;
route('PUT', '/editions/{id}/attendance', function ($p) {
    edition((int) $p['id']); $data = body();
    if (!in_array($data['status'] ?? '', ['maybe', 'going'], true)) fail(422, 'validation', 'Choose maybe or going.');
    query('INSERT INTO attendance (edition_id,user_id,status) VALUES (?,?,?) ON CONFLICT(edition_id,user_id) DO UPDATE SET status=excluded.status', [$p['id'], require_login()['id'], $data['status']]);
    json_response(one('SELECT * FROM attendance WHERE edition_id=? AND user_id=?', [$p['id'], require_login()['id']]));
});
route('DELETE', '/editions/{id}/attendance', function ($p) { edition((int) $p['id']); query('DELETE FROM attendance WHERE edition_id=? AND user_id=?', [$p['id'], require_login()['id']]); json_response(null, 204); });
