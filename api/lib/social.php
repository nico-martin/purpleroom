<?php
declare(strict_types=1);
if (!defined('GREEN_ROOM')) exit;

function require_admin(): array {
    $user = require_login();
    if ($user['role'] !== 'admin') fail(403, 'forbidden', 'Only admins can manage the catalog and accounts.');
    return $user;
}
function blocked_pair(int $a, int $b): bool {
    return (bool) one('SELECT 1 FROM blocks WHERE (user_id=? AND blocked_id=?) OR (user_id=? AND blocked_id=?)', [$a,$b,$b,$a]);
}
function friend_ids(?int $viewer = null): array {
    $viewer ??= (int) require_login()['id'];
    return array_map('intval', array_column(all("SELECT u.id FROM friendships f JOIN users u ON u.id=CASE WHEN f.user_low=? THEN f.user_high ELSE f.user_low END WHERE (f.user_low=? OR f.user_high=?) AND f.status='accepted' AND u.suspended=0 AND u.profile_complete=1 AND NOT EXISTS(SELECT 1 FROM blocks b WHERE (b.user_id=? AND b.blocked_id=u.id) OR (b.user_id=u.id AND b.blocked_id=?))", [$viewer,$viewer,$viewer,$viewer,$viewer]), 'id'));
}
function visible_user_ids(): array { return [(int) require_login()['id'], ...friend_ids()]; }
function id_placeholders(array $ids): string { return implode(',', array_fill(0, count($ids), '?')); }
function member_target(int $id): array {
    $viewer = (int) require_login()['id'];
    $user = one('SELECT * FROM users WHERE id=? AND suspended=0 AND profile_complete=1', [$id]);
    if (!$user || blocked_pair($viewer, $id)) fail(404, 'not_found', 'Member not found.');
    return $user;
}
function friendship_state(int $id): string {
    $viewer = (int) require_login()['id'];
    if ($id === $viewer) return 'self';
    $f = one('SELECT * FROM friendships WHERE user_low=? AND user_high=?', [min($viewer,$id),max($viewer,$id)]);
    if (!$f) return 'none';
    return $f['status'] === 'accepted' ? 'friend' : ($f['requested_by'] === $viewer ? 'outgoing' : 'incoming');
}
// Atomic fixed-window limits. Hash keys so email addresses/IPs are not retained in this table.
function take_rate_limit(string $key, int $maximum, int $seconds): bool {
    $time = time(); $hash = hash('sha256', $key);
    query('DELETE FROM rate_limits WHERE window_start<?', [$time - 86400]);
    query('INSERT INTO rate_limits(key_hash,window_start,attempts) VALUES(?,?,1) ON CONFLICT(key_hash) DO UPDATE SET attempts=CASE WHEN window_start<=? THEN 1 ELSE attempts+1 END, window_start=CASE WHEN window_start<=? THEN excluded.window_start ELSE window_start END', [$hash,$time,$time-$seconds,$time-$seconds]);
    return (int) one('SELECT attempts FROM rate_limits WHERE key_hash=?', [$hash])['attempts'] <= $maximum;
}
function submitted_friends(int $edition): array {
    $ids = friend_ids();
    if (!$ids) return [];
    return all('SELECT DISTINCT u.id,u.name,u.avatar_url FROM submissions s JOIN papers p ON p.id=s.paper_id JOIN users u ON u.id=p.owner_id WHERE s.edition_id=? AND s.status<>\'interested\' AND u.id IN (' . id_placeholders($ids) . ') ORDER BY u.name,u.id', [$edition,...$ids]);
}
