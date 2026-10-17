<?php
declare(strict_types=1);
if (!defined('GREEN_ROOM')) exit;

// The caller owns the transaction. Web setup may use this only before any user exists.
function apply_database_migrations(): array {
    $applied = [];
    if (!one("SELECT name FROM sqlite_master WHERE type='table' AND name='schema_migrations'")) {
        $tables = all("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
        if ($tables) throw new RuntimeException('Database contains tables but has no migration history. Refusing to overwrite it.');
        db()->exec(file_get_contents(dirname(__DIR__) . '/db/schema.sql'));
        query('INSERT INTO schema_migrations (version, applied_at) VALUES (1, ?)', [now()]);
        $applied[] = 1;
    }
    $files = glob(dirname(__DIR__) . '/db/migrations/*.sql') ?: [];
    sort($files);
    foreach ($files as $file) {
        $version = (int) basename($file);
        if (one('SELECT version FROM schema_migrations WHERE version = ?', [$version])) continue;
        db()->exec(file_get_contents($file));
        query('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)', [$version, now()]);
        $applied[] = $version;
    }
    return $applied;
}
