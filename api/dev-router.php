<?php
declare(strict_types=1);
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
if (preg_match('#^/api/(db|lib|routes)(/|$)|^/api/(config[^/]*|dev-router)\.php$#', $path)) {
    http_response_code(403);
    exit('Forbidden');
}
if ($path === '/api' || str_starts_with($path, '/api/') || preg_match('#^/u/[^/]+/?$#D', $path)) {
    require __DIR__ . '/index.php';
    return true;
}
http_response_code(404);
echo 'Use the Vite URL (http://localhost:5173) for the UI.';
