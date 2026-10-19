<?php
declare(strict_types=1);
if (!defined('GREEN_ROOM')) exit;
const LOGIN_FAILURE_LIMIT = 20;
const LOGIN_FAILURE_WINDOW = 86400;
function session_directory(): string {
    $directory = dirname(__DIR__) . '/db/sessions';
    if (!is_dir($directory) && !@mkdir($directory, 0700, true) && !is_dir($directory)) fail(503, 'storage_unavailable', 'PHP cannot create its session directory. Check that api/db/ is writable by PHP.');
    if (!is_writable($directory)) fail(503, 'storage_unavailable', 'PHP cannot write sessions. Check the permissions of api/db/sessions/.');
    return $directory;
}
function start_session(): void {
    global $config;
    if (session_status() === PHP_SESSION_ACTIVE) return;
    $directory = session_directory();
    ini_set('session.gc_maxlifetime', '15552000');
    ini_set('session.use_strict_mode', '1');
    session_save_path($directory);
    session_name('gr_session');
    // Local HTTP cannot set a Secure cookie. Production always requires HTTPS.
    session_set_cookie_params(['lifetime' => 15552000, 'path' => '/', 'secure' => $config['env'] !== 'dev', 'httponly' => true, 'samesite' => 'Lax']);
    if (!@session_start()) {
        error_log('purpleroom: session_start failed. Check session-directory permissions and PHP session settings.');
        fail(503, 'storage_unavailable', 'PHP could not start a session. Check session-directory permissions and PHP session settings.');
    }
}
function end_session(): void {
    global $config;
    $_SESSION = []; session_destroy();
    setcookie('gr_session', '', ['expires' => time() - 3600, 'path' => '/', 'secure' => $config['env'] !== 'dev', 'httponly' => true, 'samesite' => 'Lax']);
}
function current_user(): ?array {
    // Anonymous requests must not create session files; only login() starts a new session.
    if (session_status() !== PHP_SESSION_ACTIVE && !isset($_COOKIE['gr_session'])) return null;
    start_session();
    if (!isset($_SESSION['user_id'])) { end_session(); return null; }
    $user = isset($_SESSION['user_id']) ? one('SELECT * FROM users WHERE id = ?', [$_SESSION['user_id']]) : null;
    if (!$user || ($user['suspended'] ?? 0) || ($_SESSION['session_version'] ?? 0) !== ($user['session_version'] ?? 0)) return null;
    return $user;
}
function require_login(): array { return current_user() ?? fail(401, 'unauthenticated', 'Please sign in to purpleroom.'); }
function login(int $id): void {
    $user = one('SELECT * FROM users WHERE id=? AND suspended=0', [$id]);
    if (!$user) fail(401, 'unauthenticated', 'This account cannot sign in.');
    start_session(); session_regenerate_id(true); $_SESSION = ['user_id' => $id, 'session_version' => (int)$user['session_version']];
}
function public_user(array $user): array { return array_intersect_key($user, array_flip(['id', 'name', 'avatar_url'])); }
function user_by_id(int $id): array { return public_user(one('SELECT id, name, avatar_url FROM users WHERE id = ?', [$id])); }
function private_user(array $user): array { return array_intersect_key($user, array_flip(['id','name','avatar_url','email','role','profile_complete',...PROFILE_LINK_FIELDS])); }

function verify_login_code(string $requestId, string $code): ?array {
    db()->exec('BEGIN IMMEDIATE');
    try {
        $pending = one('SELECT * FROM login_codes WHERE request_hash=? AND used_at IS NULL AND expires_at>? AND attempts<5', [hash('sha256', $requestId), now()]);
        $user = null;
        // Every wrong guess for an address counts against one budget, across all of its request IDs.
        $failures = $pending ? 'login-failures:' . $pending['email'] : null;
        if ($pending && !rate_limit_reached($failures, LOGIN_FAILURE_LIMIT, LOGIN_FAILURE_WINDOW)) {
            query('UPDATE login_codes SET attempts=attempts+1 WHERE id=?', [$pending['id']]);
            if (!hash_equals($pending['code_hash'], hash('sha256', $requestId . ':' . $code))) take_rate_limit($failures, LOGIN_FAILURE_LIMIT, LOGIN_FAILURE_WINDOW);
            else {
                $user = one('SELECT * FROM users WHERE email=?', [$pending['email']]);
                if (!$user) {
                    $id = insert('users', ['email'=>$pending['email'], 'name'=>'', 'profile_complete'=>0, 'cal_token'=>bin2hex(random_bytes(32))]);
                    $user = one('SELECT * FROM users WHERE id=?', [$id]);
                }
                query('UPDATE login_codes SET used_at=? WHERE id=?', [now(), $pending['id']]);
                if ($user['suspended']) $user = null;
            }
        }
        db()->exec('COMMIT');
        return $user;
    } catch (Throwable $error) { db()->exec('ROLLBACK'); throw $error; }
}
