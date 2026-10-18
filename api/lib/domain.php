<?php
declare(strict_types=1);
if (!defined('GREEN_ROOM')) exit;
function conference(int $id): array {
    return conference_record(one('SELECT * FROM conferences WHERE id = ? AND deleted_at IS NULL', [$id]) ?? fail(404, 'not_found', 'Conference not found.'));
}
function conference_record(array $row): array {
    return [...$row,'tags'=>is_array($row['tags'] ?? null) ? $row['tags'] : json_decode($row['tags'] ?? '[]',true,64,JSON_THROW_ON_ERROR)];
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
    $reviews = visible_reviews($id);
    $counts = []; $yes = 0; $no = 0;
    foreach ($reviews as $review) {
        foreach (json_decode($review['tags'], true) as $tag) $counts[$tag] = ($counts[$tag] ?? 0) + 1;
        if ($review['would_submit_again'] === 1) $yes++;
        if ($review['would_submit_again'] === 0) $no++;
    }
    return ['review_count' => count($reviews), 'tag_counts' => (object) $counts, 'would_submit_again' => ['yes' => $yes, 'no' => $no]];
}
function visible_reviews(int $id): array {
    $ids = visible_user_ids();
    return all('SELECT * FROM reviews WHERE conference_id=? AND user_id IN (' . id_placeholders($ids) . ') ORDER BY updated_at DESC', [$id,...$ids]);
}
function conference_summary(array $row): array {
    $today=gmdate('Y-m-d');
    return [...conference_record($row), ...review_summary((int) $row['id']), 'next_edition' => one('SELECT * FROM editions WHERE conference_id=? AND deleted_at IS NULL AND starts_on >= ? ORDER BY starts_on,id LIMIT 1', [$row['id'], $today]), 'has_open_cfp'=>(bool)one('SELECT id FROM editions WHERE conference_id=? AND deleted_at IS NULL AND cfp_closes_on>=? AND (cfp_opens_on IS NULL OR cfp_opens_on<=?) LIMIT 1',[$row['id'],$today,$today])];
}
function attendance_for(int $id): array {
    $ids = visible_user_ids();
    return array_map(fn($row) => [...$row, 'user' => user_by_id((int) $row['user_id'])], all('SELECT * FROM attendance WHERE edition_id=? AND user_id IN (' . id_placeholders($ids) . ')', [$id,...$ids]));
}
function people_for(int $id): array {
    $going = []; $maybe = [];
    foreach (attendance_for($id) as $a) {
        if ($a['status'] === 'going') $going[$a['user']['id']] = $a['user'];
        else $maybe[$a['user']['id']] = $a['user'];
    }
    return ['going' => array_values($going), 'maybe' => array_values($maybe)];
}
function validate_edition(array $data): void {
    if (isset($data['title']) && preg_match_all('/./us', $data['title']) > 500) fail(422, 'validation', 'Keep the edition title under 500 characters.', ['title' => 'too_long']);
    foreach ([['starts_on', 'ends_on'], ['cfp_opens_on', 'cfp_closes_on']] as [$start, $end]) {
        if (!empty($data[$start]) && !empty($data[$end]) && $data[$end] < $data[$start]) fail(422, 'validation', 'End date must be on or after the start date.', [$end => 'before_start']);
    }
    if (!empty($data['country']) && !preg_match('/^[A-Z]{2}$/', $data['country'])) fail(422, 'validation', 'Use a two-letter country code.', ['country' => 'invalid']);
}
