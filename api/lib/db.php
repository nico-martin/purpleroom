<?php
declare(strict_types=1);
if (!defined('GREEN_ROOM')) exit;
function db(): PDO {
    static $connection;
    global $config;
    if (!$connection) {
        $connection = new PDO('sqlite:' . $config['database'], null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]);
        $connection->exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');
    }
    return $connection;
}
function query(string $sql, array $params = []): PDOStatement {
    $statement = db()->prepare($sql);
    $statement->execute($params);
    return $statement;
}
function one(string $sql, array $params = []): ?array { return query($sql, $params)->fetch() ?: null; }
function all(string $sql, array $params = []): array { return query($sql, $params)->fetchAll(); }
function now(): string { return gmdate('Y-m-d\TH:i:s\Z'); }
function insert(string $table, array $data): int {
    $columns = array_keys($data);
    query('INSERT INTO ' . $table . ' (' . implode(',', $columns) . ') VALUES (' . implode(',', array_fill(0, count($columns), '?')) . ')', array_values($data));
    return (int) db()->lastInsertId();
}
function update(string $table, int $id, array $data): void {
    if (!$data) return;
    query('UPDATE ' . $table . ' SET ' . implode(',', array_map(fn($key) => "$key = ?", array_keys($data))) . ' WHERE id = ?', [...array_values($data), $id]);
}
