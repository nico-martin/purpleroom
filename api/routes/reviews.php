<?php
if (!defined('GREEN_ROOM')) exit;
route('PUT', '/conferences/{id}/review', function ($p) {
    $c = conference((int) $p['id']); $data = body(); required($data, ['tags']);
    if (!is_array($data['tags']) || !array_is_list($data['tags'])) fail(422, 'validation', 'Choose valid tags.');
    foreach ($data['tags'] as $tag) if (!is_string($tag) || !array_key_exists($tag, REVIEW_TAGS)) fail(422, 'validation', 'Unknown review tag.');
    $again = $data['would_submit_again'] ?? null;
    if (!in_array($again, [null, 0, 1, false, true], true)) fail(422, 'validation', 'Invalid recommendation.');
    $text = fields($data, ['text'])['text'] ?? null;
    query('INSERT INTO reviews (conference_id,user_id,tags,would_submit_again,text) VALUES (?,?,?,?,?) ON CONFLICT(conference_id,user_id) DO UPDATE SET tags=excluded.tags,would_submit_again=excluded.would_submit_again,text=excluded.text,updated_at=?', [$c['id'], require_login()['id'], json_encode(array_values(array_unique($data['tags']))), $again === null ? null : (int) $again, $text, now()]);
    $r = one('SELECT * FROM reviews WHERE conference_id=? AND user_id=?', [$c['id'], require_login()['id']]); $r['tags'] = json_decode($r['tags'], true); $r['user'] = public_user(require_login()); json_response($r);
});
route('DELETE', '/conferences/{id}/review', function ($p) { conference((int) $p['id']); query('DELETE FROM reviews WHERE conference_id=? AND user_id=?', [$p['id'], require_login()['id']]); json_response(null, 204); });
