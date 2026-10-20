<?php
declare(strict_types=1);
if (!defined('GREEN_ROOM')) exit;

const SPEAKER_PICTURE_WIDTHS = ['s'=>400, 'm'=>720, 'l'=>1080, 'xl'=>1900];
function prepare_speaker_cover(string $bytes): array {
    try { $extension = validate_logo_image($bytes, $safeBytes); }
    catch (ConferenceLogoException $error) { throw new SpeakerPictureException($error->getMessage(), $error->status); }
    if (!in_array($extension, ['jpg','png','webp','avif'], true)) throw new SpeakerPictureException('Use a PNG, JPEG, WebP or AVIF cover image.');
    if (!function_exists('imagecreatefromstring')) throw new SpeakerPictureException('Enable PHP GD support to resize cover images.', 503);
    [$width,$height] = getimagesizefromstring($safeBytes);
    speaker_picture_memory_check($width, $height);
    $orientation = speaker_picture_orientation($safeBytes, $extension);
    $image = @imagecreatefromstring($safeBytes);
    if (!$image) throw new SpeakerPictureException('This cover could not be decoded.');
    try {
        $angle = match ($orientation) { 3=>180, 5,6,7=>-90, 8=>90, default=>0 };
        if ($angle !== 0) {
            $rotated = imagerotate($image, $angle, 0);
            if (!$rotated) throw new SpeakerPictureException('The cover orientation could not be processed.');
            imagedestroy($image); $image = $rotated;
        }
        if (in_array($orientation, [2,4,5,7], true)) imageflip($image, in_array($orientation, [2,5], true) ? IMG_FLIP_HORIZONTAL : IMG_FLIP_VERTICAL);
        $width = imagesx($image); $height = imagesy($image);
        if ($width < 800 || $height < 200) throw new SpeakerPictureException('Use a cover at least 800 pixels wide and 200 pixels high. Recommended: 1600 × 400 pixels.');
        $cropWidth = min($width, $height * 4); $cropHeight = $cropWidth / 4;
        $targetWidth = min(1900, (int)$cropWidth); $targetWidth -= $targetWidth % 4;
        $target = imagecreatetruecolor($targetWidth, (int)($targetWidth / 4));
        if (!$target) throw new SpeakerPictureException('The cover could not be resized.');
        try {
            imagealphablending($target, false); imagesavealpha($target, true);
            imagefill($target, 0, 0, imagecolorallocatealpha($target, 0, 0, 0, 127));
            if (!imagecopyresampled($target, $image, 0, 0, (int)(($width-$cropWidth)/2), (int)(($height-$cropHeight)/2), $targetWidth, (int)($targetWidth/4), (int)$cropWidth, (int)$cropHeight)) throw new SpeakerPictureException('The cover could not be resized.');
            ob_start();
            try { $ok = imagepng($target, null, 6); $output = ob_get_contents(); }
            finally { ob_end_clean(); }
            if (!$ok || !$output) throw new SpeakerPictureException('The cover could not be encoded.');
            return ['bytes'=>$output, 'extension'=>'png'];
        } finally { imagedestroy($target); }
    } finally { imagedestroy($image); }
}
class SpeakerPictureException extends RuntimeException {
    public function __construct(string $message, public readonly int $status = 422) { parent::__construct($message); }
}
function speaker_picture_orientation(string $bytes, string $extension): int {
    if ($extension !== 'jpg') return 1;
    if (!function_exists('exif_read_data')) throw new SpeakerPictureException('Enable PHP EXIF support to process JPEG speaker pictures correctly.', 503);
    $stream = fopen('php://memory', 'r+');
    try {
        fwrite($stream, $bytes); rewind($stream);
        $exif = @exif_read_data($stream, 'IFD0', true, false);
        $orientation = (int)($exif['IFD0']['Orientation'] ?? 1);
        return $orientation >= 1 && $orientation <= 8 ? $orientation : 1;
    } finally { fclose($stream); }
}
function speaker_picture_memory_check(int $width, int $height): void {
    $limit = trim(ini_get('memory_limit'));
    if ($limit === '-1') return;
    $bytes = (int)$limit;
    $bytes *= match (strtolower(substr($limit, -1))) { 'g'=>1073741824, 'm'=>1048576, 'k'=>1024, default=>1 };
    // Bound source/rotation buffers, one output at a time, and codec overhead before allocating.
    $estimate = $width * $height * 10 + 1900 * (int)round($height * 1900 / $width) * 5 + 25165824;
    if ($bytes > 0 && memory_get_usage(true) + $estimate > $bytes) throw new SpeakerPictureException('This picture needs too much memory to resize on this server. Use a smaller picture that is still at least 2000 pixels wide.');
}
function prepare_speaker_picture(string $bytes): array {
    try { $extension = validate_logo_image($bytes, $safeBytes); }
    catch (ConferenceLogoException $error) { throw new SpeakerPictureException(str_ireplace('logo', 'speaker picture', $error->getMessage()), $error->status); }
    if (!in_array($extension, ['jpg','png','webp','avif'], true)) throw new SpeakerPictureException('Use a PNG, JPEG, WebP or AVIF photo, at least 2000 pixels wide. SVG, GIF and ICO are not supported for new speaker pictures.');
    if (!function_exists('imagecreatefromstring')) throw new SpeakerPictureException('Enable PHP GD support to resize speaker pictures.', 503);
    $dimensions = getimagesizefromstring($safeBytes);
    $orientation = speaker_picture_orientation($safeBytes, $extension);
    [$width,$height] = in_array($orientation, [5,6,7,8], true) ? [$dimensions[1],$dimensions[0]] : [$dimensions[0],$dimensions[1]];
    if ($width < 2000) throw new SpeakerPictureException('Speaker pictures must be at least 2000 pixels wide.');
    speaker_picture_memory_check($width, $height);
    $image = @imagecreatefromstring($safeBytes);
    if (!$image) throw new SpeakerPictureException('This photo could not be decoded. Try a PNG or JPEG picture.');
    try {
        $angle = match ($orientation) { 3=>180, 5,6,7=>-90, 8=>90, default=>0 };
        if ($angle !== 0) {
            $rotated = imagerotate($image, $angle, 0);
            if (!$rotated) throw new SpeakerPictureException('The picture orientation could not be processed.');
            imagedestroy($image); $image = $rotated;
        }
        if (in_array($orientation, [2,4,5,7], true)) imageflip($image, in_array($orientation, [2,5], true) ? IMG_FLIP_HORIZONTAL : IMG_FLIP_VERTICAL);
        $assets = [];
        foreach (SPEAKER_PICTURE_WIDTHS as $size=>$targetWidth) {
            $targetHeight = max(1, (int)round($height * $targetWidth / $width));
            $target = imagecreatetruecolor($targetWidth, $targetHeight);
            if (!$target) throw new SpeakerPictureException('The picture could not be resized.');
            try {
                imagealphablending($target, false); imagesavealpha($target, true);
                imagefill($target, 0, 0, imagecolorallocatealpha($target, 0, 0, 0, 127));
                if (!imagecopyresampled($target, $image, 0, 0, 0, 0, $targetWidth, $targetHeight, $width, $height)) throw new SpeakerPictureException('The picture could not be resized.');
                $outputExtension = $extension === 'jpg' ? 'jpg' : (function_exists('imagewebp') ? 'webp' : 'png');
                ob_start();
                try {
                    $encoded = match ($outputExtension) { 'jpg'=>imagejpeg($target, null, 88), 'webp'=>imagewebp($target, null, 90), default=>imagepng($target, null, 6) };
                    $output = ob_get_contents();
                } finally { ob_end_clean(); }
                if (!$encoded || $output === '') throw new SpeakerPictureException('The resized picture could not be encoded.');
                $assets[$size] = ['bytes'=>$output, 'extension'=>$outputExtension, 'width'=>$targetWidth, 'height'=>$targetHeight];
            } finally { imagedestroy($target); }
        }
        // Full is byte-for-byte the original. Only generated variants strip EXIF/other metadata.
        $assets['full'] = ['bytes'=>$safeBytes, 'extension'=>$extension, 'width'=>$width, 'height'=>$height];
        return $assets;
    } finally { imagedestroy($image); }
}
function save_speaker_picture(array $account, string $label, string $credit, array $assets): void {
    db()->exec('BEGIN IMMEDIATE');
    try {
        $user = speaker_owner_lock($account);
        if ((int)one('SELECT COUNT(*) AS n FROM speaker_pictures WHERE user_id=?', [$user['id']])['n'] >= 10) throw new SpeakerPictureException('Keep up to ten speaker pictures.');
        $variants = [];
        foreach ($assets as $size=>$asset) {
            $filename = basename(store_avatar((int)$user['id'], $asset));
            $variants[$size] = ['filename'=>$filename, 'width'=>$asset['width'], 'height'=>$asset['height'], 'file_size'=>strlen($asset['bytes']), 'mime_type'=>LOGO_TYPES[$asset['extension']]];
        }
        insert('speaker_pictures', ['user_id'=>$user['id'], 'label'=>$label, 'credit'=>$credit, 'filename'=>$variants['full']['filename'], 'variants'=>json_encode($variants, JSON_THROW_ON_ERROR), 'public_token'=>bin2hex(random_bytes(24))]);
        db()->exec('COMMIT');
    } catch (Throwable $error) { db()->exec('ROLLBACK'); throw $error; }
}
function speaker_picture_variants(array $picture): array {
    $variants = json_decode($picture['variants'] ?? '{}', true);
    if (!$variants) {
        // Preserve old images without rewriting files or generating anything during reads.
        $filename = $picture['filename'];
        if (!avatar_filename('/api/avatars/' . $picture['user_id'] . '/' . $filename, (int)$picture['user_id'])) return [];
        $path = avatar_directory() . '/' . $picture['user_id'] . '/' . $filename;
        $dimensions = is_file($path) ? @getimagesize($path) : false;
        $variants = ['full'=>['filename'=>$filename, 'width'=>$dimensions[0] ?? null, 'height'=>$dimensions[1] ?? null, 'file_size'=>is_file($path) ? filesize($path) : 0, 'mime_type'=>LOGO_TYPES[pathinfo($filename, PATHINFO_EXTENSION)]]];
    }
    return $variants;
}
function speaker_picture_details(array $picture): array {
    $base = '/api/speaker-pictures/' . $picture['public_token'];
    $variants = [];
    foreach (speaker_picture_variants($picture) as $size=>$variant) {
        $url = $size === 'full' ? $base : $base . '/sizes/' . $size;
        $variants[$size] = [...array_intersect_key($variant, array_flip(['width','height','file_size','mime_type'])), 'url'=>$url, 'download_url'=>$url . '/download'];
    }
    return ['id'=>(int)$picture['id'], 'label'=>$picture['label'], 'credit'=>$picture['credit'], 'url'=>$base, 'download_url'=>$base . '/download', 'variants'=>(object)$variants];
}
