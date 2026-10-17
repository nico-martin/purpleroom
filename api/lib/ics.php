<?php
if (!defined('GREEN_ROOM')) exit;
function ics_escape(string $text): string { return str_replace(["\\", "\r\n", "\n", "\r", ';', ','], ['\\\\', '\\n', '\\n', '\\n', '\\;', '\\,'], $text); }
function ics_fold(string $line): string {
    $lines = []; $limit = 75;
    while (strlen($line) > $limit) {
        $cut = $limit;
        while ($cut > 0 && (ord($line[$cut]) & 0xC0) === 0x80) $cut--;
        $lines[] = substr($line, 0, $cut); $line = substr($line, $cut); $limit = 74;
    }
    $lines[] = $line; return implode("\r\n ", $lines);
}
function ics_event(string $uid, string $title, string $start, string $end, string $link, string $updated): array {
    return ['BEGIN:VEVENT', 'UID:' . $uid . '@green-room.nico.dev', 'DTSTAMP:' . gmdate('Ymd\THis\Z', strtotime($updated)), 'DTSTART;VALUE=DATE:' . str_replace('-', '', $start), 'DTEND;VALUE=DATE:' . str_replace('-', '', $end), 'SUMMARY:' . ics_escape($title), 'URL:' . $link, 'END:VEVENT'];
}
