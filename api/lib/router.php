<?php
declare(strict_types=1);
if (!defined('GREEN_ROOM')) exit;
$routes = [];
function route(string $method, string $path, callable $handler, bool $public = false): void {
    global $routes;
    $routes[] = [$method, '#^' . preg_replace('/\{([a-z_]+)\}/', '(?P<$1>[^/]+)', $path) . '$#', $handler, $public];
}
function dispatch(): never {
    global $routes;
    $method = $_SERVER['REQUEST_METHOD'];
    $path = substr(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH), 4) ?: '/';
    if (in_array($method, ['POST', 'PATCH', 'PUT', 'DELETE'], true) && ($_SERVER['HTTP_X_REQUESTED_WITH'] ?? '') !== 'green-room') fail(403, 'csrf', 'Missing request header.');
    foreach ($routes as [$verb, $pattern, $handler, $public]) {
        if ($method !== $verb || !preg_match($pattern, $path, $matches)) continue;
        if (!in_array($path, ['/health', '/setup'], true)) {
            ensure_database_migrations();
            purge_deleted_account_files();
        }
        if (!$public) {
            $user = require_login();
            if (!$user['profile_complete'] && $path !== '/me') fail(403, 'profile_required', 'Choose a display name to complete your profile.');
            // Match the same arbitrary path segments as route(), not only numeric IDs:
            // PHP handlers cast IDs, so /conferences/1suffix must not bypass admin checks.
            $catalogWrite = $method !== 'GET' && (preg_match('#^/conferences(?:/[^/]+(?:/restore)?)?$#', $path) || preg_match('#^/editions(?:/[^/]+(?:/restore)?)?$#', $path));
            if ($catalogWrite || $path === '/trash') require_admin();
        }
        $params = array_filter($matches, 'is_string', ARRAY_FILTER_USE_KEY);
        $handler($params);
        json_response(null, 204);
    }
    fail(404, 'not_found', 'This endpoint does not exist.');
}
