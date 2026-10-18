<?php
declare(strict_types=1);
if (!defined('GREEN_ROOM')) exit;
function start_session(): void {
    global $config;
    if (session_status() === PHP_SESSION_ACTIVE) return;
    $directory = dirname(__DIR__) . '/db/sessions';
    if (!is_dir($directory) && !@mkdir($directory, 0700, true) && !is_dir($directory)) fail(503, 'storage_unavailable', 'PHP cannot create its session directory. Check that api/db/ is writable by PHP.');
    if (!is_writable($directory)) fail(503, 'storage_unavailable', 'PHP cannot write sessions. Check the permissions of api/db/sessions/.');
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
function current_user(): ?array {
    start_session();
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
function private_user(array $user): array { return array_intersect_key($user, array_flip(['id','name','avatar_url','email','role','profile_complete'])); }
