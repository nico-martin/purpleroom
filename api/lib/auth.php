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
        error_log('Green Room: session_start failed. Check session-directory permissions and PHP session settings.');
        fail(503, 'storage_unavailable', 'PHP could not start a session. Check session-directory permissions and PHP session settings.');
    }
}
function current_user(): ?array {
    start_session();
    return isset($_SESSION['user_id']) ? one('SELECT * FROM users WHERE id = ?', [$_SESSION['user_id']]) : null;
}
function require_login(): array { return current_user() ?? fail(401, 'unauthenticated', 'Please sign in to the Green Room.'); }
function login(int $id): void { start_session(); session_regenerate_id(true); $_SESSION['user_id'] = $id; }
function public_user(array $user): array { return array_intersect_key($user, array_flip(['id', 'name', 'avatar_url'])); }
function user_by_id(int $id): array { return public_user(one('SELECT id, name, avatar_url FROM users WHERE id = ?', [$id])); }
function cal_url(array $user): string { global $config; return $config['base_url'] . '/api/cal/' . $user['cal_token'] . '.ics'; }
function private_user(array $user): array { unset($user['cal_token']); return $user; }
