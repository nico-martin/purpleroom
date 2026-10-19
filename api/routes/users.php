<?php
if (!defined('GREEN_ROOM')) exit;
route('GET', '/me', function () { json_response(['user' => private_user(require_login())]); });
route('PATCH', '/me', function () {
    $user = require_login();
    $data = profile_fields(body(), $user);
    if (array_key_exists('name', $data)) required($data, ['name']);
    if (isset($data['name'])) {
        if (strlen($data['name']) > 200) fail(422, 'validation', 'Keep your display name under 200 characters.');
        $data['profile_complete'] = 1;
    }
    persist_profile($data, $user);
    json_response(['user' => private_user(require_login())]);
});
route('DELETE', '/me', function () {
    $user = require_login();
    if ((body()['confirmation'] ?? null) !== 'DELETE') fail(422,'validation','Type DELETE to confirm permanent account deletion.');
    delete_own_account($user);
    logout_session();
    json_response(null,204);
});
route('GET', '/users', function () {
    $viewer = (int) require_login()['id'];
    $users = all('SELECT id,name,avatar_url FROM users u WHERE suspended=0 AND profile_complete=1 AND NOT EXISTS(SELECT 1 FROM blocks b WHERE (b.user_id=? AND b.blocked_id=u.id) OR (b.user_id=u.id AND b.blocked_id=?)) ORDER BY name,id', [$viewer,$viewer]);
    json_response(array_map(fn($u) => [...$u, 'relationship'=>friendship_state((int)$u['id'])], $users));
});
route('GET', '/users/{id}', function ($p) {
    $user = member_target((int)$p['id']); $state = friendship_state((int)$user['id']);
    $plans = [];
    if (in_array($state, ['self','friend'], true)) {
        $plans = all('SELECT a.status,e.id,e.title,e.starts_on,e.ends_on,e.city,e.country,e.online,e.conference_id FROM attendance a JOIN editions e ON e.id=a.edition_id JOIN conferences c ON c.id=e.conference_id WHERE a.user_id=? AND e.deleted_at IS NULL AND c.deleted_at IS NULL ORDER BY e.starts_on', [$user['id']]);
    }
    json_response(['user'=>profile_details($user), 'relationship'=>$state, 'plans'=>$plans]);
});
