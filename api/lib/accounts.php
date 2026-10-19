<?php
declare(strict_types=1);
if (!defined('GREEN_ROOM')) exit;

class AccountDeletionException extends RuntimeException {
    public function __construct(string $message, public readonly int $status = 503, public readonly string $reason = 'account_deletion_failed') { parent::__construct($message); }
}

function account_avatar_files(int $id): array {
    $directory = avatar_directory() . '/' . $id;
    if (is_link($directory)) throw new AccountDeletionException('Profile image storage needs attention. Please contact the site owner before deleting your account.');
    if (!is_dir($directory)) return [];
    $entries = @scandir($directory);
    if ($entries === false) throw new AccountDeletionException('Profile images could not be checked. Please try again or contact the site owner.');
    $files = [];
    foreach ($entries as $name) {
        if (!preg_match('/^(?:avatar-[a-f0-9]{16}\.(?:png|jpg|gif|webp|avif|ico|svg)|\.avatar-[a-zA-Z0-9]+)$/D', $name)) continue;
        if (is_dir($directory . '/' . $name) && !is_link($directory . '/' . $name)) throw new AccountDeletionException('Profile image storage needs attention. Please contact the site owner.');
        $files[] = 'avatars/' . $id . '/' . $name;
    }
    return $files;
}

function delete_own_account(array $account): void {
    db()->exec('BEGIN IMMEDIATE');
    try {
        // Recheck under the same write lock as role changes and other account deletions.
        $user = one('SELECT * FROM users WHERE id=? AND suspended=0 AND session_version=?', [$account['id'], $account['session_version']]);
        if (!$user) throw new AccountDeletionException('Please sign in again before deleting your account.',401,'unauthenticated');
        if ($user['role'] === 'admin' && (int) one("SELECT COUNT(*) AS n FROM users WHERE role='admin' AND suspended=0")['n'] <= 1) {
            throw new AccountDeletionException('You are the last active admin. Appoint another active admin before deleting your account.',409,'last_admin');
        }
        $id = (int) $user['id'];
        $files = account_avatar_files($id);
        $invites = all('SELECT id,token_hash FROM invites WHERE invited_by=? OR accepted_by=? OR email=? COLLATE NOCASE', [$id,$id,$user['email']]);
        foreach ($invites as $invite) {
            if (preg_match('/^[a-f0-9]{64}$/D', $invite['token_hash'])) $files[] = 'invite-links/' . $invite['id'] . '-' . $invite['token_hash'] . '.json';
        }
        foreach ($files as $path) query('INSERT OR IGNORE INTO account_deletion_files(path) VALUES(?)', [$path]);
        query('DELETE FROM invites WHERE invited_by=? OR accepted_by=? OR email=? COLLATE NOCASE', [$id,$id,$user['email']]);
        query('DELETE FROM friendships WHERE user_low=? OR user_high=? OR requested_by=?', [$id,$id,$id]);
        query('DELETE FROM blocks WHERE user_id=? OR blocked_id=?', [$id,$id]);
        query('DELETE FROM auth_requests WHERE email=? COLLATE NOCASE', [$user['email']]);
        query('DELETE FROM login_codes WHERE email=? COLLATE NOCASE', [$user['email']]);
        // Cascades remove proposals, linked/unassigned submissions, reviews, attendance,
        // retired comments, and legacy login tokens. Shared catalog creators become NULL.
        query('DELETE FROM users WHERE id=?', [$id]);
        db()->exec('COMMIT');
    } catch (Throwable $error) { db()->exec('ROLLBACK'); throw $error; }
    purge_deleted_account_files();
}

function purge_deleted_account_files(): void {
    global $config;
    // A durable outbox keeps failed filesystem removal retryable after DB commit.
    // Never traverse arbitrary paths, member-directory symlinks, or shared keys/logos.
    try {
        if (!one("SELECT name FROM sqlite_master WHERE type='table' AND name='account_deletion_files'")) return;
        foreach (all('SELECT path FROM account_deletion_files ORDER BY attempts,path LIMIT 50') as $row) {
            $path = $row['path'];
            // Rotate failures so one damaged directory cannot starve other members' cleanup.
            query('UPDATE account_deletion_files SET attempts=attempts+1 WHERE path=?', [$path]);
            if (!preg_match('#^(?:avatars/[1-9][0-9]*/(?:avatar-[a-f0-9]{16}\.(?:png|jpg|gif|webp|avif|ico|svg)|\.avatar-[a-zA-Z0-9]+)|invite-links/[1-9][0-9]*-[a-f0-9]{64}\.json)$#D', $path)) continue;
            $absolute = dirname($config['database']) . '/' . $path;
            if (is_link(dirname($absolute))) continue;
            if ((file_exists($absolute) || is_link($absolute)) && !@unlink($absolute) && (file_exists($absolute) || is_link($absolute))) {
                error_log('purpleroom: account file cleanup pending; check private storage permissions.');
                continue;
            }
            query('DELETE FROM account_deletion_files WHERE path=?', [$path]);
            if (str_starts_with($path,'avatars/')) @rmdir(dirname($absolute));
        }
    } catch (Throwable $error) { error_log('purpleroom: account file cleanup pending; check private storage and database availability.'); }
}
