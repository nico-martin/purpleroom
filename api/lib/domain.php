<?php
declare(strict_types=1);
if (!defined('GREEN_ROOM')) exit;
function conference(int $id): array {
    return one('SELECT * FROM conferences WHERE id = ? AND deleted_at IS NULL', [$id]) ?? fail(404, 'not_found', 'Conference not found.');
}
function edition(int $id): array {
    return one('SELECT e.* FROM editions e JOIN conferences c ON c.id=e.conference_id WHERE e.id=? AND e.deleted_at IS NULL AND c.deleted_at IS NULL', [$id]) ?? fail(404, 'not_found', 'Edition not found.');
}
function edition_label(array $edition, string $conferenceName): string {
    $title = trim($edition['title'] ?? '');
    if ($title === '') $title = $conferenceName;
    return $title;
}
function with_edition_legacy_year(array $data, ?array $existing = null): array {
    $merged = [...($existing ?? []), ...$data];
    $date = ($merged['starts_on'] ?? null) ?: ($merged['ends_on'] ?? null);
    // Keep the old NOT NULL column for compatibility, not as an edition's identity.
    // Dates are authoritative. Undated editions retain legacy metadata or use the current year.
    $data['year'] = $date ? (int) substr($date, 0, 4) : ($data['year'] ?? $existing['year'] ?? (int) gmdate('Y'));
    return $data;
}
function paper(int $id): array {
    return one('SELECT * FROM papers WHERE id=? AND owner_id=?', [$id, require_login()['id']]) ?? fail(404, 'not_found', 'Talk not found.');
}
function review_summary(int $id): array {
    $reviews = all('SELECT * FROM reviews WHERE conference_id=?', [$id]);
    $counts = []; $yes = 0; $no = 0;
    foreach ($reviews as $review) {
        foreach (json_decode($review['tags'], true) as $tag) $counts[$tag] = ($counts[$tag] ?? 0) + 1;
        if ($review['would_submit_again'] === 1) $yes++;
        if ($review['would_submit_again'] === 0) $no++;
    }
    return ['review_count' => count($reviews), 'tag_counts' => (object) $counts, 'would_submit_again' => ['yes' => $yes, 'no' => $no]];
}
function conference_summary(array $row): array {
    return [...$row, ...review_summary((int) $row['id']), 'next_edition' => one('SELECT * FROM editions WHERE conference_id=? AND deleted_at IS NULL AND starts_on >= ? ORDER BY starts_on LIMIT 1', [$row['id'], gmdate('Y-m-d')])];
}
function comments_for(string $target, int $id): array {
    return array_map(fn($row) => [...$row, 'user' => user_by_id((int) $row['user_id'])], all("SELECT * FROM comments WHERE $target=? ORDER BY created_at", [$id]));
}
function public_submissions(int $edition_id): array {
    $viewer = require_login()['id'];
    return array_map(function ($row) use ($viewer) {
        return ['id' => $row['id'], 'status' => $row['status'], 'user' => user_by_id((int) $row['owner_id']), 'paper_title' => $row['hide_title'] && $row['owner_id'] !== $viewer ? null : $row['title'], 'updated_at' => $row['updated_at']];
    }, all('SELECT s.*, p.title, p.owner_id FROM submissions s JOIN papers p ON p.id=s.paper_id WHERE s.edition_id=? ORDER BY s.created_at', [$edition_id]));
}
function attendance_for(int $id): array {
    return array_map(fn($row) => [...$row, 'user' => user_by_id((int) $row['user_id'])], all('SELECT * FROM attendance WHERE edition_id=?', [$id]));
}
function people_for(int $id): array {
    $speaking = []; $going = []; $maybe = [];
    foreach (public_submissions($id) as $s) {
        if (in_array($s['status'], ['accepted', 'confirmed', 'attended'], true)) $speaking[] = ['user' => $s['user'], 'status' => $s['status']];
        if (in_array($s['status'], ['confirmed', 'attended'], true)) $going[$s['user']['id']] = $s['user'];
        if ($s['status'] === 'accepted') $maybe[$s['user']['id']] = $s['user'];
    }
    foreach (attendance_for($id) as $a) {
        if ($a['status'] === 'going') $going[$a['user']['id']] = $a['user'];
        else $maybe[$a['user']['id']] = $a['user'];
    }
    return ['speaking' => $speaking, 'going' => array_values($going), 'maybe' => array_values(array_diff_key($maybe, $going))];
}
function validate_edition(array $data): void {
    if (isset($data['title']) && preg_match_all('/./us', $data['title']) > 500) fail(422, 'validation', 'Keep the edition title under 500 characters.', ['title' => 'too_long']);
    foreach ([['starts_on', 'ends_on'], ['cfp_opens_on', 'cfp_closes_on']] as [$start, $end]) {
        if (!empty($data[$start]) && !empty($data[$end]) && $data[$end] < $data[$start]) fail(422, 'validation', 'End date must be on or after the start date.', [$end => 'before_start']);
    }
    if (!empty($data['country']) && !preg_match('/^[A-Z]{2}$/', $data['country'])) fail(422, 'validation', 'Use a two-letter country code.', ['country' => 'invalid']);
}
