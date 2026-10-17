import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const directory = await mkdtemp(join(tmpdir(), "green-room-test-"));
const setupKey = randomBytes(32).toString("hex");
const env = { ...process.env, GREEN_ROOM_ENV: "dev", GREEN_ROOM_DB: join(directory, "test.sqlite"), GREEN_ROOM_SETUP_KEY: setupKey };
let server;
let failures = "";
const origin = "http://127.0.0.1:8018";
function cli(args) {
  const result = spawnSync("php", args, { env, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout;
}
function client() {
  let cookie = "";
  return async function request(path, method = "GET", body, expected = 200, csrf = true) {
    const response = await fetch(origin + "/api" + path, {
      method, headers: { "Content-Type": "application/json", ...(csrf ? { "X-Requested-With": "green-room" } : {}), Cookie: cookie },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (response.headers.has("set-cookie")) cookie = response.headers.get("set-cookie").split(";")[0];
    const bytes = Buffer.from(await response.arrayBuffer());
    const text = bytes.toString("utf8");
    assert.equal(response.status, expected, `${method} ${path}: ${text}\n${failures}`);
    if (response.headers.get("content-type")?.startsWith("image/")) {
      assert.equal(response.headers.get("x-content-type-options"), "nosniff");
      assert.ok(response.headers.get("cache-control").includes("private"));
      return bytes;
    }
    return response.headers.get("content-type")?.includes("application/json") && text ? JSON.parse(text) : text;
  };
}
try {
  server = spawn("php", ["-S", "127.0.0.1:8018", "-t", ".", "api/dev-router.php"], { env, stdio: ["ignore", "ignore", "pipe"] });
  server.stderr.on("data", (chunk) => { failures += chunk; });
  for (let attempts = 0; attempts < 50; attempts++) {
    try { if ((await fetch(origin + "/api/health")).ok) break; } catch { /* server starting */ }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  const owner = client(); const other = client(); const anonymous = client();
  const missingSchema = await anonymous("/auth/request", "POST", { email: "speaker@example.com" }, 503);
  assert.equal(missingSchema.error.code, "setup_required");
  await anonymous("/setup", "POST", { setup_key: setupKey, name: "Test Speaker", email: "speaker@example.com" }, 403, false);
  await anonymous("/setup", "POST", { setup_key: "wrong-key", name: "Test Speaker", email: "speaker@example.com" }, 403);
  await anonymous("/setup", "POST", { setup_key: setupKey, name: "Test Speaker", email: "not-an-email" }, 422);
  const bootstrap = await owner("/setup", "POST", { setup_key: setupKey, name: "Test Speaker", email: "speaker@example.com" }, 201);
  assert.equal(bootstrap.user.email, "speaker@example.com");
  assert.equal((await owner("/me")).user.id, bootstrap.user.id);
  assert.equal((await owner("/users")).length, 1);
  await anonymous("/setup", "POST", { setup_key: setupKey, name: "Intruder", email: "intruder@example.com" }, 409);
  assert.equal((await owner("/users")).length, 1);
  cli(["api/db/migrate.php"]);
  cli(["api/db/migrate.php"]);
  const seed = cli(["api/db/seed.php", "Test Speaker", "speaker@example.com"]);
  const token = seed.match(/\/auth\/([a-f0-9]{64})/)[1];
  await owner("/auth/logout", "POST", undefined, 204);
  await anonymous("/me", "GET", undefined, 401);
  await anonymous("/auth/request", "POST", { email: "nobody@example.com" }, 403, false);
  assert.deepEqual(await anonymous("/auth/request", "POST", { email: "nobody@example.com" }), { ok: true });
  const me = await owner("/auth/verify", "POST", { token });
  await anonymous("/auth/verify", "POST", { token }, 422);
  assert.equal(me.user.email, "speaker@example.com");
  assert.equal(me.user.cal_token, undefined);
  const conference = await owner("/conferences", "POST", { name: "JSNation", website: "https://jsnation.com", description: "JavaScript, together." }, 201);
  await owner("/conferences", "POST", { name: "Private image", logo_url: "http://127.0.0.1/logo.png" }, 422);
  assert.equal((await owner("/conferences")).length, 1, "Failed logo download must not create a conference");
  const logoUrl = cli(["-r", `
    define('GREEN_ROOM', true);
    $config = require 'api/config.php';
    foreach (['db', 'logos'] as $file) require 'api/lib/' . $file . '.php';
    $bytes = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aAt8AAAAASUVORK5CYII=');
    $url = store_conference_logo((int)$argv[1], 'JSNation', ['bytes' => $bytes, 'extension' => 'png']);
    update('conferences', (int)$argv[1], ['logo_url' => $url]);
    echo $url;
  `, String(conference.id)]).trim();
  const logo = await owner(logoUrl.slice(4));
  assert.ok(Buffer.isBuffer(logo) && logo[0] === 0x89);
  await anonymous(logoUrl.slice(4), "GET", undefined, 401);
  await owner(`/db/logos/${conference.id}/${logoUrl.split("/").at(-1)}`, "GET", undefined, 403);
  const savedLogo = await owner(`/conferences/${conference.id}`, "PATCH", { name: "JSNation", logo_url: logoUrl });
  assert.equal(savedLogo.logo_url, logoUrl);
  await owner(`/conferences/${conference.id}`, "PATCH", { logo_url: logoUrl.replace(`/conference-logos/${conference.id}/`, "/conference-logos/999/") }, 422);
  await owner(`/conferences/${conference.id}`, "PATCH", { name: "Do not save", logo_url: "http://127.0.0.1/logo.png" }, 422);
  assert.equal((await owner(`/conferences/${conference.id}`)).name, "JSNation");
  await owner("/conferences", "POST", { name: "Unsafe", website: "javascript:alert(1)" }, 422);
  await owner("/conferences/metadata", "POST", { url: "http://127.0.0.1" }, 422);
  const future = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  const edition = await owner("/editions", "POST", { conference_id: conference.id, year: 2027, city: "Amsterdam", country: "NL", starts_on: future, ends_on: future, cfp_closes_on: future }, 201);
  await owner(`/editions/${edition.id}`, "PATCH", { ends_on: "2000-01-01" }, 422);
  const paper = await owner("/papers", "POST", { title: "A private idea", abstract: "SECRET ABSTRACT", notes: "SECRET NOTES" }, 201);
  const submission = await owner("/submissions", "POST", { paper_id: paper.id, edition_id: edition.id, status: "submitted", hide_title: true, abstract_override: "SECRET OVERRIDE" }, 201);
  assert.ok(submission.submitted_on);
  await owner("/submissions", "POST", { paper_id: paper.id, edition_id: edition.id }, 409);
  await owner(`/conferences/${conference.id}/review`, "PUT", { tags: ["made_up"] }, 422);
  await owner(`/conferences/${conference.id}/review`, "PUT", { tags: ["covers_travel", "great_speaker_care"], text: "Lovely people.", would_submit_again: 1 });
  await owner(`/conferences/${conference.id}/review`, "PUT", { tags: [], text: "Updated take", would_submit_again: null });
  await owner(`/editions/${edition.id}/attendance`, "PUT", { status: "going" });
  const comment = await owner("/comments", "POST", { edition_id: edition.id, text: "See you there." }, 201);
  await owner("/comments", "POST", { conference_id: conference.id, edition_id: edition.id, text: "Ambiguous" }, 422);
  const invitation = await owner("/invites", "POST", { email: "friend@example.com" }, 201);
  const inviteToken = invitation.url.split("/").at(-1);
  assert.equal((await anonymous(`/invites/${inviteToken}`)).valid, true);
  await other(`/invites/${inviteToken}/accept`, "POST", { name: "Friend", email: "friend@example.com" }, 201);
  await anonymous(`/invites/${inviteToken}/accept`, "POST", { name: "Another", email: "another@example.com" }, 422);
  assert.equal((await other("/papers")).length, 0);
  await other(`/papers/${paper.id}`, "GET", undefined, 404);
  await other(`/papers/${paper.id}`, "PATCH", { title: "Nope" }, 404);
  await other(`/submissions/${submission.id}`, "PATCH", { status: "accepted" }, 403);
  await other(`/comments/${comment.id}`, "DELETE", undefined, 403);
  await other("/submissions", "POST", { paper_id: paper.id, edition_id: edition.id }, 404);
  const publicEdition = await other(`/editions/${edition.id}`);
  assert.equal(publicEdition.submissions[0].paper_title, null);
  assert.equal(publicEdition.submissions[0].user.email, undefined);
  assert.ok(!JSON.stringify(publicEdition).includes("SECRET"));
  assert.ok(!JSON.stringify(await other("/dashboard")).includes("SECRET"));
  assert.equal((await other("/users"))[0].email, undefined);
  await owner(`/submissions/${submission.id}`, "PATCH", { status: "confirmed" });
  const detailed = await owner(`/editions/${edition.id}`);
  assert.equal(detailed.going.length, 1, "Going users are deduplicated");
  assert.equal(detailed.speaking.length, 1);
  const dashboard = await owner("/dashboard");
  assert.equal(dashboard.open_cfps.length, 1);
  assert.ok(dashboard.recent_activity.length >= 4);
  const feed = (await owner("/me")).cal_url;
  const calendar = await anonymous(new URL(feed).pathname.slice(4));
  assert.ok(calendar.includes("CFP closes: JSNation"));
  assert.ok(calendar.includes("🎤 JSNation"));
  assert.ok(calendar.includes("\r\n"));
  for (const line of calendar.split("\r\n")) assert.ok(Buffer.byteLength(line) <= 75);
  await owner(`/conferences/${conference.id}`, "DELETE", undefined, 204);
  await owner(logoUrl.slice(4), "GET", undefined, 404);
  await other(`/editions/${edition.id}`, "GET", undefined, 404);
  assert.equal((await owner("/dashboard")).open_cfps.length, 0);
  assert.equal((await owner("/papers"))[0].submissions.length, 0);
  assert.equal((await owner("/trash")).conferences.length, 1);
  await other(`/conferences/${conference.id}/restore`, "POST");
  assert.ok(Buffer.isBuffer(await other(logoUrl.slice(4))), "Restoring a conference must retain its image");
  await other(`/editions/${edition.id}`, "DELETE", undefined, 204);
  await owner(`/editions/${edition.id}/restore`, "POST");
  const rotated = await owner("/me/cal-token", "POST");
  assert.notEqual(rotated.cal_url, feed);
  await anonymous(new URL(feed).pathname.slice(4), "GET", undefined, 404);
  for (const secret of ["/db/db.sqlite", "/db/schema.sql", "/lib/db.php", "/config.php", "/config.local.php"]) await anonymous(secret, "GET", undefined, 403);
  await owner(`/papers/${paper.id}`, "DELETE", undefined, 204);
  assert.equal((await owner(`/editions/${edition.id}`)).submissions.length, 0);
  await owner("/auth/logout", "POST", undefined, 204);
  await owner("/me", "GET", undefined, 401);
  server.kill("SIGTERM");
  await new Promise((resolve) => server.once("exit", resolve));
  server = spawn("php", ["-S", "127.0.0.1:8018", "-t", ".", "api/dev-router.php"], { env: { ...env, GREEN_ROOM_SETUP_KEY: "" }, stdio: ["ignore", "ignore", "pipe"] });
  server.stderr.on("data", (chunk) => { failures += chunk; });
  for (let attempts = 0; attempts < 50; attempts++) {
    try { if ((await fetch(origin + "/api/health")).ok) break; } catch { /* server starting */ }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  const disabled = await anonymous("/setup", "POST", { setup_key: setupKey, name: "Intruder", email: "intruder@example.com" }, 404);
  assert.equal(disabled.error.code, "not_found");
  console.log("API integration checks passed: one-time web setup, disabled setup, missing-schema diagnostics, authentication, CSRF, validation, CRUD, privacy, ownership, invites, dashboard, calendar, soft delete/restore, and protected files.");
} finally {
  if (server) {
    server.kill("SIGTERM");
    await new Promise((resolve) => server.once("exit", resolve));
  }
  await rm(directory, { recursive: true, force: true });
}
