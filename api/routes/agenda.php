<?php
if (!defined('GREEN_ROOM')) exit;
// Owner-only, admins included: never accept a user ID, branch on role, or join submissions.
route('GET', '/me/agenda', function () {
    $rows = all('SELECT a.status,e.id,e.title,e.starts_on,e.ends_on,e.starts_timezone,e.ends_timezone,e.city,e.country,e.online,e.conference_id,c.name AS conference_name FROM attendance a JOIN editions e ON e.id=a.edition_id JOIN conferences c ON c.id=e.conference_id WHERE a.user_id=? AND e.deleted_at IS NULL AND c.deleted_at IS NULL AND (COALESCE(e.ends_on,e.starts_on) >= ? OR COALESCE(e.ends_on,e.starts_on) IS NULL) ORDER BY COALESCE(e.starts_on,e.ends_on) IS NULL, COALESCE(e.starts_on,e.ends_on), e.id', [(int) require_login()['id'], gmdate('Y-m-d')]);
    $plans = array_map(fn($r) => [
        'status' => $r['status'],
        'edition' => ['id'=>(int)$r['id'],'title'=>$r['title'],'starts_on'=>$r['starts_on'],'ends_on'=>$r['ends_on'],'starts_timezone'=>$r['starts_timezone'],'ends_timezone'=>$r['ends_timezone'],'city'=>$r['city'],'country'=>$r['country'],'online'=>(int)$r['online'],'conference_id'=>(int)$r['conference_id']],
        'conference' => ['id'=>(int)$r['conference_id'],'name'=>$r['conference_name']],
        'conflicts' => [],
    ], $rows);
    // ponytail: O(n²) pairwise check; fine for one member's plans, sort-and-sweep if agendas grow to thousands.
    // Inclusive calendar-day overlap; a one-date edition is a single day; undated plans are never flagged.
    $range = fn($e) => [$e['starts_on'] ?? $e['ends_on'], $e['ends_on'] ?? $e['starts_on']];
    foreach ($plans as $i => $a) {
        [$aStart, $aEnd] = $range($a['edition']);
        if ($aStart === null) continue;
        foreach ($plans as $j => $b) {
            if ($i === $j) continue;
            [$bStart, $bEnd] = $range($b['edition']);
            if ($bStart === null || $aStart > $bEnd || $bStart > $aEnd) continue;
            $plans[$i]['conflicts'][] = ['edition_id'=>$b['edition']['id'],'label'=>edition_label($b['edition'], $b['conference']['name']),'status'=>$b['status']];
        }
    }
    json_response(['plans' => $plans]);
});
