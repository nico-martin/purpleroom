<?php
declare(strict_types=1);
define('GREEN_ROOM', true);
$config = require __DIR__ . '/config.php';
foreach (['db', 'http', 'auth', 'router', 'constants', 'mail', 'dates', 'domain', 'social', 'migrations', 'remote', 'logos', 'profiles', 'accounts'] as $file) require __DIR__ . '/lib/' . $file . '.php';
header('X-Content-Type-Options: nosniff');
try {
    route('GET', '/health', fn() => json_response(['ok' => true]), true);
    foreach (['setup', 'auth', 'users', 'avatars', 'crew', 'admin', 'conferences', 'logos', 'editions', 'reviews', 'papers', 'submissions', 'attendance', 'dashboard'] as $file) require __DIR__ . '/routes/' . $file . '.php';
    dispatch();
} catch (AccountDeletionException $error) {
    fail($error->status, $error->reason, $error->getMessage());
} catch (ConferenceLogoException $error) {
    fail($error->status, 'logo_error', $error->getMessage(), ['logo_url' => 'invalid']);
} catch (AvatarException $error) {
    fail($error->status, 'avatar_error', $error->getMessage(), ['avatar_url' => 'invalid']);
} catch (PDOException $error) {
    error_log((string) $error);
    if (str_contains($error->getMessage(), 'no such table:')) fail(503, 'setup_required', 'The database schema is missing. The site owner must complete /setup before signing in. Existing installations may need a database migration.');
    if (str_contains($error->getMessage(), 'could not find driver')) fail(503, 'database_unavailable', 'PDO SQLite is not enabled. Enable the pdo_sqlite PHP extension in your hosting settings.');
    if (str_contains($error->getMessage(), 'unable to open database file') || str_contains($error->getMessage(), 'readonly database')) fail(503, 'storage_unavailable', 'PHP cannot open or write the database. Check that api/db/ and the database file are writable by PHP.');
    if (str_contains($error->getMessage(), 'UNIQUE constraint')) fail(409, 'conflict', 'This item already exists.');
    if (str_contains($error->getMessage(), 'FOREIGN KEY')) fail(422, 'validation', 'A related item does not exist.');
    fail(500, 'server_error', 'Something went wrong. Please try again.');
} catch (Throwable $error) {
    error_log((string) $error);
    fail(500, 'server_error', 'Something went wrong. Please try again.');
}
