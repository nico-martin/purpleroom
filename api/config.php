<?php
declare(strict_types=1);
if (!defined('GREEN_ROOM')) exit;
$local = is_file(__DIR__ . '/config.local.php') ? require __DIR__ . '/config.local.php' : [];
return array_replace([
    'env' => getenv('GREEN_ROOM_ENV') ?: 'production',
    'base_url' => getenv('GREEN_ROOM_ENV') === 'dev' ? 'http://localhost:5173' : 'https://green-room.nico.dev',
    'mail_from' => 'Green Room <noreply@nico.dev>',
    'database' => getenv('GREEN_ROOM_DB') ?: __DIR__ . '/db/db.sqlite',
], $local);
