<?php
declare(strict_types=1);
define('GREEN_ROOM', true);
$config = require __DIR__ . '/config.php';
foreach (['db', 'http', 'auth', 'router', 'constants', 'mail', 'domain', 'ics'] as $file) require __DIR__ . '/lib/' . $file . '.php';
header('X-Content-Type-Options: nosniff');
try {
    route('GET', '/health', fn() => json_response(['ok' => true]), true);
    foreach (['auth', 'users', 'invites', 'conferences', 'editions', 'reviews', 'papers', 'submissions', 'attendance', 'comments', 'dashboard', 'calendar'] as $file) require __DIR__ . '/routes/' . $file . '.php';
    dispatch();
} catch (PDOException $error) {
    error_log((string) $error);
    if (str_contains($error->getMessage(), 'UNIQUE constraint')) fail(409, 'conflict', 'This item already exists.');
    if (str_contains($error->getMessage(), 'FOREIGN KEY')) fail(422, 'validation', 'A related item does not exist.');
    fail(500, 'server_error', 'Something went wrong. Please try again.');
} catch (Throwable $error) {
    error_log((string) $error);
    fail(500, 'server_error', 'Something went wrong. Please try again.');
}
