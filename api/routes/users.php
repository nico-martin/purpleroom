<?php
if (!defined('GREEN_ROOM')) exit;
route('GET', '/me', function () { $user = require_login(); json_response(['user' => private_user($user), 'cal_url' => cal_url($user)]); });
route('PATCH', '/me', function () {
    $data = fields(body(), ['name', 'avatar_url']);
    if (array_key_exists('name', $data)) required($data, ['name']);
    update('users', (int) require_login()['id'], $data);
    json_response(['user' => private_user(require_login())]);
});
route('POST', '/me/cal-token', function () {
    update('users', (int) require_login()['id'], ['cal_token' => bin2hex(random_bytes(32))]);
    json_response(['cal_url' => cal_url(require_login())]);
});
route('GET', '/users', fn() => json_response(all('SELECT id, name, avatar_url FROM users ORDER BY name')));
