<?php
declare(strict_types=1);
if (!defined('GREEN_ROOM')) exit;

const PROFILE_LINK_FIELDS = ['homepage_url','github_url','linkedin_url','x_url','bluesky_url','instagram_url','youtube_url','mastodon_url'];

class AvatarException extends RuntimeException {
    public function __construct(string $message, public readonly int $status = 422) { parent::__construct($message); }
}

function avatar_directory(): string { global $config; return dirname($config['database']) . '/avatars'; }
function avatar_filename(string $url, int $id): ?string {
    return preg_match('#^/api/avatars/' . $id . '/(avatar-[a-f0-9]{16}\.(?:png|jpg|gif|webp|avif|ico|svg))$#D', $url, $matches) ? $matches[1] : null;
}
function profile_fields(array $input, array $existing): array {
    $avatar = $input['avatar_url'] ?? null;
    $local = is_string($avatar) && str_starts_with($avatar, '/api/avatars/');
    if ($local) {
        if ($avatar !== $existing['avatar_url'] || !avatar_filename($avatar, (int)$existing['id'])) throw new AvatarException('Use an image URL or keep your current stored profile image.');
        unset($input['avatar_url']);
    }
    $data = fields($input, ['name','avatar_url',...PROFILE_LINK_FIELDS]);
    if ($local) $data['avatar_url'] = $avatar;
    foreach (PROFILE_LINK_FIELDS as $key) {
        $url = $data[$key] ?? null;
        if ($url !== null && (strlen($url)>2048 || !filter_var($url,FILTER_VALIDATE_URL) || !in_array(strtolower(parse_url($url,PHP_URL_SCHEME) ?: ''),['http','https'],true) || parse_url($url,PHP_URL_USER)!==null || parse_url($url,PHP_URL_PASS)!==null)) {
            fail(422,'validation','Use a full http or https profile URL without credentials (up to 2048 characters).',[$key=>'invalid_url']);
        }
    }
    return $data;
}
function prepare_avatar(?string $source, array $existing, ?callable $fetcher = null): ?array {
    if ($source === null || $source === '') return null;
    if (str_starts_with($source,'/api/avatars/')) {
        $filename = avatar_filename($source,(int)$existing['id']);
        if (!$filename || $source !== $existing['avatar_url']) throw new AvatarException('You cannot use another member\'s stored image.');
        $bytes = @file_get_contents(avatar_directory() . '/' . $existing['id'] . '/' . $filename,false,null,0,LOGO_LIMIT+1);
        if ($bytes === false) throw new AvatarException('The stored profile image is missing. Replace it from a URL or remove it.');
    } else {
        try { $bytes = ($fetcher ?? 'fetch_public_resource')($source,LOGO_LIMIT)['body']; }
        catch (RemoteResourceException $error) { throw new AvatarException($error->getMessage(),$error->status); }
    }
    try { $extension = validate_logo_image($bytes,$safeBytes); }
    catch (ConferenceLogoException $error) { throw new AvatarException(str_ireplace('logo','profile image',$error->getMessage()),$error->status); }
    return ['bytes'=>$safeBytes,'extension'=>$extension];
}
function store_avatar(int $id, array $asset): string {
    $directory = avatar_directory() . '/' . $id;
    $hash = hash('sha256',$asset['bytes']);
    $filename = 'avatar-' . substr($hash,0,16) . '.' . $asset['extension'];
    $destination = $directory . '/' . $filename;
    if (!is_dir($directory) && !@mkdir($directory,0700,true) && !is_dir($directory)) throw new AvatarException('PHP cannot store profile images. Make api/db/ writable by PHP.',503);
    if (!is_file($destination) || @hash_file('sha256',$destination)!==$hash) {
        $temporary = @tempnam($directory,'.avatar-');
        if ($temporary===false) throw new AvatarException('PHP cannot write profile image storage.',503);
        try {
            if (@file_put_contents($temporary,$asset['bytes'])!==strlen($asset['bytes']) || !@rename($temporary,$destination)) throw new AvatarException('Could not save the profile image. Check storage permissions.',503);
        } finally { if (is_file($temporary)) @unlink($temporary); }
    }
    return '/api/avatars/' . $id . '/' . $filename;
}
function persist_profile(array $data, array $existing, ?callable $fetcher = null): void {
    // As with conference logos, migrate a legacy remote image on the next save, never on reads.
    $source = array_key_exists('avatar_url',$data) ? $data['avatar_url'] : ($existing['avatar_url'] ?? null);
    $asset = prepare_avatar($source,$existing,$fetcher);
    db()->exec('BEGIN IMMEDIATE');
    try {
        if (!one('SELECT id FROM users WHERE id=? AND suspended=0 AND session_version=?', [$existing['id'],$existing['session_version']])) throw new AvatarException('Please sign in again before updating your profile.',401);
        $data['avatar_url'] = $asset ? store_avatar((int)$existing['id'],$asset) : null;
        update('users',(int)$existing['id'],$data);
        db()->exec('COMMIT');
    } catch(Throwable $error) { db()->exec('ROLLBACK'); throw $error; }
}
function profile_details(array $user): array { return [...public_user($user),...array_intersect_key($user,array_flip(PROFILE_LINK_FIELDS))]; }
