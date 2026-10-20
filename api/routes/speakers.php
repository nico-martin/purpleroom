<?php
declare(strict_types=1);
if (!defined('GREEN_ROOM')) exit;

route('GET', '/speaker', function () { json_response(speaker_owner_response(require_login())); });
route('GET', '/public/speakers/{username}/page', function ($p) { speaker_page_html($p['username']); }, true);
route('POST', '/speaker/branding/header', function () {
    $user = require_login();
    if ((int)($_SERVER['CONTENT_LENGTH'] ?? 0) > LOGO_LIMIT + 65536) fail(413, 'too_large', 'Cover uploads must be no larger than 5 MB.');
    $file = $_FILES['picture'] ?? null;
    if (!$file || ($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK || !is_uploaded_file($file['tmp_name'])) fail(422, 'validation', 'Choose a cover image up to 5 MB.');
    $bytes = file_get_contents($file['tmp_name'], false, null, 0, LOGO_LIMIT + 1);
    if ($bytes === false) throw new SpeakerPictureException('The cover could not be read.', 503);
    $asset = prepare_speaker_cover($bytes);
    db()->exec('BEGIN IMMEDIATE');
    try {
        $user = speaker_owner_lock($user);
        ensure_speaker_information((int)$user['id']);
        $stored = store_speaker_branding($user, $asset, 'Cover image');
        query('UPDATE speaker_information SET header_asset_id=?,header_picture_id=NULL WHERE user_id=?', [$stored['id'],$user['id']]);
        db()->exec('COMMIT');
    } catch (Throwable $error) { db()->exec('ROLLBACK'); throw $error; }
    json_response(speaker_owner_response($user));
});
route('DELETE', '/speaker/branding/header', function () {
    $user = require_login();
    query('UPDATE speaker_information SET header_asset_id=NULL,header_picture_id=NULL WHERE user_id=?', [$user['id']]);
    json_response(speaker_owner_response($user));
});
route('GET', '/speaker/branding-assets/{token}', function ($p) {
    $user = require_login();
    $asset = one('SELECT * FROM speaker_branding_assets WHERE public_token=? AND user_id=?', [$p['token'],$user['id']]);
    if (!$asset) fail(404, 'not_found', 'Image not found.');
    serve_speaker_picture($asset, false, false);
});
route('GET', '/speaker-branding/{token}', function ($p) {
    public_speaker_limit();
    $asset = one('SELECT a.*,s.published FROM speaker_branding_assets a JOIN users u ON u.id=a.user_id JOIN speaker_information s ON s.user_id=u.id WHERE a.public_token=? AND u.suspended=0 AND u.profile_complete=1 AND s.published IS NOT NULL', [$p['token']]);
    if (!$asset) fail(404, 'not_found', 'Image not found.');
    $snapshot = json_decode($asset['published'], true);
    $approved = false;
    foreach (['header_image','profile_image'] as $key) if (($snapshot[$key]['url'] ?? null) === '/api/speaker/branding-assets/' . $p['token']) $approved = true;
    if (!$approved) fail(404, 'not_found', 'Image not found.');
    serve_speaker_picture($asset, false, true);
}, true);
foreach (['', '/download'] as $suffix) {
    foreach (['', '/sizes/{size}'] as $variantPath) {
        route('GET', '/speaker-pictures/{token}' . $variantPath . $suffix, function ($p) use ($suffix) {
            public_speaker_limit();
            if (!preg_match('/^[a-f0-9]{48}$/D', $p['token'])) fail(404, 'not_found', 'Picture not found.');
            $picture = one('SELECT p.* FROM speaker_pictures p JOIN users u ON u.id=p.user_id WHERE p.public_token=? AND u.suspended=0 AND u.profile_complete=1', [$p['token']]);
            if (!$picture) fail(404, 'not_found', 'Picture not found.');
            serve_speaker_picture($picture, $suffix !== '', true, $p['size'] ?? 'full');
        }, true);
    }
}
route('PUT', '/speaker', function () {
    $user = require_login();
    $draft = speaker_draft(body());
    db()->exec('BEGIN IMMEDIATE');
    try {
        $user = speaker_owner_lock($user);
        ensure_speaker_information((int)$user['id']);
        query('UPDATE speaker_information SET draft=? WHERE user_id=?', [json_encode($draft, JSON_THROW_ON_ERROR), $user['id']]);
        db()->exec('COMMIT');
    } catch (Throwable $error) { db()->exec('ROLLBACK'); throw $error; }
    json_response(speaker_owner_response($user));
});
route('POST', '/speaker/pictures', function () {
    $user = require_login();
    $upload = str_starts_with(strtolower($_SERVER['CONTENT_TYPE'] ?? ''), 'multipart/form-data');
    if ($upload && (int)($_SERVER['CONTENT_LENGTH'] ?? 0) > LOGO_LIMIT + 65536) fail(413, 'too_large', 'Speaker picture uploads must be no larger than 5 MB.');
    $input = $upload ? $_POST : body();
    $label = speaker_text($input, 'label'); $credit = speaker_text($input, 'credit', 1000);
    required(['label'=>$label], ['label']);
    if ($upload) {
        $file = $_FILES['picture'] ?? null;
        if (!$file || ($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK || !is_string($file['tmp_name']) || !is_uploaded_file($file['tmp_name'])) fail(422, 'validation', 'Select a photo up to 5 MB. If uploads fail, check the server upload_max_filesize and post_max_size settings.');
        $bytes = file_get_contents($file['tmp_name'], false, null, 0, LOGO_LIMIT + 1);
        if ($bytes === false) throw new SpeakerPictureException('The uploaded picture could not be read. Please try again.', 503);
    } else {
        $source = speaker_url(speaker_text($input, 'source_url', 2048));
        // Keep the same pinned-DNS transport and image validator as avatar imports.
        $bytes = prepare_avatar($source, $user)['bytes'];
    }
    $assets = prepare_speaker_picture($bytes);
    save_speaker_picture($user, $label, $credit, $assets);
    json_response(speaker_owner_response($user), 201);
});
route('DELETE', '/speaker/pictures/{id}', function ($p) {
    $user = require_login();
    db()->exec('BEGIN IMMEDIATE');
    try {
        $user = speaker_owner_lock($user);
        $picture = one('SELECT id FROM speaker_pictures WHERE id=? AND user_id=?', [$p['id'],$user['id']]);
        if (!$picture) fail(404, 'not_found', 'Picture not found.');
        $info = speaker_information((int)$user['id']);
        if ($info['published'] && in_array((int)$picture['id'], array_column(json_decode($info['published'], true)['pictures'], 'id'), true)) {
            // Removing an approved picture revokes the whole kit rather than leaving stale consent.
            query('UPDATE speaker_information SET published=NULL,revision=NULL WHERE user_id=?', [$user['id']]);
        }
        query('DELETE FROM speaker_pictures WHERE id=? AND user_id=?', [$p['id'],$user['id']]);
        db()->exec('COMMIT');
    } catch (Throwable $error) { db()->exec('ROLLBACK'); throw $error; }
    json_response(speaker_owner_response($user));
});
foreach (['', '/download'] as $suffix) {
    route('GET', '/speaker/pictures/{id}/sizes/{size}' . $suffix, function ($p) use ($suffix) {
        $user = require_login();
        $picture = one('SELECT * FROM speaker_pictures WHERE id=? AND user_id=?', [$p['id'],$user['id']]);
        if (!$picture) fail(404, 'not_found', 'Picture not found.');
        serve_speaker_picture($picture, $suffix !== '', false, $p['size']);
    });
    route('GET', '/speaker/pictures/{id}' . $suffix, function ($p) use ($suffix) {
        $user = require_login();
        $picture = one('SELECT * FROM speaker_pictures WHERE id=? AND user_id=?', [$p['id'],$user['id']]);
        if (!$picture) fail(404, 'not_found', 'Picture not found.');
        serve_speaker_picture($picture, $suffix !== '', false);
    });
}
route('POST', '/speaker/preview', function () {
    $user = require_login();
    ensure_speaker_information((int)$user['id']);
    json_response(['profile'=>speaker_snapshot($user)]);
});
route('PUT', '/speaker/publication', function () {
    $user = require_login(); $input = body();
    // Do not reinterpret an old partial-selection request as consent to publish everything.
    if (($input['publish_all'] ?? null) !== true) fail(422, 'validation', 'Confirm publication of all saved speaker-profile information.');
    db()->exec('BEGIN IMMEDIATE');
    try {
        $user = speaker_owner_lock($user);
        ensure_speaker_information((int)$user['id']);
        $snapshot = speaker_snapshot($user);
        $json = json_encode($snapshot, JSON_THROW_ON_ERROR);
        query('UPDATE speaker_information SET published=?,revision=? WHERE user_id=?', [$json, bin2hex(random_bytes(16)), $user['id']]);
        db()->exec('COMMIT');
    } catch (Throwable $error) { db()->exec('ROLLBACK'); throw $error; }
    json_response(speaker_owner_response($user));
});
route('DELETE', '/speaker/publication', function () {
    $user = require_login();
    query('UPDATE speaker_information SET published=NULL,revision=NULL WHERE user_id=?', [$user['id']]);
    json_response(speaker_owner_response($user));
});
route('GET', '/public/speakers/{username}', function ($p) {
    public_speaker_limit();
    json_response(speaker_public_snapshot(published_speaker($p['username'])));
}, true);
foreach (['', '/download'] as $suffix) {
    route('GET', '/public/speakers/{username}/media/{revision}/{id}/sizes/{size}' . $suffix, function ($p) use ($suffix) {
        public_speaker_limit();
        $info = published_speaker($p['username']);
        $snapshot = json_decode($info['published'], true);
        $approved = null;
        foreach ($snapshot['pictures'] as $picture) if ((string)$picture['id'] === $p['id']) $approved = $picture;
        if (!hash_equals($info['revision'], $p['revision']) || !$approved || !isset($approved['variants'][$p['size']])) fail(404, 'not_found', 'Picture size not found.');
        $picture = one('SELECT * FROM speaker_pictures WHERE id=? AND user_id=?', [$p['id'],$info['id']]);
        if (!$picture) fail(404, 'not_found', 'Picture not found.');
        serve_speaker_picture($picture, $suffix !== '', true, $p['size']);
    }, true);
    route('GET', '/public/speakers/{username}/media/{revision}/{id}' . $suffix, function ($p) use ($suffix) {
        public_speaker_limit();
        $info = published_speaker($p['username']);
        $snapshot = json_decode($info['published'], true);
        if (!hash_equals($info['revision'], $p['revision']) || !in_array($p['id'], array_map('strval', array_column($snapshot['pictures'], 'id')), true)) fail(404, 'not_found', 'Picture not found.');
        $picture = one('SELECT * FROM speaker_pictures WHERE id=? AND user_id=?', [$p['id'],$info['id']]);
        if (!$picture) fail(404, 'not_found', 'Picture not found.');
        serve_speaker_picture($picture, $suffix !== '', true);
    }, true);
}
