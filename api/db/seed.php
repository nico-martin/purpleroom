<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(403); exit; }
define('GREEN_ROOM', true);
$config = require dirname(__DIR__) . '/config.php';
require dirname(__DIR__) . '/lib/db.php';
if (count($argv) < 3 || !filter_var($argv[2], FILTER_VALIDATE_EMAIL)) {
    fwrite(STDERR, "Usage: php api/db/seed.php \"Name\" email@example.com\n"); exit(1);
}
$user = one('SELECT * FROM users WHERE email = ?', [$argv[2]]);
$id = $user['id'] ?? insert('users', ['name' => $argv[1], 'email' => $argv[2], 'cal_token' => bin2hex(random_bytes(32))]);
$token = bin2hex(random_bytes(32));
insert('login_tokens', ['user_id' => $id, 'token_hash' => hash('sha256', $token), 'expires_at' => gmdate('Y-m-d\TH:i:s\Z', time() + 900)]);
echo "One-time login link (valid for 15 minutes):\n" . $config['base_url'] . '/auth/' . $token . "\n";
