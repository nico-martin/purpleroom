<?php
if (!defined('GREEN_ROOM')) exit;
route('POST', '/auth/request', function () {
    global $config;
    $data = body(); required($data, ['email']);
    if (!is_string($data['email']) || strlen(trim($data['email'])) > 254 || !filter_var(trim($data['email']), FILTER_VALIDATE_EMAIL)) fail(422, 'validation', 'Enter a valid email address.', ['email' => 'invalid']);
    $email = strtolower(trim($data['email']));
    $result = ['ok' => true];
    $ipAllowed = take_rate_limit('auth-ip:' . ($_SERVER['REMOTE_ADDR'] ?? 'unknown'), 30, 3600);
    $emailAllowed = $ipAllowed && take_rate_limit('auth-email:' . $email, 5, 3600);
    $user = one('SELECT * FROM users WHERE email=?', [$email]);
    if ($emailAllowed && $ipAllowed && !($user['suspended'] ?? false)) {
        $token = bin2hex(random_bytes(32));
        query('DELETE FROM auth_requests WHERE expires_at<?', [now()]);
        $id = insert('auth_requests', ['email' => $email, 'token_hash' => hash('sha256', $token), 'expires_at' => gmdate('Y-m-d\TH:i:s\Z', time() + 900)]);
        $link = $config['base_url'] . '/auth/' . $token;
        try { send_login_mail($email, $link); }
        catch (Throwable $error) { query('DELETE FROM auth_requests WHERE id=?', [$id]); throw $error; }
        if ($config['env'] === 'dev') $result['link'] = $link;
    }
    json_response($result);
}, true);
route('POST', '/auth/verify', function () {
    $data = body(); required($data, ['token']);
    if (!is_string($data['token']) || !preg_match('/^[a-f0-9]{64}$/D', $data['token'])) fail(422, 'validation', 'Invalid token.');
    if (!take_rate_limit('verify-ip:' . ($_SERVER['REMOTE_ADDR'] ?? 'unknown'), 100, 3600)) fail(429, 'rate_limited', 'Too many attempts. Please try again later.');
    start_session();
    db()->exec('BEGIN IMMEDIATE');
    try {
        $hash = hash('sha256', $data['token']);
        $token = one('SELECT * FROM auth_requests WHERE token_hash=? AND used_at IS NULL AND expires_at>?', [$hash, now()]);
        if ($token) {
            $user = one('SELECT * FROM users WHERE email=?', [$token['email']]);
            if (!$user) {
                $id = insert('users', ['email'=>$token['email'], 'name'=>'', 'profile_complete'=>0, 'cal_token'=>bin2hex(random_bytes(32))]);
                $user = one('SELECT * FROM users WHERE id=?', [$id]);
            }
            query('UPDATE auth_requests SET used_at=? WHERE id=?', [now(), $token['id']]);
        } else {
            // Existing, already-issued links and the local CLI seed remain usable.
            $token = one('SELECT * FROM login_tokens WHERE token_hash=? AND used_at IS NULL AND expires_at>?', [$hash, now()]);
            if (!$token) { db()->exec('ROLLBACK'); fail(422, 'invalid_token', 'That link has expired or has already been used. Request a fresh one.'); }
            $user = one('SELECT * FROM users WHERE id=?', [$token['user_id']]);
            query('UPDATE login_tokens SET used_at=? WHERE id=?', [now(), $token['id']]);
        }
        if (!$user || $user['suspended']) { db()->exec('ROLLBACK'); fail(401, 'unauthenticated', 'This account cannot sign in.'); }
        db()->exec('COMMIT');
    } catch (Throwable $error) { db()->exec('ROLLBACK'); throw $error; }
    login((int) $user['id']);
    json_response(['user' => private_user(require_login())]);
}, true);
route('POST', '/auth/logout', function () {
    start_session(); $_SESSION = []; session_destroy();
    setcookie('gr_session', '', ['expires' => time() - 3600, 'path' => '/', 'httponly' => true, 'samesite' => 'Lax']);
    json_response(null, 204);
}, true);
