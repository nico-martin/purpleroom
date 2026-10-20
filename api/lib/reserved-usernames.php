<?php
declare(strict_types=1);
if (!defined('GREEN_ROOM')) exit;

// Compared without dashes too, so purple-room and purple--room cannot impersonate the brand.
const RESERVED_USERNAMES = [
    'purpleroom', 'greenroom', 'example', 'admin', 'administrator', 'api',
    'auth', 'login', 'logout', 'setup', 'settings', 'support', 'help', 'security',
    'moderator', 'staff', 'team', 'official', 'root', 'system', 'null', 'undefined',
    'profile', 'profiles', 'speaker', 'speakers', 'contact', 'about', 'www',
];

function username_field(mixed $value): ?string {
    if ($value === null || $value === '') return null;
    validate_username_format($value);
    if (username_reserved($value)) fail(409, 'username_taken', 'This username is already taken.', ['username'=>'taken']);
    return $value;
}
function validate_username_format(mixed $value): void {
    if (!is_string($value) || strlen($value) < 4 || strlen($value) > 40 || !preg_match('/^[a-z0-9]+(?:-[a-z0-9]+)*$/D', $value)) fail(422, 'validation', 'Use 4–40 lowercase letters or numbers, separated by single dashes.', ['username'=>'invalid']);
}
function username_reserved(string $value): bool {
    return in_array(str_replace('-', '', $value), RESERVED_USERNAMES, true);
}
