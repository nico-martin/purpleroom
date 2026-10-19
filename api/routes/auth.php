<?php
if (!defined('GREEN_ROOM')) exit;
route('POST', '/auth/request', function () {
    global $config;
    $data = body(); required($data, ['email']);
    if (!is_string($data['email']) || strlen(trim($data['email'])) > 254 || !filter_var(trim($data['email']), FILTER_VALIDATE_EMAIL)) fail(422, 'validation', 'Enter a valid email address.', ['email' => 'invalid']);
    $email = strtolower(trim($data['email']));
    // Return the same shape even when throttled, suspended, or delivery fails.
    $requestId = bin2hex(random_bytes(32));
    $result = ['ok' => true, 'request_id' => $requestId];
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    $ipAllowed = take_rate_limit('auth-ip:' . $ip, 30, 3600);
    // A per-address/IP quota keeps one requester from using up an address's whole hourly quota.
    $emailAllowed = $ipAllowed && take_rate_limit('auth-email-ip:' . $email . '|' . $ip, 5, 3600) && take_rate_limit('auth-email:' . $email, 20, 3600);
    $locked = rate_limit_reached('login-failures:' . $email, LOGIN_FAILURE_LIMIT, LOGIN_FAILURE_WINDOW);
    $user = one('SELECT * FROM users WHERE email=?', [$email]);
    if ($emailAllowed && $ipAllowed && !$locked && !($user['suspended'] ?? false)) {
        $code = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
        db()->exec('BEGIN IMMEDIATE');
        try {
            query('DELETE FROM login_codes WHERE expires_at<?', [now()]);
            query('UPDATE login_codes SET used_at=? WHERE email=? AND used_at IS NULL', [now(), $email]);
            $id = insert('login_codes', ['email' => $email, 'request_hash' => hash('sha256', $requestId), 'code_hash' => hash('sha256', $requestId . ':' . $code), 'expires_at' => gmdate('Y-m-d\TH:i:s\Z', time() + 900)]);
            db()->exec('COMMIT');
        } catch (Throwable $error) { db()->exec('ROLLBACK'); throw $error; }
        try { send_login_mail($email, $code); }
        catch (MailDeliveryException $error) {
            query('DELETE FROM login_codes WHERE id=?',[$id]);
            // Never log codes, request IDs, or SMTP credentials.
            error_log('purpleroom: ' . $error->getMessage());
            json_response($result);
        }
        catch (Throwable $error) { query('DELETE FROM login_codes WHERE id=?', [$id]); throw $error; }
        if ($config['env'] === 'dev') $result['code'] = $code;
    }
    json_response($result);
}, true);
route('POST', '/auth/verify', function () {
    $data = body();
    if (!take_rate_limit('verify-ip:' . ($_SERVER['REMOTE_ADDR'] ?? 'unknown'), 100, 3600)) fail(429, 'rate_limited', 'Too many attempts. Please try again later.');
    if (!array_key_exists('token', $data)) {
        required($data, ['request_id', 'code']);
        if (!is_string($data['request_id']) || !preg_match('/^[a-f0-9]{64}$/D', $data['request_id']) || !is_string($data['code']) || !preg_match('/^[0-9]{6}$/D', $data['code'])) fail(422, 'validation', 'Enter the six-digit code from your email.');
        // Check session storage before consuming a code, without creating a session for wrong guesses.
        session_directory();
        $user = verify_login_code($data['request_id'], $data['code']);
        if (!$user) fail(422, 'invalid_code', 'That code is incorrect, expired, or no longer valid. Try again or request a new code.');
        login((int) $user['id']);
        json_response(['user' => private_user(require_login())]);
    }
    // Compatibility only: previously issued links and local CLI seed links.
    if (!is_string($data['token']) || !preg_match('/^[a-f0-9]{64}$/D', $data['token'])) fail(422, 'validation', 'Invalid token.');
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
    if (isset($_COOKIE['gr_session'])) { start_session(); end_session(); }
    json_response(null, 204);
}, true);
