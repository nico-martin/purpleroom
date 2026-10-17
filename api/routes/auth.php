<?php
if (!defined('GREEN_ROOM')) exit;
route('POST', '/auth/request', function () {
    global $config;
    $data = body(); required($data, ['email']);
    if (!is_string($data['email']) || !filter_var($data['email'], FILTER_VALIDATE_EMAIL)) fail(422, 'validation', 'Enter a valid email address.', ['email' => 'invalid']);
    $user = one('SELECT * FROM users WHERE email=?', [trim($data['email'])]);
    $result = ['ok' => true];
    if ($user) {
        // Expiry minus 15 minutes is the issue time; no extra tracking table needed.
        $count = one('SELECT COUNT(*) AS n FROM login_tokens WHERE user_id=? AND expires_at > ?', [$user['id'], gmdate('Y-m-d\TH:i:s\Z', time() - 2700)]);
        if ($count['n'] < 5) {
            $token = bin2hex(random_bytes(32));
            insert('login_tokens', ['user_id' => $user['id'], 'token_hash' => hash('sha256', $token), 'expires_at' => gmdate('Y-m-d\TH:i:s\Z', time() + 900)]);
            $link = $config['base_url'] . '/auth/' . $token;
            send_login_mail($user['email'], $link);
            if ($config['env'] === 'dev') $result['link'] = $link;
        }
    }
    json_response($result);
}, true);
route('POST', '/auth/verify', function () {
    $data = body(); required($data, ['token']);
    if (!is_string($data['token'])) fail(422, 'validation', 'Invalid token.');
    db()->exec('BEGIN IMMEDIATE');
    $token = one('SELECT * FROM login_tokens WHERE token_hash=? AND used_at IS NULL AND expires_at>?', [hash('sha256', $data['token']), now()]);
    if (!$token) { db()->exec('ROLLBACK'); fail(422, 'invalid_token', 'That link has expired or has already been used. Request a fresh one.'); }
    query('UPDATE login_tokens SET used_at=? WHERE id=?', [now(), $token['id']]);
    db()->exec('COMMIT');
    login((int) $token['user_id']);
    json_response(['user' => private_user(require_login())]);
}, true);
route('POST', '/auth/logout', function () {
    start_session(); $_SESSION = []; session_destroy();
    setcookie('gr_session', '', ['expires' => time() - 3600, 'path' => '/', 'httponly' => true, 'samesite' => 'Lax']);
    json_response(null, 204);
});
