<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli' || !getenv('GREEN_ROOM_DB')) exit(1);
define('GREEN_ROOM', true);
$config = require dirname(__DIR__) . '/api/config.php';
foreach (['db', 'http', 'migrations', 'remote', 'logos', 'profiles'] as $file) require dirname(__DIR__) . '/api/lib/' . $file . '.php';
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
persist_conference(conference_fields(['logo_url'=>$read($id)['logo_url'],'tags'=>[' JavaScript ','javascript','2026']],$read($id)),$read($id),$fetcher);
check(json_decode($read($id)['tags'],true)===['javascript','2026'],'Tags were lost when retaining a cached logo.');
persist_conference(['name'=>$read($id)['name']],$read($id),$fetcher);
check(json_decode($read($id)['tags'],true)===['javascript','2026'],'An unrelated update cleared conference tags.');

// Profile images share the logo validator/transport but have independent, member-owned storage.
$profile = fn(): array => one('SELECT * FROM users WHERE id=?',[$uid]);
$beforeAvatars = count($downloads);
persist_profile(['avatar_url'=>'https://images.example/avatar.png','homepage_url'=>'https://example.com'], $profile(), $fetcher);
$avatar = $profile()['avatar_url'];
check(str_starts_with($avatar,'/api/avatars/' . $uid . '/avatar-'), 'Avatar was not stored locally.');
check(file_get_contents(avatar_directory() . '/' . $uid . '/' . avatar_filename($avatar,$uid))===$png, 'Stored avatar bytes differ.');
persist_profile(profile_fields(['name'=>'New name','avatar_url'=>$avatar],$profile()),$profile(),$fetcher);
check(count($downloads)===$beforeAvatars+1 && $profile()['avatar_url']===$avatar, 'Saved avatar was unnecessarily downloaded or renamed.');
check($profile()['homepage_url']==='https://example.com', 'Omitted profile links were lost.');
rejects(fn()=>profile_fields(['avatar_url'=>str_replace('/avatars/'.$uid.'/','/avatars/999/',$avatar)],$profile()),AvatarException::class);
rejects(fn()=>prepare_avatar('/api/avatars/999/avatar-'.str_repeat('a',16).'.png',$profile()),AvatarException::class);
check(avatar_filename('/api/avatars/'.$uid.'/../secret.png',$uid)===null, 'Avatar traversal accepted.');
check(avatar_filename('/api/avatars/'.$uid.'/avatar-'.str_repeat('a',16).'.php',$uid)===null, 'Avatar executable extension accepted.');
rejects(fn()=>persist_profile(['name'=>'Do not save','avatar_url'=>'https://offline.example/avatar.png'],$profile(),function(){throw new RemoteResourceException('Unavailable');}),AvatarException::class);
check($profile()['name']==='New name' && $profile()['avatar_url']===$avatar, 'Failed avatar import changed the profile.');
rejects(fn()=>persist_profile(['name'=>'Still do not save','avatar_url'=>'https://images.example/html'],$profile(),fn()=>['body'=>'<html>not an image</html>']),AvatarException::class);
check($profile()['name']==='New name', 'Invalid avatar changed profile fields.');
persist_profile(['avatar_url'=>null],$profile(),function(){throw new RuntimeException('Removing an avatar must not fetch.');});
check($profile()['avatar_url']===null && is_file(avatar_directory().'/'.$uid.'/'.avatar_filename($avatar,$uid)), 'Avatar removal must clear the URL without purging retained files.');
update('users',$uid,['avatar_url'=>'https://legacy.example/avatar.png']);
persist_profile(['name'=>'Migrated avatar'],$profile(),$fetcher);
check($profile()['avatar_url']===$avatar && count($downloads)===$beforeAvatars+2, 'Legacy avatar did not migrate on an unrelated profile save.');

foreach (['<html>Not an image</html>', '<svg><broken></svg>', str_repeat('a', LOGO_LIMIT + 1), substr_replace($png, pack('N', 9000), 16, 4)] as $invalid) rejects(fn() => validate_logo_image($invalid), ConferenceLogoException::class);
$ico = pack('vvv', 0, 1, 1) . pack('CCCCvvVV', 1, 1, 0, 0, 1, 32, strlen($png), 22) . $png;
check(validate_logo_image($ico) === 'ico', 'Valid ICO rejected.');
check(validate_logo_image($png) === 'png', 'PNG rejected.');

$svg = <<<'SVG'
<?xml version="1.0"?>
<?xml-stylesheet href="https://attacker.example/evil.css"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="120" height="40" viewBox="0 0 120 40" onload="alert(1)" xml:base="https://attacker.example/">
 <style>.brand { fill: url(#brand); stroke: #123b2b; } .bad { fill: url(https://attacker.example/image); behavior: expression(alert(1)); }</style>
 <defs><linearGradient id="brand"><stop offset="0" stop-color="#2f6b52"/><stop offset="1" stop-color="#123b2b"/></linearGradient><clipPath id="clip"><rect width="120" height="40"/></clipPath><path id="shape" d="M0 0h20v20z"/></defs>
 <a xlink:href="javascript:alert(1)"><path class="brand" clip-path="url(#clip)" d="M0 0h120v40H0z" onclick="alert(2)"/></a>
 <use xlink:href="#shape" x="10"/>
 <use href="https://attacker.example/sprite.svg#shape"/>
 <image href="https://attacker.example/image.png" width="20" height="20"/>
 <rect width="10" height="10" style="fill: #fff; stroke: url(https://attacker.example/stroke); background: url(https://attacker.example/background)"/>
 <script>alert(3)</script><foreignObject><p xmlns="http://www.w3.org/1999/xhtml">HTML</p></foreignObject>
 <animate attributeName="href" to="javascript:alert(4)"/><set attributeName="onload" to="alert(5)"/>
 <title>A friendly &amp; safe logo</title>
</svg>
SVG;
check(validate_logo_image($svg, $safeSvg) === 'svg', 'SVG rejected.');
check(!str_contains($safeSvg, 'attacker.example') && !str_contains($safeSvg, 'javascript:') && !str_contains($safeSvg, 'alert('), 'Unsafe SVG content survived.');
check(!str_contains($safeSvg, '<script') && !str_contains($safeSvg, 'foreignObject') && !str_contains($safeSvg, '<animate') && !str_contains($safeSvg, '<set ') && !str_contains($safeSvg, 'onclick') && !str_contains($safeSvg, 'onload'), 'Active SVG elements/attributes survived.');
check(str_contains($safeSvg, 'linearGradient') && str_contains($safeSvg, 'url(#brand)') && str_contains($safeSvg, 'clipPath') && str_contains($safeSvg, 'href="#shape"') && str_contains($safeSvg, 'class="brand"') && str_contains($safeSvg, 'viewBox="0 0 120 40"'), 'Ordinary logo artwork/styling was lost.');
check(sanitize_svg_logo($safeSvg) === $safeSvg, 'SVG sanitization is not idempotent.');
$svgAvatar = prepare_avatar('https://images.example/avatar.svg',$profile(),fn()=>['body'=>$svg]);
check($svgAvatar['extension']==='svg' && $svgAvatar['bytes']===$safeSvg, 'Avatar SVGs must share the logo sanitizer.');
check(svg_safe_value('url(#brand)') === 'url(#brand)', 'Local paint reference rejected.');
foreach (['url(https://attacker.example/)', 'u/**/rl(https://attacker.example/)', 'u\\72l(https://attacker.example/)', 'expression(alert(1))', 'url(&quot;javascript:alert(1)&quot;)'] as $unsafeValue) check(svg_safe_value($unsafeValue) === null, 'Obfuscated external/active CSS survived.');
check(svg_safe_stylesheet('@import "https://attacker.example/evil.css"; .x{fill:red}') === '', 'CSS imports survived.');
foreach (['<!DOCTYPE svg [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><svg xmlns="http://www.w3.org/2000/svg"><text>&xxe;</text></svg>', '<svg xmlns="https://attacker.example/svg"/>', '<svg>' . str_repeat('<g>', 70) . str_repeat('</g>', 70) . '</svg>', '<svg>' . str_repeat('<path/>', 10001) . '</svg>'] as $unsafeSvg) rejects(fn() => validate_logo_image($unsafeSvg), ConferenceLogoException::class);
$embedded = '<svg xmlns="http://www.w3.org/2000/svg"><image href="data:image/png;base64,' . base64_encode($png) . '" width="1" height="1"/></svg>';
check(str_contains(sanitize_svg_logo($embedded), 'data:image/png;base64,'), 'Safe embedded raster image rejected.');
$svgId = insert('conferences', ['name' => 'Vector Logo', 'created_by' => $uid, 'logo_url' => 'https://legacy.example/logo.svg']);
$svgDownloads = 0;
$svgFetcher = function () use ($svg, &$svgDownloads): array { $svgDownloads++; return ['body' => $svg]; };
persist_conference([], $read($svgId), $svgFetcher);
$storedSvgUrl = $read($svgId)['logo_url'];
check(str_ends_with($storedSvgUrl, '.svg'), 'Legacy SVG did not migrate to local SVG storage.');
check(file_get_contents(logo_directory() . '/' . $svgId . '/' . logo_filename($storedSvgUrl, $svgId)) === $safeSvg, 'Raw SVG was stored instead of the sanitized image.');
persist_conference([], $read($svgId), $svgFetcher);
check($svgDownloads === 1 && $read($svgId)['logo_url'] === $storedSvgUrl, 'Cached SVG was re-downloaded or its hash changed.');

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
