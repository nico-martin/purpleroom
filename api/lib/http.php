<?php
declare(strict_types=1);
if (!defined('GREEN_ROOM')) exit;
function json_response(mixed $data = null, int $status = 200): never {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    if ($status !== 204) echo json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
    exit;
}
function fail(int $status, string $code, string $message, array $fields = []): never {
    json_response(['error' => ['code' => $code, 'message' => $message, 'fields' => (object) $fields]], $status);
}
function body(): array {
    static $body;
    if ($body !== null) return $body;
    if ((int) ($_SERVER['CONTENT_LENGTH'] ?? 0) > 1048576) fail(400, 'too_large', 'Request is too large.');
    $raw = file_get_contents('php://input', false, null, 0, 1048577);
    if (strlen($raw) > 1048576) fail(400, 'too_large', 'Request is too large.');
    try { $value = json_decode($raw, true, 64, JSON_THROW_ON_ERROR); }
    catch (JsonException) { fail(400, 'malformed', 'Expected valid JSON.'); }
    if (!is_array($value) || array_is_list($value) && $value !== []) fail(400, 'malformed', 'Expected a JSON object.');
    return $body = $value;
}
function required(array $data, array $keys): void {
    $fields = [];
    foreach ($keys as $key) if (!isset($data[$key]) || is_string($data[$key]) && trim($data[$key]) === '') $fields[$key] = 'required';
    if ($fields) fail(422, 'validation', 'Please fill in the required fields.', $fields);
}
function fields(array $data, array $keys): array {
    $result = array_intersect_key($data, array_flip($keys));
    foreach ($result as $key => &$value) {
        if (in_array($key, ['online', 'hide_title'], true)) {
            if (!in_array($value, [true, false, 0, 1], true)) fail(422, 'validation', 'Invalid boolean.', [$key => 'invalid']);
            $value = (int) $value;
        } elseif (in_array($key, ['year', 'conference_id', 'edition_id', 'paper_id'], true)) {
            if (filter_var($value, FILTER_VALIDATE_INT) === false || (int) $value < 1) fail(422, 'validation', 'Invalid number.', [$key => 'invalid']);
            $value = (int) $value;
        } else {
            if ($value !== null && !is_string($value)) fail(422, 'validation', 'Expected text.', [$key => 'invalid']);
            if (is_string($value)) $value = trim($value);
            if ($value === '' && !in_array($key, ['name', 'title', 'text'], true)) $value = null;
            if ($value !== null && strlen($value) > 100000) fail(422, 'validation', 'Text is too long.', [$key => 'too_long']);
            if (in_array($key, ['website', 'logo_url', 'avatar_url', 'cfp_url'], true) && $value !== null && (!filter_var($value, FILTER_VALIDATE_URL) || !in_array(strtolower(parse_url($value, PHP_URL_SCHEME) ?: ''), ['http', 'https'], true))) fail(422, 'validation', 'Use an http or https URL.', [$key => 'invalid_url']);
            if ((str_ends_with($key, '_on')) && $value !== null) {
                $date = DateTimeImmutable::createFromFormat('!Y-m-d', $value);
                if (!$date || $date->format('Y-m-d') !== $value) fail(422, 'validation', 'Use a valid date.', [$key => 'invalid_date']);
            }
        }
    }
    return $result;
}
