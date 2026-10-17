<?php
if (!defined('GREEN_ROOM')) exit;
route('GET', '/conferences', fn() => json_response(array_map('conference_summary', all('SELECT * FROM conferences WHERE deleted_at IS NULL ORDER BY name'))));
route('POST', '/conferences', function () {
    $data = fields(body(), ['name', 'website', 'logo_url', 'description']); required($data, ['name']);
    $id = insert('conferences', [...$data, 'created_by' => require_login()['id']]);
    json_response(conference_summary(conference($id)), 201);
});
route('POST', '/conferences/metadata', function () {
    $data = body(); required($data, ['url']);
    if (!is_string($data['url']) || !filter_var($data['url'], FILTER_VALIDATE_URL)) fail(422, 'validation', 'Enter a valid URL.');
    $url = parse_url($data['url']);
    if (!in_array($url['scheme'] ?? '', ['http', 'https'], true) || isset($url['user']) || isset($url['pass']) || !isset($url['host']) || isset($url['port']) && !in_array($url['port'], [80, 443], true)) fail(422, 'validation', 'Only public http(s) websites are allowed.');
    $host = $url['host'];
    $records = dns_get_record($host, DNS_A | DNS_AAAA) ?: [];
    $ips = filter_var(trim($host, '[]'), FILTER_VALIDATE_IP) ? [trim($host, '[]')] : array_values(array_filter(array_map(fn($r) => $r['ip'] ?? $r['ipv6'] ?? null, $records)));
    if (!$ips) json_response((object) []);
    foreach ($ips as $ip) if (!filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) fail(422, 'validation', 'Private network addresses are not allowed.');
    if (!function_exists('curl_init') || !class_exists('DOMDocument')) json_response((object) []);
    $curl = curl_init($data['url']); $html = ''; $tooLarge = false;
    curl_setopt_array($curl, [CURLOPT_TIMEOUT => 5, CURLOPT_CONNECTTIMEOUT => 3, CURLOPT_FOLLOWLOCATION => false, CURLOPT_PROTOCOLS => CURLPROTO_HTTP | CURLPROTO_HTTPS, CURLOPT_PROXY => '', CURLOPT_USERAGENT => 'GreenRoom/1.0', CURLOPT_RESOLVE => [$host . ':' . ($url['port'] ?? ($url['scheme'] === 'https' ? 443 : 80)) . ':' . (str_contains($ips[0], ':') ? '[' . $ips[0] . ']' : $ips[0])], CURLOPT_WRITEFUNCTION => function ($ch, $chunk) use (&$html, &$tooLarge) { if (strlen($html) + strlen($chunk) > 1048576) { $tooLarge = true; return 0; } $html .= $chunk; return strlen($chunk); }]);
    $success = curl_exec($curl); $status = curl_getinfo($curl, CURLINFO_HTTP_CODE); curl_close($curl);
    if (!$success || $tooLarge || $status < 200 || $status >= 300) json_response((object) []);
    $doc = new DOMDocument(); @$doc->loadHTML($html); $xpath = new DOMXPath($doc);
    $meta = fn($key) => $xpath->evaluate('string(//meta[@property="' . $key . '"]/@content)');
    $image = $meta('og:image');
    $origin = $url['scheme'] . '://' . $host;
    if ($image && !str_starts_with($image, 'http')) $image = str_starts_with($image, '//') ? $url['scheme'] . ':' . $image : $origin . '/' . ltrim($image, '/');
    json_response(['name' => $meta('og:title') ?: $xpath->evaluate('string(//title)'), 'description' => $meta('og:description') ?: $xpath->evaluate('string(//meta[@name="description"]/@content)'), 'logo_url' => $image ?: $origin . '/favicon.ico']);
});
route('GET', '/conferences/{id}', function ($p) {
    $c = conference((int) $p['id']);
    $reviews = array_map(fn($r) => [...$r, 'tags' => json_decode($r['tags'], true), 'user' => user_by_id((int) $r['user_id'])], all('SELECT * FROM reviews WHERE conference_id=? ORDER BY updated_at DESC', [$c['id']]));
    json_response([...conference_summary($c), 'created_by' => user_by_id((int) $c['created_by']), 'editions' => all('SELECT * FROM editions WHERE conference_id=? AND deleted_at IS NULL ORDER BY year DESC, starts_on DESC', [$c['id']]), 'reviews' => $reviews, 'comments' => comments_for('conference_id', (int) $c['id'])]);
});
route('PATCH', '/conferences/{id}', function ($p) {
    $c = conference((int) $p['id']); $data = fields(body(), ['name', 'website', 'logo_url', 'description']);
    if (array_key_exists('name', $data)) required($data, ['name']);
    update('conferences', (int) $c['id'], [...$data, 'updated_at' => now()]); json_response(conference_summary(conference((int) $c['id'])));
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
