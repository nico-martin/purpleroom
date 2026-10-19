<?php
declare(strict_types=1);
if (!defined('GREEN_ROOM')) exit;
$local = is_file(__DIR__ . '/config.local.php') ? require __DIR__ . '/config.local.php' : [];
return array_replace([
    'env' => getenv('PURPLEROOM_ENV') ?: 'production',
    'base_url' => getenv('PURPLEROOM_ENV') === 'dev' ? 'http://localhost:5173' : 'https://greenroom.nico.dev',
    'mail_from' => 'purpleroom <noreply@nico.dev>',
    'smtp_host' => getenv('SMTP_HOST') ?: null,
    'smtp_port' => (int)(getenv('SMTP_PORT') ?: (getenv('SMTP_ENCRYPTION') === 'ssl' ? 465 : 587)),
    'smtp_username' => getenv('SMTP_USERNAME') ?: null,
    'smtp_password' => getenv('SMTP_PASSWORD') ?: null,
    'smtp_encryption' => getenv('SMTP_ENCRYPTION') ?: 'tls',
    'database' => getenv('GREEN_ROOM_DB') ?: __DIR__ . '/db/db.sqlite',
    // Disabled unless explicitly configured; remove this key after first-user setup.
    'setup_key' => getenv('GREEN_ROOM_SETUP_KEY') ?: null,
], $local);
