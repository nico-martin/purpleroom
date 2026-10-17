<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(403); exit; }
define('GREEN_ROOM', true);
$config = require dirname(__DIR__) . '/config.php';
require dirname(__DIR__) . '/lib/db.php';
require dirname(__DIR__) . '/lib/migrations.php';
try {
    $versions = run_database_migrations();
    foreach ($versions as $version) echo "Applied migration $version.\n";
    echo "Database is up to date.\n";
} catch (Throwable $error) {
    fwrite(STDERR, $error->getMessage() . "\n");
    exit(1);
}
