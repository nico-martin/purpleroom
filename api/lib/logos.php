<?php
declare(strict_types=1);
if (!defined('GREEN_ROOM')) exit;

class ConferenceLogoException extends RuntimeException {
    public function __construct(string $message, public readonly int $status = 422) { parent::__construct($message); }
}

const LOGO_LIMIT = 5242880;
const LOGO_TYPES = ['png' => 'image/png', 'jpg' => 'image/jpeg', 'gif' => 'image/gif', 'webp' => 'image/webp', 'avif' => 'image/avif', 'ico' => 'image/x-icon'];

function logo_directory(): string { global $config; return dirname($config['database']) . '/logos'; }
function logo_slug(string $name): string {
    $ascii = function_exists('transliterator_transliterate') ? transliterator_transliterate('Any-Latin; Latin-ASCII', $name) : (function_exists('iconv') ? @iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $name) : $name);
    $ascii = str_replace(['"', "'", '`'], '', $ascii ?: $name);
    return trim(substr(trim(strtolower(preg_replace('/[^a-zA-Z0-9]+/', '-', $ascii ?: $name)), '-'), 0, 72), '-') ?: 'conference';
}
function logo_filename(string $path, int $id): ?string {
    if (!preg_match('#^/api/conference-logos/' . $id . '/([a-z0-9-]+\.(?:png|jpg|gif|webp|avif|ico))$#D', $path, $matches) || strlen($matches[1]) > 100) return null;
    return $matches[1];
}
function validate_logo_image(string $bytes): string {
    if ($bytes === '' || strlen($bytes) > LOGO_LIMIT) throw new ConferenceLogoException('Logo images must be no larger than 5 MB.');
    $image = @getimagesizefromstring($bytes);
    $types = [IMAGETYPE_PNG => 'png', IMAGETYPE_JPEG => 'jpg', IMAGETYPE_GIF => 'gif', IMAGETYPE_WEBP => 'webp', IMAGETYPE_AVIF => 'avif'];
    if ($image && isset($types[$image[2]]) && $image[0] > 0 && $image[1] > 0 && $image[0] <= 8192 && $image[1] <= 8192 && $image[0] * $image[1] <= 20000000) return $types[$image[2]];
    // ICO containers aren't supported by getimagesize; validate their directory and bounded image payloads.
    if (strlen($bytes) >= 22 && substr($bytes, 0, 4) === "\x00\x00\x01\x00") {
        $count = unpack('v', substr($bytes, 4, 2))[1];
        if ($count > 0 && $count <= 256 && strlen($bytes) >= 6 + $count * 16) {
            for ($index = 0; $index < $count; $index++) {
                $entry = unpack('Vsize/Voffset', substr($bytes, 6 + $index * 16 + 8, 8));
                if ($entry['size'] < 8 || $entry['offset'] < 6 + $count * 16 || $entry['offset'] + $entry['size'] > strlen($bytes)) throw new ConferenceLogoException('The ICO image is invalid. Use a direct PNG, JPEG, or WebP image instead.');
                $payload = substr($bytes, $entry['offset'], $entry['size']);
                $width = ord($bytes[6 + $index * 16]) ?: 256;
                $height = ord($bytes[7 + $index * 16]) ?: 256;
                if (str_starts_with($payload, "\x89PNG\r\n\x1a\n")) {
                    $png = @getimagesizefromstring($payload);
                    if (!$png || $png[2] !== IMAGETYPE_PNG || $png[0] !== $width || $png[1] !== $height) throw new ConferenceLogoException('The ICO image dimensions are invalid.');
                } else {
                    $headerSize = unpack('V', substr($payload, 0, 4))[1];
                    if (!in_array($headerSize, [40, 108, 124], true) || strlen($payload) < $headerSize) throw new ConferenceLogoException('The ICO image is invalid.');
                    $dimensions = unpack('Vwidth/Vheight', substr($payload, 4, 8));
                    if ($dimensions['width'] !== $width || $dimensions['height'] !== $height * 2) throw new ConferenceLogoException('The ICO image dimensions are invalid.');
                }
            }
            return 'ico';
        }
    }
    throw new ConferenceLogoException('Use a valid PNG, JPEG, GIF, WebP, AVIF, or ICO image (up to 20 megapixels). HTML and SVG images are not supported.');
}
function prepare_conference_logo(?string $source, ?array $existing, ?callable $fetcher = null): ?array {
    if ($source === null || $source === '') return null;
    if (str_starts_with($source, '/api/conference-logos/')) {
        $filename = $existing ? logo_filename($source, (int) $existing['id']) : null;
        if (!$filename || $source !== $existing['logo_url']) throw new ConferenceLogoException('Choose an image URL, not another conference\'s stored logo.');
        $path = logo_directory() . '/' . $existing['id'] . '/' . $filename;
        $bytes = @file_get_contents($path, false, null, 0, LOGO_LIMIT + 1);
        if ($bytes === false) throw new ConferenceLogoException('The stored logo is missing. Enter a replacement URL or remove the logo.');
    } else {
        try { $bytes = ($fetcher ?? 'fetch_public_resource')($source, LOGO_LIMIT)['body']; }
        catch (RemoteResourceException $error) { throw new ConferenceLogoException($error->getMessage(), $error->status); }
    }
    return ['bytes' => $bytes, 'extension' => validate_logo_image($bytes)];
}
function store_conference_logo(int $id, string $name, array $asset): string {
    $directory = logo_directory() . '/' . $id;
    $hash = hash('sha256', $asset['bytes']);
    $filename = logo_slug($name) . '-' . substr($hash, 0, 16) . '.' . $asset['extension'];
    $destination = $directory . '/' . $filename;
    if (!is_dir($directory) && !@mkdir($directory, 0700, true) && !is_dir($directory)) throw new ConferenceLogoException('PHP cannot store conference logos. Make api/db/ writable by PHP.', 503);
    if (!is_file($destination) || @hash_file('sha256', $destination) !== $hash) {
        $temporary = @tempnam($directory, '.logo-');
        if ($temporary === false) throw new ConferenceLogoException('PHP cannot write the logo storage directory.', 503);
        try {
            if (@file_put_contents($temporary, $asset['bytes']) !== strlen($asset['bytes']) || !@rename($temporary, $destination)) throw new ConferenceLogoException('Could not save the conference logo. Check storage permissions.', 503);
        } finally { if (is_file($temporary)) @unlink($temporary); }
    }
    return '/api/conference-logos/' . $id . '/' . $filename;
}
function conference_fields(array $input, ?array $existing = null): array {
    $local = $input['logo_url'] ?? null;
    if (is_string($local) && str_starts_with($local, '/api/conference-logos/')) {
        if (!$existing || $local !== $existing['logo_url'] || !logo_filename($local, (int) $existing['id'])) throw new ConferenceLogoException('Use a public image URL or keep this conference\'s existing stored logo.');
        unset($input['logo_url']);
        return [...fields($input, ['name', 'website', 'description']), 'logo_url' => $local];
    }
    return fields($input, ['name', 'website', 'logo_url', 'description']);
}
function persist_conference(array $data, ?array $existing = null, ?callable $fetcher = null): int {
    $source = array_key_exists('logo_url', $data) ? $data['logo_url'] : ($existing['logo_url'] ?? null);
    // This is also the lazy migration: every legacy remote URL is downloaded on the next save,
    // even if logo_url was omitted from PATCH. No network access happens on ordinary reads.
    $asset = prepare_conference_logo($source, $existing, $fetcher);
    $name = $data['name'] ?? $existing['name'];
    unset($data['logo_url']);
    db()->beginTransaction();
    try {
        $id = $existing ? (int) $existing['id'] : insert('conferences', $data);
        $data['logo_url'] = $asset ? store_conference_logo($id, $name, $asset) : null;
        $data['updated_at'] = now();
        update('conferences', $id, $data);
        db()->commit();
        return $id;
    } catch (Throwable $error) {
        db()->rollBack();
        throw $error;
    }
}
