<?php
declare(strict_types=1);
if (!defined('GREEN_ROOM')) exit;

route('GET', '/conference-logos/{id}/{filename}', function ($params) {
    $conference = conference((int) $params['id']);
    $url = '/api/conference-logos/' . $conference['id'] . '/' . $params['filename'];
    $filename = logo_filename($url, (int) $conference['id']);
    if (!$filename || $conference['logo_url'] !== $url) fail(404, 'not_found', 'Conference logo not found.');
    $path = logo_directory() . '/' . $conference['id'] . '/' . $filename;
    if (!is_file($path)) fail(404, 'not_found', 'Conference logo not found.');
    session_write_close();
    header('Content-Type: ' . LOGO_TYPES[pathinfo($filename, PATHINFO_EXTENSION)]);
    header('Content-Disposition: inline; filename="' . $filename . '"');
    header("Content-Security-Policy: default-src 'none'; sandbox");
    header('Cache-Control: private, max-age=86400');
    header('Vary: Cookie');
    header('Content-Length: ' . filesize($path));
    readfile($path);
    exit;
});
