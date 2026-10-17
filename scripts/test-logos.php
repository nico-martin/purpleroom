<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli' || !getenv('GREEN_ROOM_DB')) exit(1);
define('GREEN_ROOM', true);
$config = require dirname(__DIR__) . '/api/config.php';
foreach (['db', 'http', 'migrations', 'remote', 'logos'] as $file) require dirname(__DIR__) . '/api/lib/' . $file . '.php';
function check(bool $value, string $message): void { if (!$value) throw new RuntimeException($message); }
function rejects(callable $action, string $class): Throwable {
    try { $action(); } catch (Throwable $error) { check($error instanceof $class, 'Unexpected error: ' . $error->getMessage()); return $error; }
    throw new RuntimeException('Expected ' . $class);
}
db()->beginTransaction(); apply_database_migrations(); db()->commit();
$uid = insert('users', ['name' => 'Logo tester', 'email' => 'logos@example.com', 'cal_token' => bin2hex(random_bytes(32))]);
$png = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aAt8AAAAASUVORK5CYII=');
$downloads = [];
$fetcher = function (string $url, int $limit) use ($png, &$downloads): array { check($limit === LOGO_LIMIT, 'Wrong size limit.'); $downloads[] = $url; return ['body' => $png]; };
$read = fn(int $id): array => one('SELECT * FROM conferences WHERE id=?', [$id]);

$id = persist_conference(['name' => 'JS Nation', 'created_by' => $uid, 'logo_url' => 'https://images.example/logo.png'], null, $fetcher);
$saved = $read($id);
check(str_starts_with($saved['logo_url'], '/api/conference-logos/' . $id . '/js-nation-'), 'Wrong ID/slug URL.');
check(file_get_contents(logo_directory() . '/' . $id . '/' . logo_filename($saved['logo_url'], $id)) === $png, 'Image was not saved.');
check(count($downloads) === 1, 'New logo not downloaded.');
persist_conference(['name' => 'JS Nation'], $saved, $fetcher);
check(count($downloads) === 1 && $read($id)['logo_url'] === $saved['logo_url'], 'Cached logo was unnecessarily fetched.');
persist_conference(['name' => 'München / JS Nation!'], $read($id), $fetcher);
check(str_contains($read($id)['logo_url'], '/munchen-js-nation-'), 'Renaming did not update the local slug.');
check(count($downloads) === 1, 'Renaming fetched a remote image.');
check(logo_slug('你好') !== '' && !str_contains(logo_slug('../../bad/name'), '/'), 'Unsafe slug.');

$legacyId = insert('conferences', ['name' => 'Legacy', 'created_by' => $uid, 'description' => 'Keep existing context.', 'logo_url' => 'https://legacy.example/logo.png']);
persist_conference(['name' => 'Legacy Updated'], $read($legacyId), $fetcher);
check(str_starts_with($read($legacyId)['logo_url'], '/api/conference-logos/' . $legacyId . '/legacy-updated-'), 'Legacy URL was not migrated on a PATCH without logo_url.');
check($read($legacyId)['description'] === 'Keep existing context.', 'Existing description was lost.');
persist_conference([], $read($legacyId), $fetcher);
check(count($downloads) === 2, 'Legacy migration ran twice.');

$failedId = insert('conferences', ['name' => 'Unchanged', 'created_by' => $uid, 'logo_url' => 'https://offline.example/logo.png']);
rejects(fn() => persist_conference(['name' => 'Should not save'], $read($failedId), function () { throw new RemoteResourceException('Unavailable'); }), ConferenceLogoException::class);
check($read($failedId)['name'] === 'Unchanged' && $read($failedId)['logo_url'] === 'https://offline.example/logo.png', 'Failed download changed the conference.');
persist_conference(['logo_url' => null], $read($failedId), function () { throw new RuntimeException('Removal must not fetch.'); });
check($read($failedId)['logo_url'] === null, 'Logo removal failed.');
rejects(fn() => conference_fields(['logo_url' => $read($id)['logo_url']], $read($legacyId)), ConferenceLogoException::class);
rejects(fn() => prepare_conference_logo($read($id)['logo_url'], null), ConferenceLogoException::class);
check(logo_filename('/api/conference-logos/' . $id . '/../secret.png', $id) === null, 'Traversal accepted.');
check(logo_filename('/api/conference-logos/' . $id . '/logo.php', $id) === null, 'Executable extension accepted.');

foreach (['<html>Not an image</html>', '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>', str_repeat('a', LOGO_LIMIT + 1), substr_replace($png, pack('N', 9000), 16, 4)] as $invalid) rejects(fn() => validate_logo_image($invalid), ConferenceLogoException::class);
$ico = pack('vvv', 0, 1, 1) . pack('CCCCvvVV', 1, 1, 0, 0, 1, 32, strlen($png), 22) . $png;
check(validate_logo_image($ico) === 'ico', 'Valid ICO rejected.');
check(validate_logo_image($png) === 'png', 'PNG rejected.');

$before = (int) one('SELECT COUNT(*) AS n FROM conferences')['n'];
$originalDatabase = $config['database'];
$blocked = dirname($originalDatabase) . '/not-a-directory'; file_put_contents($blocked, 'block');
$config['database'] = $blocked . '/db.sqlite';
rejects(fn() => persist_conference(['name' => 'Rollback', 'created_by' => $uid, 'logo_url' => 'https://images.example/logo.png'], null, $fetcher), ConferenceLogoException::class);
$config['database'] = $originalDatabase;
check((int) one('SELECT COUNT(*) AS n FROM conferences')['n'] === $before, 'Storage failure left a partially created conference.');

$resolver = fn(string $host): array => ['93.184.216.34'];
foreach (['file:///etc/passwd', 'ftp://images.example/logo', 'https://user:password@images.example/logo', 'http://images.example:8000/logo', 'http://127.0.0.1/logo', 'http://2130706433/logo', 'http://0177.0.0.1/logo', 'http://0x7f000001/logo', 'http://127.0.0.1./logo', 'http://[::1]/logo', 'http://[::ffff:127.0.0.1]/logo', 'http://169.254.169.254/logo', 'http://100.64.0.1/logo', 'http://localhost/logo'] as $unsafe) rejects(fn() => public_remote_target($unsafe, $resolver), RemoteResourceException::class);
rejects(fn() => public_remote_target('https://mixed.example/logo', fn() => ['93.184.216.34', '10.0.0.1']), RemoteResourceException::class);
foreach (['192.0.2.1', '198.51.100.1', '198.18.0.1', '203.0.113.1', 'fd00::1', 'fe80::1'] as $reserved) rejects(fn() => public_remote_target('https://reserved.example/logo', fn() => [$reserved]), RemoteResourceException::class);
rejects(fn() => public_remote_target('https://no-dns.example/logo', fn() => []), RemoteResourceException::class);
$requests = [];
$transport = function ($url, $target, $limit, $timeout) use (&$requests, $png): array {
    check($target['ip'] === '93.184.216.34', 'DNS target not pinned.'); check($timeout > 0 && $timeout <= 5000, 'Timeout not bounded.');
    $requests[] = $url;
    return count($requests) === 1 ? ['body' => '', 'status' => 302, 'location' => '//cdn.example/logo.png'] : ['body' => $png, 'status' => 200, 'location' => null];
};
check(fetch_public_resource('https://images.example/logo', LOGO_LIMIT, $resolver, $transport)['body'] === $png && count($requests) === 2, 'Public redirect did not work.');
$requests = [];
rejects(function () use ($resolver, &$requests) { fetch_public_resource('https://images.example/logo', LOGO_LIMIT, $resolver, function ($url) use (&$requests): array { $requests[] = $url; return ['body' => '', 'status' => 302, 'location' => 'http://127.0.0.1/secret']; }); }, RemoteResourceException::class);
check(count($requests) === 1, 'Redirect to private address was fetched.');
rejects(fn() => fetch_public_resource('https://images.example/logo', 10, $resolver, fn() => ['body' => str_repeat('a', 11), 'status' => 200, 'location' => null]), RemoteResourceException::class);
rejects(fn() => fetch_public_resource('https://images.example/logo', 10, $resolver, fn() => ['body' => '', 'status' => 404, 'location' => null]), RemoteResourceException::class);
rejects(fn() => fetch_public_resource('https://images.example/logo', 10, $resolver, fn() => ['body' => '', 'status' => 302, 'location' => '/loop']), RemoteResourceException::class);
echo "Logo checks passed: local storage, lazy migration, idempotency, renaming, rollback, image validation, SSRF protection, DNS pinning, redirects, and size limits.\n";
