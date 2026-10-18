<?php
declare(strict_types=1);
if (!defined('GREEN_ROOM')) exit;

route('GET','/avatars/{id}/{filename}',function($params) {
    $user = member_target((int)$params['id']);
    $url = '/api/avatars/' . $user['id'] . '/' . $params['filename'];
    $filename = avatar_filename($url,(int)$user['id']);
    if (!$filename || $user['avatar_url']!==$url) fail(404,'not_found','Profile image not found.');
    $path = avatar_directory() . '/' . $user['id'] . '/' . $filename;
    if (!is_file($path)) fail(404,'not_found','Profile image not found.');
    session_write_close();
    header('Content-Type: ' . LOGO_TYPES[pathinfo($filename,PATHINFO_EXTENSION)]);
    header('Content-Disposition: inline; filename="' . $filename . '"');
    header("Content-Security-Policy: default-src 'none'; img-src data:; style-src 'unsafe-inline'; sandbox");
    header('Cache-Control: private, no-store');
    header('Vary: Cookie');
    header('Content-Length: ' . filesize($path));
    readfile($path);
    exit;
});
