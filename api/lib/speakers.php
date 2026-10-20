<?php
declare(strict_types=1);
if (!defined('GREEN_ROOM')) exit;

const SPEAKER_TEXT_FIELDS = ['tagline', 'company', 'job_title', 'contact_email'];

function speaker_text(array $input, string $key, int $limit = 200): string {
    $value = $input[$key] ?? '';
    if (!is_string($value) || strlen($value) > $limit) fail(422, 'validation', "Keep $key as text under $limit bytes.");
    return trim($value);
}
function speaker_list(array $input, string $key, int $limit): array {
    $value = $input[$key] ?? [];
    if (!is_array($value) || !array_is_list($value) || count($value) > $limit) fail(422, 'validation', "Invalid $key list (maximum $limit).");
    return $value;
}
function speaker_url(string $url): string {
    if (strlen($url) > 2048 || !filter_var($url, FILTER_VALIDATE_URL) || !in_array(strtolower(parse_url($url, PHP_URL_SCHEME) ?: ''), ['http','https'], true) || parse_url($url, PHP_URL_USER) !== null || parse_url($url, PHP_URL_PASS) !== null) fail(422, 'validation', 'Use a full HTTP(S) URL without credentials.');
    return $url;
}
function speaker_draft(array $input): array {
    $result = [];
    foreach (SPEAKER_TEXT_FIELDS as $key) $result[$key] = speaker_text($input, $key);
    if ($result['contact_email'] !== '' && !filter_var($result['contact_email'], FILTER_VALIDATE_EMAIL)) fail(422, 'validation', 'Use a valid public contact email.');
    $result['bios'] = [];
    foreach (speaker_list($input, 'bios', 20) as $bio) {
        if (!is_array($bio)) fail(422, 'validation', 'Invalid bio variant.');
        $entry = ['label'=>speaker_text($bio, 'label'), 'text'=>speaker_text($bio, 'text', 20000)];
        required($entry, ['label','text']);
        $result['bios'][] = $entry;
    }
    $result['appearances'] = [];
    foreach (speaker_list($input, 'appearances', 50) as $appearance) {
        if (!is_array($appearance)) fail(422, 'validation', 'Invalid public work entry.');
        $entry = ['kind'=>speaker_text($appearance, 'kind'), 'title'=>speaker_text($appearance, 'title'), 'url'=>speaker_url(speaker_text($appearance, 'url', 2048)), 'description'=>speaker_text($appearance, 'description', 2000)];
        if (!in_array($entry['kind'], ['talk','recording','slides','appearance'], true)) fail(422, 'validation', 'Choose talk, recording, slides, or appearance.');
        required($entry, ['title']);
        $result['appearances'][] = $entry;
    }
    return $result;
}
function speaker_information(int $id): array {
    return one('SELECT * FROM speaker_information WHERE user_id=?', [$id]) ?? ['draft'=>'{}', 'published'=>null, 'revision'=>null, 'speaker_id'=>null, 'header_picture_id'=>null, 'profile_picture_id'=>null, 'header_asset_id'=>null];
}
function ensure_speaker_information(int $id): void {
    query('INSERT OR IGNORE INTO speaker_information(user_id,speaker_id) VALUES(?,?)', [$id, 'spk_' . bin2hex(random_bytes(16))]);
}
function speaker_owner_lock(array $account): array {
    $user = one('SELECT * FROM users WHERE id=? AND suspended=0 AND session_version=?', [$account['id'],$account['session_version']]);
    if (!$user) fail(401, 'unauthenticated', 'Please sign in again.');
    return $user;
}
function speaker_pictures(int $id): array {
    return array_map('speaker_picture_details', all('SELECT * FROM speaker_pictures WHERE user_id=? ORDER BY id', [$id]));
}
function speaker_owner_response(array $user): array {
    $info = speaker_information((int)$user['id']);
    return ['draft'=>speaker_draft(json_decode($info['draft'], true)), 'pictures'=>speaker_pictures((int)$user['id']), 'published'=>$info['published'] !== null, 'username'=>$user['username'], 'sharing'=>$info['published'] !== null ? speaker_sharing($info) : null, 'branding'=>['header_image'=>speaker_header_image($info, (int)$user['id']), 'profile_url'=>$user['avatar_url'] && avatar_filename($user['avatar_url'], (int)$user['id']) ? $user['avatar_url'] : null]];
}
function speaker_branding_details(array $asset): array {
    $picture = speaker_picture_details($asset);
    $picture['url'] = '/api/speaker/branding-assets/' . $asset['public_token'];
    $picture['download_url'] = $picture['url'];
    $picture['variants'] = (object)[];
    return $picture;
}
function speaker_header_image(array $info, int $owner): ?array {
    $asset = $info['header_asset_id'] ? one('SELECT *, \'\' AS credit FROM speaker_branding_assets WHERE id=? AND user_id=?', [$info['header_asset_id'],$owner]) : null;
    if ($asset) return speaker_branding_details($asset);
    // Retain earlier header choices until explicitly replaced or removed.
    $legacy = $info['header_picture_id'] ? one('SELECT * FROM speaker_pictures WHERE id=? AND user_id=?', [$info['header_picture_id'],$owner]) : null;
    return $legacy ? speaker_picture_details($legacy) : null;
}
function store_speaker_branding(array $user, array $asset, string $label): array {
    $filename = basename(store_avatar((int)$user['id'], $asset));
    query('INSERT OR IGNORE INTO speaker_branding_assets(user_id,public_token,filename,label) VALUES(?,?,?,?)', [$user['id'],bin2hex(random_bytes(24)),$filename,$label]);
    return one('SELECT *, \'\' AS credit FROM speaker_branding_assets WHERE user_id=? AND filename=? AND label=?', [$user['id'],$filename,$label]);
}
function speaker_snapshot(array $user): array {
    global $config;
    if (!$user['username']) fail(422, 'validation', 'Claim a username in Speaker settings first.');
    $id = (int)$user['id'];
    $info = speaker_information($id);
    $draft = speaker_draft(json_decode($info['draft'], true));
    $snapshot = ['schema_version'=>1, 'speaker_id'=>$info['speaker_id'], 'username'=>$user['username'], 'name'=>$user['name'], 'profile_url'=>rtrim($config['base_url'], '/') . '/u/' . $user['username'], 'api_url'=>rtrim($config['base_url'], '/') . '/api/public/speakers/' . $user['username']];
    // Publish the complete saved speaker profile, never the private account payload.
    foreach (SPEAKER_TEXT_FIELDS as $key) if ($draft[$key] !== '') $snapshot[$key] = $draft[$key];
    $snapshot['bios'] = $draft['bios'];
    $snapshot['links'] = [];
    foreach (PROFILE_LINK_FIELDS as $key) if ($user[$key]) $snapshot['links'][] = ['field'=>$key, 'url'=>$user[$key]];
    $snapshot['appearances'] = $draft['appearances'];
    $snapshot['pictures'] = speaker_pictures($id);
    $snapshot['header_image'] = speaker_header_image($info, $id);
    $snapshot['profile_image'] = null;
    // Snapshot only this owner's saved, validated local avatar. Never expose the authenticated avatar route publicly.
    if ($user['avatar_url'] && avatar_filename($user['avatar_url'], $id)) {
        $asset = prepare_avatar($user['avatar_url'], $user);
        $snapshot['profile_image'] = speaker_branding_details(store_speaker_branding($user, $asset, 'Profile picture'));
    }
    return $snapshot;
}
function speaker_public_picture(array $picture, int $owner): array {
    global $config;
    $stored = one('SELECT public_token FROM speaker_pictures WHERE id=? AND user_id=?', [$picture['id'],$owner]);
    if (!$stored) return $picture;
    $picture['url'] = rtrim($config['base_url'], '/') . '/api/speaker-pictures/' . $stored['public_token'];
    $picture['download_url'] = $picture['url'] . '/download';
    if (isset($picture['variants'])) foreach ($picture['variants'] as $size=>&$variant) {
        $variant['url'] = $size === 'full' ? $picture['url'] : $picture['url'] . '/sizes/' . $size;
        $variant['download_url'] = $variant['url'] . '/download';
    }
    unset($variant);
    return $picture;
}
function speaker_public_snapshot(array $info): array {
    $snapshot = json_decode($info['published'], true);
    $snapshot['sharing'] = speaker_sharing($info);
    $snapshot['pictures'] = array_map(fn($picture) => speaker_public_picture($picture, (int)$info['id']), $snapshot['pictures']);
    foreach (['header_image','profile_image'] as $key) if (isset($snapshot[$key])) {
        if (preg_match('#^/api/speaker/branding-assets/([a-f0-9]{48})$#D', $snapshot[$key]['url'], $match)) {
            global $config;
            $snapshot[$key]['url'] = rtrim($config['base_url'], '/') . '/api/speaker-branding/' . $match[1];
            $snapshot[$key]['download_url'] = $snapshot[$key]['url'];
        } else $snapshot[$key] = speaker_public_picture($snapshot[$key], (int)$info['id']);
    }
    return $snapshot;
}
function public_speaker_limit(): void {
    // Do not trust forwarded headers. HTML is a static app shell; data/media share this budget.
    if (!take_rate_limit('public-speaker:' . ($_SERVER['REMOTE_ADDR'] ?? 'unknown'), 120, 60)) {
        header('Retry-After: 60');
        fail(429, 'rate_limited', 'Too many public profile requests. Try again in a minute.');
    }
}
function published_speaker(string $username): array {
    $info = one('SELECT s.published,s.revision,u.id FROM speaker_information s JOIN users u ON u.id=s.user_id WHERE u.username=? AND u.suspended=0 AND u.profile_complete=1 AND s.published IS NOT NULL', [$username]);
    if (!$info) fail(404, 'not_found', 'Speaker profile not found.');
    return $info;
}
function serve_speaker_picture(array $picture, bool $download, bool $public, string $size = 'full'): never {
    $variant = speaker_picture_variants($picture)[$size] ?? null;
    if (!$variant) fail(404, 'not_found', 'Picture size not found.');
    $filename = $variant['filename'];
    if (!avatar_filename('/api/avatars/' . $picture['user_id'] . '/' . $filename, (int)$picture['user_id'])) fail(404, 'not_found', 'Picture not found.');
    $path = avatar_directory() . '/' . $picture['user_id'] . '/' . $filename;
    if (!is_file($path)) fail(404, 'not_found', 'Picture not found.');
    if (session_status() === PHP_SESSION_ACTIVE) session_write_close();
    header('Content-Type: ' . LOGO_TYPES[pathinfo($filename, PATHINFO_EXTENSION)]);
    header('Content-Disposition: ' . ($download ? 'attachment' : 'inline') . '; filename="speaker-picture-' . $picture['id'] . '-' . $size . '.' . pathinfo($filename, PATHINFO_EXTENSION) . '"');
    header("Content-Security-Policy: default-src 'none'; img-src data:; style-src 'unsafe-inline'; sandbox");
    header('Cache-Control: ' . ($public ? '' : 'private, ') . 'no-store');
    header('Vary: Cookie');
    header('Content-Length: ' . filesize($path));
    readfile($path);
    exit;
}
