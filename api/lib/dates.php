<?php
declare(strict_types=1);
if (!defined('GREEN_ROOM')) exit;

const EDITION_TIMEZONE_FIELDS = ['starts_timezone','ends_timezone','cfp_opens_timezone','cfp_closes_timezone'];

function validate_timezone(?string $zone, string $field): void {
    static $valid;
    $valid ??= array_fill_keys(DateTimeZone::listIdentifiers(DateTimeZone::ALL_WITH_BC),true);
    if ($zone !== null && ($zone !== 'UTC' && (!str_contains($zone,'/') || !isset($valid[$zone])))) fail(422,'validation','Choose a valid IANA timezone, such as Europe/Zurich.',[$field=>'invalid_timezone']);
}

function local_datetime_utc(string $date, string $time, string $zone, string $field): string {
    $timezone = new DateTimeZone($zone);
    $wall = $date . ' ' . $time;
    $parsed = DateTimeImmutable::createFromFormat('!Y-m-d H:i',$wall,$timezone);
    if (!$parsed || $parsed->format('Y-m-d H:i') !== $wall) fail(422,'validation','This local date/time does not exist in that timezone. Choose another time or timezone.',[$field=>'nonexistent_time']);
    // A repeated fall-back hour has two possible instants. Never silently pick one.
    $localStamp = DateTimeImmutable::createFromFormat('!Y-m-d H:i',$wall,new DateTimeZone('UTC'))->getTimestamp();
    $matches = [];
    foreach ($timezone->getTransitions($parsed->getTimestamp()-172800,$parsed->getTimestamp()+172800) ?: [] as $transition) {
        $candidate = $localStamp - $transition['offset'];
        if ((new DateTimeImmutable('@'.$candidate))->setTimezone($timezone)->format('Y-m-d H:i') === $wall) $matches[$candidate] = true;
    }
    if (count($matches)>1) fail(422,'validation','This time occurs twice because of daylight saving. Choose an unambiguous time, or specify the deadline in UTC.',[$field=>'ambiguous_time']);
    return $parsed->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d\TH:i:s\Z');
}

function edition_date_fields(array $data, array $existing = []): array {
    foreach (EDITION_TIMEZONE_FIELDS as $key) if (array_key_exists($key,$data)) validate_timezone($data[$key],$key);
    if (isset($data['cfp_closes_time']) && !preg_match('/^(?:[01][0-9]|2[0-3]):[0-5][0-9]$/D',$data['cfp_closes_time'])) fail(422,'validation','Use a closing time in HH:MM format.', ['cfp_closes_time'=>'invalid_time']);
    $merged = [...$existing,...$data];
    foreach (['opens','closes'] as $edge) {
        $date = $merged['cfp_'.$edge.'_on'] ?? null;
        $zone = $merged['cfp_'.$edge.'_timezone'] ?? null;
        $time = $edge === 'opens' ? '00:00' : ($merged['cfp_closes_time'] ?? '23:59');
        if ($date && $zone) {
            $data['cfp_'.$edge.'_at'] = local_datetime_utc($date,$time,$zone,'cfp_'.$edge.'_on');
            if ($edge === 'closes') $data['cfp_closes_time'] = $time;
        } else {
            $data['cfp_'.$edge.'_at'] = null;
            if ($edge === 'closes' && $date && !$zone && !empty($merged['cfp_closes_time'])) fail(422,'validation','Choose a timezone for the closing time.', ['cfp_closes_timezone'=>'required']);
        }
    }
    $merged = [...$merged,...$data];
    if (!empty($merged['cfp_opens_at']) && !empty($merged['cfp_closes_at']) && $merged['cfp_closes_at'] < $merged['cfp_opens_at']) fail(422,'validation','The CFP must close after it opens, accounting for timezones.', ['cfp_closes_on'=>'before_start']);
    return $data;
}

function cfp_open_sql(string $alias = ''): string {
    $p = $alias === '' ? '' : $alias . '.';
    return "({$p}cfp_closes_at>=? OR ({$p}cfp_closes_at IS NULL AND {$p}cfp_closes_on>=?)) AND ({$p}cfp_opens_on IS NULL OR {$p}cfp_opens_at<=? OR ({$p}cfp_opens_at IS NULL AND {$p}cfp_opens_on<=?))";
}
function cfp_open_params(?string $instant = null): array {
    $instant ??= now(); $date = substr($instant,0,10);
    return [$instant,$date,$instant,$date];
}
function cfp_days_left(array $edition, ?string $instant = null): int {
    $instant ??= now();
    $zone = new DateTimeZone($edition['cfp_closes_timezone'] ?? 'UTC');
    $today = (new DateTimeImmutable($instant))->setTimezone($zone)->format('Y-m-d');
    return (int) (new DateTimeImmutable($today,new DateTimeZone('UTC')))->diff(new DateTimeImmutable($edition['cfp_closes_on'],new DateTimeZone('UTC')))->format('%r%a');
}
