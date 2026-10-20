<?php
declare(strict_types=1);
if (!defined('GREEN_ROOM')) exit;

function speaker_sharing(array $info): array {
    $snapshot = json_decode($info['published'], true);
    $url = $snapshot['profile_url'];
    $image = 'https://shareable.nico.dev/render?' . http_build_query(['url'=>$url, 'version'=>'speaker-v1-' . $info['revision']], '', '&', PHP_QUERY_RFC3986);
    return ['profile_url'=>$url, 'image_url'=>$image, 'twitter_image_url'=>$image . '&format=twitter'];
}

function speaker_page_html(string $username): never {
    public_speaker_limit();
    // Serve the existing SPA shell with crawler-readable metadata, without starting a session.
    $html = file_get_contents(dirname(__DIR__, 2) . '/index.html');
    if ($html === false) fail(503, 'unavailable', 'The application page is unavailable.');
    $info = one('SELECT s.published,s.revision,u.id FROM speaker_information s JOIN users u ON u.id=s.user_id WHERE u.username=? AND u.suspended=0 AND u.profile_complete=1 AND s.published IS NOT NULL', [$username]);
    if ($info) {
        $profile = json_decode($info['published'], true);
        $sharing = speaker_sharing($info);
        $escape = fn(string $value): string => htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
        $title = $profile['name'] . ' — Speaker press kit';
        $description = $profile['tagline'] ?? 'Speaker profile, biography and pictures for ' . $profile['name'] . '.';
        $tags = '<title>' . $escape($title) . '</title><meta name="description" content="' . $escape($description) . '">';
        foreach (['og:type'=>'profile', 'og:title'=>$title, 'og:description'=>$description, 'og:url'=>$sharing['profile_url'], 'og:image'=>$sharing['image_url'], 'og:image:width'=>'1200', 'og:image:height'=>'630', 'og:image:alt'=>'Speaker profile for ' . $profile['name']] as $key=>$value) $tags .= '<meta property="' . $key . '" content="' . $escape($value) . '">';
        foreach (['twitter:card'=>'summary_large_image', 'twitter:title'=>$title, 'twitter:description'=>$description, 'twitter:image'=>$sharing['twitter_image_url']] as $key=>$value) $tags .= '<meta name="' . $key . '" content="' . $escape($value) . '">';
        $tags .= '<link rel="canonical" href="' . $escape($sharing['profile_url']) . '">';
        $html = preg_replace('#<title>.*?</title>|<meta name="description"[^>]*>#s', '', $html);
        $html = str_replace('</head>', $tags . '</head>', $html);
    }
    header('Content-Type: text/html; charset=utf-8');
    header('Cache-Control: no-store');
    header('Referrer-Policy: no-referrer');
    echo $html;
    exit;
}
