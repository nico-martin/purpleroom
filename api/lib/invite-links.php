<?php
declare(strict_types=1);
if (!defined('GREEN_ROOM')) exit;

class InviteLinkStorageException extends RuntimeException {}

function invite_link_directory(): string { global $config; return dirname($config['database']) . '/invite-links'; }
function invite_link_path(array $invite): string { return invite_link_directory() . '/' . (int) $invite['id'] . '-' . $invite['token_hash'] . '.json'; }
function invite_link_aad(array $invite): string { return 'green-room-invite:' . (int) $invite['id'] . ':' . $invite['token_hash']; }

function invite_link_key(bool $create): ?string {
    $directory = invite_link_directory(); $path = $directory . '/key.bin';
    if (!$create && !is_file($path)) return null;
    if (!is_dir($directory) && !@mkdir($directory, 0700, true) && !is_dir($directory)) throw new InviteLinkStorageException('PHP cannot create private invite-link storage. Check that api/db/ is writable by PHP.');
    $lock = @fopen($directory . '/.key.lock', 'c+b');
    if (!$lock) throw new InviteLinkStorageException('PHP cannot access private invite-link storage. Check directory permissions.');
    try {
        if (!flock($lock, LOCK_EX)) throw new InviteLinkStorageException('Could not lock private invite-link storage. Try again.');
        if (is_file($path)) {
            $key = @file_get_contents($path);
            if ($key === false || strlen($key) !== 32) throw new InviteLinkStorageException('The invite-link encryption key is unreadable or invalid. Restore it from a server backup.');
            return $key;
        }
        if (!$create) return null;
        $key = random_bytes(32);
        invite_link_write($path, $key);
        return $key;
    } finally { flock($lock, LOCK_UN); fclose($lock); }
}

function invite_link_write(string $path, string $bytes): void {
    $temporary = @tempnam(dirname($path), '.invite-');
    if ($temporary === false) throw new InviteLinkStorageException('PHP cannot write private invite-link storage. Check directory permissions.');
    try {
        if (realpath(dirname($temporary)) !== realpath(dirname($path))) throw new InviteLinkStorageException('PHP cannot write private invite-link storage. Check directory permissions.');
        @chmod($temporary, 0600);
        if (@file_put_contents($temporary, $bytes) !== strlen($bytes) || !@rename($temporary, $path)) throw new InviteLinkStorageException('Could not save the encrypted invite link. Check storage permissions.');
    } finally { if (is_file($temporary)) @unlink($temporary); }
}

function store_invite_link(array $invite, string $token): void {
    if (!function_exists('openssl_encrypt')) throw new InviteLinkStorageException('Enable the PHP OpenSSL extension to store copyable invite links.');
    $key = invite_link_key(true); $iv = random_bytes(12); $tag = '';
    $ciphertext = @openssl_encrypt($token, 'aes-256-gcm', $key, OPENSSL_RAW_DATA, $iv, $tag, invite_link_aad($invite), 16);
    if ($ciphertext === false) throw new InviteLinkStorageException('Could not encrypt the invite link. Check PHP OpenSSL support.');
    invite_link_write(invite_link_path($invite), json_encode(['version' => 1, 'iv' => base64_encode($iv), 'tag' => base64_encode($tag), 'ciphertext' => base64_encode($ciphertext)], JSON_THROW_ON_ERROR));
}

function recover_invite_link(array $invite): ?string {
    global $config;
    if (!function_exists('openssl_decrypt') || !is_file(invite_link_path($invite))) return null;
    try { $key = invite_link_key(false); }
    catch (InviteLinkStorageException) { return null; }
    if ($key === null) return null;
    $raw = @file_get_contents(invite_link_path($invite), false, null, 0, 4096);
    $payload = $raw === false ? null : json_decode($raw, true);
    if (!is_array($payload) || ($payload['version'] ?? null) !== 1) return null;
    $decoded = [];
    foreach (['iv', 'tag', 'ciphertext'] as $field) {
        if (!is_string($payload[$field] ?? null)) return null;
        $decoded[$field] = base64_decode($payload[$field], true);
        if ($decoded[$field] === false) return null;
    }
    if (strlen($decoded['iv']) !== 12 || strlen($decoded['tag']) !== 16) return null;
    $token = @openssl_decrypt($decoded['ciphertext'], 'aes-256-gcm', $key, OPENSSL_RAW_DATA, $decoded['iv'], $decoded['tag'], invite_link_aad($invite));
    if ($token === false || !preg_match('/^[a-f0-9]{64}$/D', $token) || !hash_equals($invite['token_hash'], hash('sha256', $token))) return null;
    return $config['base_url'] . '/invite/' . $token;
}

function forget_invite_link(array $invite): void {
    $path = invite_link_path($invite);
    if (is_file($path) && !@unlink($path)) error_log('purpleroom: could not remove an encrypted invite-link payload. The database token is no longer valid.');
}
