<?php
declare(strict_types=1);
if (!defined('GREEN_ROOM')) exit;

class RemoteResourceException extends RuntimeException {
    public function __construct(string $message, public readonly string $reason = 'download_failed', public readonly int $status = 422) { parent::__construct($message); }
}

function resolve_remote_url(string $base, string $reference): string {
    $reference = trim($reference);
    if (preg_match('#^[a-z][a-z0-9+.-]*:#i', $reference)) return $reference;
    $url = parse_url($base);
    $origin = $url['scheme'] . '://' . $url['host'] . (isset($url['port']) ? ':' . $url['port'] : '');
    if (str_starts_with($reference, '//')) return $url['scheme'] . ':' . $reference;
    if (str_starts_with($reference, '/')) return $origin . $reference;
    $path = $url['path'] ?? '/';
    if (str_starts_with($reference, '?')) return $origin . $path . $reference;
    if ($reference === '' || str_starts_with($reference, '#')) return preg_replace('/#.*$/', '', $base) . $reference;
    return $origin . substr($path, 0, (int) strrpos($path, '/') + 1) . $reference;
}

function public_remote_target(string $url, ?callable $resolver = null): array {
    if (!filter_var($url, FILTER_VALIDATE_URL)) throw new RemoteResourceException('Enter a valid public image URL.', 'unsafe_url');
    $parts = parse_url($url);
    if (!in_array(strtolower($parts['scheme'] ?? ''), ['http', 'https'], true) || isset($parts['user']) || isset($parts['pass']) || !isset($parts['host']) || isset($parts['port']) && !in_array($parts['port'], [80, 443], true)) throw new RemoteResourceException('Only public http(s) URLs on standard ports are allowed.', 'unsafe_url');
    $host = strtolower(trim($parts['host'], '[]'));
    if ($host === 'localhost' || str_ends_with($host, '.localhost') || str_ends_with($host, '.local')) throw new RemoteResourceException('Private network addresses are not allowed.', 'unsafe_url');
    $literal = filter_var($host, FILTER_VALIDATE_IP) !== false;
    // cURL accepts shorthand/octal/hex IPv4 spellings which PHP's IP validator does not.
    // Never let those bypass DNS pinning by being interpreted differently at connect time.
    if (!$literal && preg_match('/^(?:0x[0-9a-f]+|[0-9]+)(?:\.(?:0x[0-9a-f]+|[0-9]+)){0,3}\.?$/i', $host)) throw new RemoteResourceException('Use a standard public hostname or IP address.', 'unsafe_url');
    if ($literal) $ips = [$host];
    else {
        $resolver ??= function (string $hostname): array {
            return array_values(array_filter(array_map(fn($record) => $record['ip'] ?? $record['ipv6'] ?? null, @dns_get_record($hostname, DNS_A | DNS_AAAA) ?: [])));
        };
        $ips = $resolver($host);
    }
    if (!$ips) throw new RemoteResourceException('The image host could not be resolved. Check the URL and try again.');
    foreach ($ips as $ip) {
        // Reject the entire answer if any address is unsafe, including mixed public/private DNS.
        if (!filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_GLOBAL_RANGE | FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE) || str_starts_with(strtolower($ip), '::ffff:') || preg_match('/^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./', $ip)) throw new RemoteResourceException('Private or reserved network addresses are not allowed.', 'unsafe_url');
    }
    return ['host' => $host, 'ip' => $ips[0], 'literal' => $literal, 'port' => $parts['port'] ?? (strtolower($parts['scheme']) === 'https' ? 443 : 80)];
}

function curl_remote_resource(string $url, array $target, int $limit, int $timeout): array {
    if (!function_exists('curl_init')) throw new RemoteResourceException('PHP cURL must be enabled to download conference logos.', 'unavailable', 503);
    $curl = curl_init($url); $bytes = ''; $location = null; $headerBytes = 0;
    $options = [
        CURLOPT_TIMEOUT_MS => $timeout, CURLOPT_CONNECTTIMEOUT_MS => min(3000, $timeout),
        CURLOPT_FOLLOWLOCATION => false, CURLOPT_PROTOCOLS => CURLPROTO_HTTP | CURLPROTO_HTTPS,
        CURLOPT_PROXY => '', CURLOPT_USERAGENT => 'GreenRoom/1.0', CURLOPT_SSL_VERIFYPEER => true, CURLOPT_SSL_VERIFYHOST => 2,
        CURLOPT_WRITEFUNCTION => function ($ch, string $chunk) use (&$bytes, $limit): int {
            if (strlen($bytes) + strlen($chunk) > $limit) return 0;
            $bytes .= $chunk; return strlen($chunk);
        },
        CURLOPT_HEADERFUNCTION => function ($ch, string $header) use (&$location, &$headerBytes): int {
            $headerBytes += strlen($header);
            if ($headerBytes > 65536) return 0;
            if (stripos($header, 'Location:') === 0) $location = trim(substr($header, 9));
            return strlen($header);
        },
    ];
    if (!$target['literal']) $options[CURLOPT_RESOLVE] = [$target['host'] . ':' . $target['port'] . ':' . (str_contains($target['ip'], ':') ? '[' . $target['ip'] . ']' : $target['ip'])];
    curl_setopt_array($curl, $options);
    $success = curl_exec($curl);
    $status = curl_getinfo($curl, CURLINFO_HTTP_CODE);
    curl_close($curl);
    if ($success === false) throw new RemoteResourceException('Could not download the image within the time/size limit. Check the URL or remove the logo and try again.');
    return ['body' => $bytes, 'status' => $status, 'location' => $location];
}

function fetch_public_resource(string $url, int $limit, ?callable $resolver = null, ?callable $transport = null): array {
    $transport ??= 'curl_remote_resource';
    $deadline = microtime(true) + 5;
    for ($redirects = 0; $redirects <= 3; $redirects++) {
        $target = public_remote_target($url, $resolver);
        $timeout = (int) (($deadline - microtime(true)) * 1000);
        if ($timeout <= 0) throw new RemoteResourceException('The image server took too long to respond.');
        $response = $transport($url, $target, $limit, $timeout);
        if (strlen($response['body']) > $limit) throw new RemoteResourceException('The downloaded file is too large.');
        if (in_array($response['status'], [301, 302, 303, 307, 308], true) && $response['location']) {
            $limit -= strlen($response['body']);
            $url = resolve_remote_url($url, $response['location']);
            continue; // Resolve and pin DNS again before every redirect; never forward cookies or credentials.
        }
        if ($response['status'] < 200 || $response['status'] >= 300) throw new RemoteResourceException('The image server did not return an image. Check the URL or remove the logo and try again.');
        return ['body' => $response['body'], 'url' => $url];
    }
    throw new RemoteResourceException('The image URL redirects too many times. Use a direct image URL.');
}
