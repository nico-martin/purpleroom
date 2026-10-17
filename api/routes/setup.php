<?php
declare(strict_types=1);
if (!defined('GREEN_ROOM')) exit;

route('POST', '/setup', function () {
    global $config;
    header('Cache-Control: no-store');
    $expected = $config['setup_key'] ?? null;
    if (!is_string($expected) || strlen($expected) < 32) fail(404, 'not_found', 'Web setup is disabled. Set APP_SETUP_KEY to a unique secret of at least 32 random characters in GitHub Actions and redeploy, or configure setup_key in api/config.local.php for a manual deployment.');

    $input = body();
    if (!is_string($input['setup_key'] ?? null) || !hash_equals($expected, $input['setup_key'])) fail(403, 'invalid_setup_key', 'The setup key is incorrect.');
    $data = fields($input, ['name', 'email']);
    required($data, ['name', 'email']);
    if (!filter_var($data['email'], FILTER_VALIDATE_EMAIL)) fail(422, 'validation', 'Enter a valid email address.', ['email' => 'invalid']);

    // Verify session storage before committing the only first-user account.
    start_session();
    // A write lock makes concurrent first-user requests mutually exclusive.
    db()->exec('BEGIN IMMEDIATE');
    try {
        $usersTable = one("SELECT name FROM sqlite_master WHERE type='table' AND name='users'");
        if ($usersTable && one('SELECT id FROM users LIMIT 1')) {
            db()->exec('ROLLBACK');
            fail(409, 'setup_complete', 'The first user already exists. Web setup is permanently locked; sign in or ask a crew member for an invite.');
        }
        apply_database_migrations();
        $id = insert('users', [...$data, 'cal_token' => bin2hex(random_bytes(32))]);
        db()->exec('COMMIT');
    } catch (Throwable $error) {
        db()->exec('ROLLBACK');
        throw $error;
    }

    // Bootstrap signs in directly; no working mail delivery is needed for the first user.
    login($id);
    json_response(['user' => private_user(require_login())], 201);
}, true);
