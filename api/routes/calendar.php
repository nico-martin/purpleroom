<?php
if (!defined('GREEN_ROOM')) exit;
route('GET', '/cal/{token}\.ics', function ($p) {
    global $config;
    $user = one('SELECT * FROM users WHERE cal_token=?', [$p['token']]) ?? fail(404, 'not_found', 'Calendar not found.');
    $lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//purpleroom//Speaker calendar//EN', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:purpleroom'];
    foreach (all('SELECT e.*,c.name FROM editions e JOIN conferences c ON c.id=e.conference_id WHERE e.deleted_at IS NULL AND c.deleted_at IS NULL') as $e) {
        $name = edition_label($e, $e['name']); $link = $config['base_url'] . '/editions/' . $e['id'];
        if ($e['cfp_closes_on'] && $e['cfp_closes_on'] >= gmdate('Y-m-d')) $lines = [...$lines, ...ics_event('cfp-' . $e['id'], 'CFP closes: ' . $name, $e['cfp_closes_on'], gmdate('Y-m-d', strtotime($e['cfp_closes_on'] . ' +1 day')), $link, $e['updated_at'])];
        $speaks = one("SELECT s.id FROM submissions s JOIN papers p ON p.id=s.paper_id WHERE s.edition_id=? AND p.owner_id=? AND s.status IN ('accepted','confirmed','attended')", [$e['id'], $user['id']]);
        $going = one("SELECT id FROM attendance WHERE edition_id=? AND user_id=? AND status='going'", [$e['id'], $user['id']]);
        if (($speaks || $going) && $e['starts_on']) $lines = [...$lines, ...ics_event('conf-' . $e['id'], ($speaks ? '🎤 ' : '') . $name . ($e['city'] ? ' (' . $e['city'] . ')' : ''), $e['starts_on'], gmdate('Y-m-d', strtotime(($e['ends_on'] ?: $e['starts_on']) . ' +1 day')), $link, $e['updated_at'])];
    }
    $lines[] = 'END:VCALENDAR'; header('Content-Type: text/calendar; charset=utf-8'); header('Cache-Control: private, max-age=300'); echo implode("\r\n", array_map('ics_fold', $lines)) . "\r\n"; exit;
}, true);
