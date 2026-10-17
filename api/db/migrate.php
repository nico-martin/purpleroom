<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(403); exit; }
define('GREEN_ROOM', true);
$config = require dirname(__DIR__) . '/config.php';
require dirname(__DIR__) . '/lib/db.php';
if (!one("SELECT name FROM sqlite_master WHERE type='table' AND name='schema_migrations'")) {
    db()->beginTransaction();
    db()->exec(file_get_contents(__DIR__ . '/schema.sql'));
    query('INSERT INTO schema_migrations (version, applied_at) VALUES (1, ?)', [now()]);
    db()->commit();
    echo "Applied schema version 1.\n";
}
$files = glob(__DIR__ . '/migrations/*.sql') ?: [];
sort($files);
foreach ($files as $file) {
    $version = (int) basename($file);
    if (one('SELECT version FROM schema_migrations WHERE version = ?', [$version])) continue;
    db()->beginTransaction();
    db()->exec(file_get_contents($file));
    query('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)', [$version, now()]);
    db()->commit();
    echo "Applied migration $version.\n";
}
echo "Database is up to date.\n";
