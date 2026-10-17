<?php
if (!defined('GREEN_ROOM')) exit;
route('GET', '/conferences', fn() => json_response(array_map('conference_summary', all('SELECT * FROM conferences WHERE deleted_at IS NULL ORDER BY name'))));
route('POST', '/conferences', function () {
    $data = conference_fields(body()); required($data, ['name']);
    $id = persist_conference([...$data, 'created_by' => require_login()['id']]);
    json_response(conference_summary(conference($id)), 201);
});
route('POST', '/conferences/metadata', function () {
    $data = body(); required($data, ['url']);
    if (!is_string($data['url']) || !filter_var($data['url'], FILTER_VALIDATE_URL)) fail(422, 'validation', 'Enter a valid URL.');
    try { $resource = fetch_public_resource($data['url'], 1048576); }
    catch (RemoteResourceException $error) {
        if ($error->reason === 'unsafe_url') fail(422, 'validation', $error->getMessage(), ['url' => 'invalid']);
        json_response((object) []);
    }
    if (!class_exists('DOMDocument')) json_response((object) []);
    $html = $resource['body']; $url = parse_url($resource['url']); $host = $url['host'];
    $doc = new DOMDocument(); @$doc->loadHTML($html, LIBXML_NONET); $xpath = new DOMXPath($doc);
    $meta = fn($key) => $xpath->evaluate('string(//meta[@property="' . $key . '"]/@content)');
    $image = $meta('og:image');
    $origin = $url['scheme'] . '://' . $host . (isset($url['port']) ? ':' . $url['port'] : '');
    if ($image) $image = resolve_remote_url($resource['url'], $image);
    json_response(['name' => $meta('og:title') ?: $xpath->evaluate('string(//title)'), 'description' => $meta('og:description') ?: $xpath->evaluate('string(//meta[@name="description"]/@content)'), 'logo_url' => $image ?: $origin . '/favicon.ico']);
});
route('GET', '/conferences/{id}', function ($p) {
    $c = conference((int) $p['id']);
    $reviews = array_map(fn($r) => [...$r, 'tags' => json_decode($r['tags'], true), 'user' => user_by_id((int) $r['user_id'])], all('SELECT * FROM reviews WHERE conference_id=? ORDER BY updated_at DESC', [$c['id']]));
    json_response([...conference_summary($c), 'created_by' => user_by_id((int) $c['created_by']), 'editions' => all('SELECT * FROM editions WHERE conference_id=? AND deleted_at IS NULL ORDER BY year DESC, starts_on DESC', [$c['id']]), 'reviews' => $reviews, 'comments' => comments_for('conference_id', (int) $c['id'])]);
});
route('PATCH', '/conferences/{id}', function ($p) {
    $c = conference((int) $p['id']); $data = conference_fields(body(), $c);
    if (array_key_exists('name', $data)) required($data, ['name']);
    persist_conference($data, $c); json_response(conference_summary(conference((int) $c['id'])));
});
route('DELETE', '/conferences/{id}', function ($p) { $c = conference((int) $p['id']); update('conferences', (int) $c['id'], ['deleted_at' => now()]); json_response(null, 204); });
route('POST', '/conferences/{id}/restore', function ($p) {
    if (!one('SELECT id FROM conferences WHERE id=?', [$p['id']])) fail(404, 'not_found', 'Conference not found.');
    update('conferences', (int) $p['id'], ['deleted_at' => null]); json_response(conference((int) $p['id']));
});
route('GET', '/trash', function () {
    $since = gmdate('Y-m-d\TH:i:s\Z', time() - 90 * 86400);
    json_response(['conferences' => all('SELECT * FROM conferences WHERE deleted_at>=? ORDER BY deleted_at DESC', [$since]), 'editions' => all('SELECT e.*, c.name AS conference_name FROM editions e JOIN conferences c ON c.id=e.conference_id WHERE e.deleted_at>=? ORDER BY e.deleted_at DESC', [$since])]);
});
