import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";

const directory = await mkdtemp(join(tmpdir(), "green-room-logos-"));
try {
  const result = spawnSync("php", ["scripts/test-logos.php"], {
    env: { ...process.env, GREEN_ROOM_DB: join(directory, "db.sqlite") },
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  process.stdout.write(result.stdout);

  // Exercise the real cURL transport against an isolated local fixture, not a live website.
  // Public-address policy is separately tested above; the transport is given its pinned target directly.
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aAt8AAAAASUVORK5CYII=",
    "base64"
  );
  const requests = [];
  const server = createServer((request, response) => {
    requests.push(request.headers);
    if (request.url === "/redirect") {
      response.writeHead(302, { Location: "/logo" });
      response.end();
      return;
    }
    response.setHeader("Content-Type", "image/png");
    response.end(request.url === "/large" ? Buffer.alloc(4096) : png);
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const port = server.address().port;
    const child = spawn(
      "php",
      [
        "-r",
        `
      define('GREEN_ROOM', true); require 'api/lib/remote.php';
      $target = ['host' => 'images.example.test', 'ip' => '127.0.0.1', 'port' => (int)$argv[1], 'literal' => false];
      $base = 'http://images.example.test:' . $argv[1];
      $image = curl_remote_resource($base . '/logo', $target, 1024, 3000);
      $redirect = curl_remote_resource($base . '/redirect', $target, 1024, 3000);
      $bounded = false;
      try { curl_remote_resource($base . '/large', $target, 16, 3000); }
      catch (RemoteResourceException) { $bounded = true; }
      echo json_encode(['image' => base64_encode($image['body']), 'status' => $image['status'], 'redirect' => $redirect, 'bounded' => $bounded], JSON_THROW_ON_ERROR);
    `,
        String(port),
      ],
      { stdio: ["ignore", "pipe", "pipe"] }
    );
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    const [code] = await once(child, "close");
    assert.equal(code, 0, stderr);
    const transport = JSON.parse(stdout);
    assert.equal(transport.image, png.toString("base64"));
    assert.equal(transport.status, 200);
    assert.equal(
      transport.redirect.status,
      302,
      "cURL must not follow redirects without policy validation"
    );
    assert.equal(transport.redirect.location, "/logo");
    assert.equal(transport.bounded, true);
    assert.equal(requests.length, 3);
    for (const headers of requests) {
      assert.equal(headers.host, `images.example.test:${port}`);
      assert.equal(headers.cookie, undefined);
      assert.equal(headers.authorization, undefined);
    }
    console.log(
      "Real cURL transport checks passed: pinned DNS, binary images, manual redirects, size limit, and no forwarded credentials."
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
} finally {
  await rm(directory, { recursive: true, force: true });
}
