<?php
declare(strict_types=1);
if (!defined('GREEN_ROOM')) exit;

// The caller owns the transaction. Only trusted SQL files bundled with the app are applied.
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

function run_database_migrations(): array {
    db()->exec('BEGIN IMMEDIATE');
    try {
        $applied = apply_database_migrations();
        db()->exec('COMMIT');
        return $applied;
    } catch (Throwable $error) {
        db()->exec('ROLLBACK');
        throw $error;
    }
}

function ensure_database_migrations(): void {
    static $checked = false;
    if ($checked) return;
    $checked = true;
    // Never initialize an installation implicitly or bypass the first-user setup key.
    if (!one("SELECT name FROM sqlite_master WHERE type='table' AND name='schema_migrations'")) return;
    $versions = array_map('intval', array_column(all('SELECT version FROM schema_migrations'), 'version'));
    $files = glob(dirname(__DIR__) . '/db/migrations/*.sql') ?: [];
    $pending = array_filter($files, fn($file) => !in_array((int) basename($file), $versions, true));
    if (!$pending) return;
    // Recheck the migration ledger under a write lock so concurrent requests cannot ALTER twice.
    run_database_migrations();
}
