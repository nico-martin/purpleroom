<?php
if (!defined('GREEN_ROOM')) exit;
route('GET', '/invites', fn() => json_response(array_map(fn($r) => [...$r, 'invited_by' => user_by_id((int) $r['invited_by'])], all('SELECT id,email,invited_by,expires_at,created_at FROM invites WHERE accepted_by IS NULL AND expires_at>? ORDER BY created_at DESC', [now()]))));
route('POST', '/invites', function () {
    global $config;
    $data = fields(body(), ['email']);
    if (!empty($data['email']) && !filter_var($data['email'], FILTER_VALIDATE_EMAIL)) fail(422, 'validation', 'Enter a valid email address.');
    $token = bin2hex(random_bytes(32)); $expires = gmdate('Y-m-d\TH:i:s\Z', time() + 14 * 86400);
    insert('invites', ['token_hash' => hash('sha256', $token), 'email' => $data['email'] ?? null, 'invited_by' => require_login()['id'], 'expires_at' => $expires]);
    json_response(['url' => $config['base_url'] . '/invite/' . $token, 'expires_at' => $expires], 201);
});
function valid_invite(string $token): ?array { return one('SELECT * FROM invites WHERE token_hash=? AND accepted_by IS NULL AND expires_at>?', [hash('sha256', $token), now()]); }
route('GET', '/invites/{token}', function ($p) {
    $invite = valid_invite($p['token']);
    json_response($invite ? ['valid' => true, 'invited_by' => ['name' => user_by_id((int) $invite['invited_by'])['name']], 'email' => $invite['email']] : ['valid' => false]);
}, true);
route('POST', '/invites/{token}/accept', function ($p) {
    $data = fields(body(), ['name', 'email']); required($data, ['name', 'email']);
    if (!filter_var($data['email'], FILTER_VALIDATE_EMAIL)) fail(422, 'validation', 'Enter a valid email address.');
    db()->exec('BEGIN IMMEDIATE');
    $invite = valid_invite($p['token']);
    if (!$invite) { db()->exec('ROLLBACK'); fail(422, 'invalid_token', 'That invite has expired or has already been used.'); }
    $id = insert('users', [...$data, 'cal_token' => bin2hex(random_bytes(32))]);
    update('invites', (int) $invite['id'], ['accepted_by' => $id]);
    db()->exec('COMMIT'); login($id);
    json_response(['user' => private_user(require_login())], 201);
}, true);
