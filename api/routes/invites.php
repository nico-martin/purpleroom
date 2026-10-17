<?php
if (!defined('GREEN_ROOM')) exit;
route('GET', '/invites', function () {
    $invites = all('SELECT * FROM invites WHERE accepted_by IS NULL AND expires_at>? ORDER BY created_at DESC', [now()]);
    json_response(array_map(function ($invite) {
        return ['id' => $invite['id'], 'email' => $invite['email'], 'invited_by' => user_by_id((int) $invite['invited_by']), 'expires_at' => $invite['expires_at'], 'created_at' => $invite['created_at'], 'url' => recover_invite_link($invite)];
    }, $invites));
});
route('POST', '/invites', function () {
    global $config;
    $data = fields(body(), ['email']);
    if (!empty($data['email']) && !filter_var($data['email'], FILTER_VALIDATE_EMAIL)) fail(422, 'validation', 'Enter a valid email address.');
    $token = bin2hex(random_bytes(32)); $expires = gmdate('Y-m-d\TH:i:s\Z', time() + 14 * 86400);
    db()->beginTransaction();
    try {
        $id = insert('invites', ['token_hash' => hash('sha256', $token), 'email' => $data['email'] ?? null, 'invited_by' => require_login()['id'], 'expires_at' => $expires]);
        store_invite_link(one('SELECT * FROM invites WHERE id=?', [$id]), $token);
        db()->commit();
    } catch (Throwable $error) { db()->rollBack(); throw $error; }
    json_response(['url' => $config['base_url'] . '/invite/' . $token, 'expires_at' => $expires], 201);
});
route('DELETE', '/invites/{id}', function ($params) {
    // Serialize with acceptance/regeneration so accepted invitations are never removed.
    db()->exec('BEGIN IMMEDIATE');
    $invite = one('SELECT * FROM invites WHERE id=? AND accepted_by IS NULL AND expires_at>?', [$params['id'], now()]);
    if (!$invite) { db()->exec('ROLLBACK'); fail(404, 'not_found', 'Open invitation not found. It may already have been accepted or deleted.'); }
    query('DELETE FROM invites WHERE id=?', [$invite['id']]);
    db()->exec('COMMIT');
    forget_invite_link($invite);
    json_response(null, 204);
});
route('POST', '/invites/{id}/regenerate', function ($params) {
    global $config;
    db()->exec('BEGIN IMMEDIATE');
    try {
        $invite = one('SELECT * FROM invites WHERE id=? AND accepted_by IS NULL AND expires_at>?', [$params['id'], now()]);
        if (!$invite) { db()->exec('ROLLBACK'); fail(404, 'not_found', 'Open invitation not found. It may already have been accepted or deleted.'); }
        $token = bin2hex(random_bytes(32));
        $next = [...$invite, 'token_hash' => hash('sha256', $token)];
        store_invite_link($next, $token);
        update('invites', (int) $invite['id'], ['token_hash' => $next['token_hash']]);
        db()->exec('COMMIT');
    } catch (Throwable $error) { db()->exec('ROLLBACK'); throw $error; }
    forget_invite_link($invite);
    json_response(['url' => $config['base_url'] . '/invite/' . $token, 'expires_at' => $invite['expires_at']]);
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
    db()->exec('COMMIT'); forget_invite_link($invite); login($id);
    json_response(['user' => private_user(require_login())], 201);
}, true);
