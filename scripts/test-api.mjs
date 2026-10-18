import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const directory = await mkdtemp(join(tmpdir(), "purpleroom-api-"));
const setupKey = randomBytes(32).toString("hex");
const env = {
  ...process.env,
  PURPLEROOM_ENV: "dev",
  GREEN_ROOM_DB: join(directory, "test.sqlite"),
  GREEN_ROOM_SETUP_KEY: setupKey,
};
const origin = "http://127.0.0.1:8018";
let server;
let log = "";
function cli(code, args = []) {
  const result = spawnSync(
    "php",
    [
      "-r",
      "define('GREEN_ROOM',true); $config=require 'api/config.php'; require 'api/lib/db.php'; " +
        code,
      ...args,
    ],
    { env, encoding: "utf8" }
  );
  assert.equal(result.status, 0, result.stderr);
  return result.stdout;
}
function client() {
  let cookie = "";
  return async (path, method = "GET", body, expected = 200, csrf = true) => {
    const response = await fetch(origin + "/api" + path, {
      method,
      headers: {
        Cookie: cookie,
        "Content-Type": "application/json",
        ...(csrf ? { "X-Requested-With": "green-room" } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (response.headers.has("set-cookie"))
      cookie = response.headers.get("set-cookie").split(";")[0];
    const bytes = Buffer.from(await response.arrayBuffer());
    const text = bytes.toString("utf8");
    assert.equal(
      response.status,
      expected,
      `${method} ${path}: ${text}\n${log}`
    );
    if (response.headers.get("content-type")?.startsWith("image/")) {
      assert.equal(response.headers.get("x-content-type-options"), "nosniff");
      assert.equal(response.headers.get("cache-control"), "private, no-store");
      assert.equal(response.headers.get("vary"), "Cookie");
      assert.ok(
        response.headers.get("content-security-policy").includes("sandbox")
      );
      return bytes;
    }
    if (
      text &&
      response.headers.get("content-type")?.includes("application/json")
    )
      return JSON.parse(text);
    return text;
  };
}
async function signup(request, email, name) {
  const before = Number(
    cli("echo one('SELECT COUNT(*) AS n FROM users')['n'];")
  );
  const result = await request("/auth/request", "POST", { email });
  assert.ok(result.link);
  assert.equal(
    Number(cli("echo one('SELECT COUNT(*) AS n FROM users')['n'];")),
    before,
    "Requesting email must not create an account"
  );
  const token = result.link.split("/").at(-1);
  const verified = await request("/auth/verify", "POST", { token });
  assert.equal(verified.user.role, "member");
  assert.equal(verified.user.profile_complete, 0);
  await request("/users", "GET", undefined, 403);
  await request("/papers", "POST", { title: "Not onboarded" }, 403);
  await request("/me", "PATCH", { name: " " }, 422);
  const complete = await request("/me", "PATCH", { name });
  assert.equal(complete.user.profile_complete, 1);
  await client()("/auth/verify", "POST", { token }, 422);
  return complete.user;
}
try {
  server = spawn(
    "php",
    ["-S", "127.0.0.1:8018", "-t", ".", "api/dev-router.php"],
    { env, stdio: ["ignore", "ignore", "pipe"] }
  );
  server.stderr.on("data", (chunk) => {
    log += chunk;
  });
  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      if ((await fetch(origin + "/api/health")).ok) break;
    } catch {
      /* starting */
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  const admin = client(),
    alice = client(),
    bob = client(),
    stranger = client(),
    anonymous = client();
  await anonymous(
    "/auth/request",
    "POST",
    { email: "missing@example.com" },
    503
  );
  await anonymous(
    "/setup",
    "POST",
    { setup_key: "wrong", name: "Nico", email: "mail@nico.dev" },
    403
  );
  const owner = (
    await admin(
      "/setup",
      "POST",
      { setup_key: setupKey, name: "Nico", email: "mail@nico.dev" },
      201
    )
  ).user;
  assert.equal(owner.role, "admin");
  await anonymous(
    "/setup",
    "POST",
    { setup_key: setupKey, name: "Other", email: "other@example.com" },
    409
  );
  for (const path of [
    "/me",
    "/users",
    "/crew",
    "/conferences",
    "/editions",
    "/dashboard",
    "/papers",
    "/admin/users",
    "/trash",
  ])
    await anonymous(path, "GET", undefined, 401);
  for (const path of ["/invites", "/cal/legacy.ics"])
    await anonymous(path, "GET", undefined, 404);
  await admin("/me/cal-token", "POST", undefined, 404);
  await admin("/comments", "POST", { conference_id: 1, text: "No notes" }, 404);
  assert.equal((await admin("/me")).cal_url, undefined);
  const a = await signup(alice, "alice@example.com", "Alice");
  const b = await signup(bob, "bob@example.com", "Bob");
  const s = await signup(stranger, "stranger@example.com", "Stranger");
  const links = {
    homepage_url: "https://bob.example",
    github_url: "https://github.com/bob",
    linkedin_url: "https://www.linkedin.com/in/bob",
    x_url: "https://x.com/bob",
    bluesky_url: "https://bsky.app/profile/bob.example",
    instagram_url: "https://www.instagram.com/bob",
    youtube_url: "https://www.youtube.com/@bob",
    mastodon_url: "https://any-instance.example/@bob",
  };
  const linked = (await bob("/me", "PATCH", links)).user;
  for (const [key, value] of Object.entries(links))
    assert.equal(linked[key], value);
  const memberProfile = await alice(`/users/${b.id}`);
  assert.equal(memberProfile.user.email, undefined);
  for (const [key, value] of Object.entries(links))
    assert.equal(
      memberProfile.user[key],
      value,
      "Profile links are visible to signed-in non-friends"
    );
  await bob("/me", "PATCH", { name: "Bob" });
  assert.equal(
    (await bob("/me")).user.github_url,
    links.github_url,
    "Unrelated edits retain links"
  );
  for (const value of [
    "javascript:alert(1)",
    "data:text/html,hi",
    "ftp://example.com/a",
    "https://user:password@example.com",
    "https://example.com/" + "a".repeat(2048),
    {},
    23,
  ])
    await bob("/me", "PATCH", { github_url: value }, 422);
  await bob(
    "/me",
    "PATCH",
    {
      name: "Do not save",
      avatar_url: "http://127.0.0.1/avatar.png",
      github_url: "https://github.com/changed",
    },
    422
  );
  assert.equal((await bob("/me")).user.name, "Bob");
  assert.equal(
    (await bob("/me")).user.github_url,
    links.github_url,
    "Failed avatar import must not save other profile changes"
  );
  const avatarPath = cli(
    `
    foreach (['http','remote','logos','profiles'] as $file) require 'api/lib/' . $file . '.php';
    $svg='<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" onload="alert(1)"><rect width="40" height="40" fill="rebeccapurple"/><script>alert(2)</script></svg>';
    $extension=validate_logo_image($svg,$safe);
    $path=store_avatar((int)$argv[1],['bytes'=>$safe,'extension'=>$extension]);
    update('users',(int)$argv[1],['avatar_url'=>$path]); echo $path;
  `,
    [String(b.id)]
  ).trim();
  const avatarBytes = await alice(avatarPath.slice(4));
  assert.ok(avatarBytes.toString("utf8").includes("<svg"));
  assert.ok(
    !avatarBytes.toString("utf8").includes("onload") &&
      !avatarBytes.toString("utf8").includes("<script")
  );
  await anonymous(avatarPath.slice(4), "GET", undefined, 401);
  await alice("/me", "PATCH", { avatar_url: avatarPath }, 422);
  await bob("/me", "PATCH", { avatar_url: avatarPath, name: "Bob" });
  assert.equal((await bob("/me")).user.avatar_url, avatarPath);
  await bob("/me", "PATCH", { mastodon_url: "" });
  assert.equal((await bob("/me")).user.mastodon_url, null);
  assert.equal((await alice("/users")).length, 4);
  assert.ok((await alice("/users")).every((u) => !u.email && !u.cal_token));
  await alice("/me", "PATCH", {
    name: "Alice",
    role: "admin",
    suspended: false,
  });
  assert.equal((await alice("/me")).user.role, "member");
  for (const [path, method, body] of [
    ["/conferences", "POST", { name: "No" }],
    ["/editions", "POST", { conference_id: 1 }],
    ["/conferences/metadata", "POST", { url: "https://example.com" }],
    ["/trash", "GET"],
    ["/admin/users", "GET"],
    [`/admin/users/${a.id}`, "PATCH", { role: "admin" }],
  ])
    await alice(path, method, body, 403);
  await admin("/conferences", "POST", { name: "CSRF" }, 403, false);
  const c = await admin(
    "/conferences",
    "POST",
    { name: "JSNation", website: "https://jsnation.com" },
    201
  );
  await admin(
    "/conferences",
    "POST",
    { name: "Unsafe", website: "javascript:alert(1)" },
    422
  );
  await admin(
    "/conferences",
    "POST",
    { name: "Private logo", logo_url: "http://127.0.0.1/a.png" },
    422
  );
  await admin(
    "/conferences/metadata",
    "POST",
    { url: "http://127.0.0.1" },
    422
  );
  const future = (days) =>
    new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
  const e = await admin(
    "/editions",
    "POST",
    {
      conference_id: c.id,
      title: "JSNation Berlin 26",
      starts_on: future(30),
      ends_on: future(31),
      cfp_closes_on: future(5),
    },
    201
  );
  for (const [path, method, body] of [
    [`/conferences/${c.id}`, "PATCH", { name: "No" }],
    [`/conferences/${c.id}`, "DELETE"],
    [`/conferences/${c.id}/restore`, "POST"],
    [`/editions/${e.id}`, "PATCH", { title: "No" }],
    [`/editions/${e.id}`, "DELETE"],
    [`/editions/${e.id}/restore`, "POST"],
  ])
    await alice(path, method, body, 403);
  for (const [path, method] of [
    [`/conferences/${c.id}suffix`, "PATCH"],
    [`/conferences/${c.id}suffix/restore`, "POST"],
    [`/editions/${e.id}suffix`, "DELETE"],
  ])
    await alice(path, method, { name: "No" }, 403);
  await admin(`/editions/${e.id}`, "PATCH", { ends_on: "2000-01-01" }, 422);
  const paper = await bob(
    "/papers",
    "POST",
    {
      title: "SECRET TITLE",
      abstract: "SECRET ABSTRACT",
      notes: "SECRET NOTES",
    },
    201
  );
  const paper2 = await bob("/papers", "POST", { title: "SECOND SECRET" }, 201);
  const sub = await bob(
    "/submissions",
    "POST",
    {
      paper_id: paper.id,
      edition_id: e.id,
      status: "submitted",
      abstract_override: "SECRET OVERRIDE",
    },
    201
  );
  const sub2 = await bob(
    "/submissions",
    "POST",
    { paper_id: paper2.id, edition_id: e.id, status: "interested" },
    201
  );
  await bob(
    "/submissions",
    "POST",
    { paper_id: paper.id, edition_id: e.id },
    409
  );
  for (const request of [admin, alice, stranger]) {
    await request(`/papers/${paper.id}`, "GET", undefined, 404);
    await request(`/papers/${paper.id}`, "PATCH", { title: "No" }, 404);
    await request(
      `/submissions/${sub.id}`,
      "PATCH",
      { status: "confirmed" },
      403
    );
    const detail = await request(`/editions/${e.id}`);
    assert.equal(detail.submissions, undefined);
    assert.equal(detail.speaking, undefined);
    assert.equal(detail.comments, undefined);
    assert.equal(detail.submitted_friends.length, 0);
    assert.equal(detail.attendance.length, 0);
    assert.ok(!JSON.stringify(detail).includes("SECRET"));
  }
  await bob(`/conferences/${c.id}/review`, "PUT", {
    tags: ["covers_travel"],
    text: "FRIENDS REVIEW",
    would_submit_again: 1,
  });
  assert.equal(
    (await admin(`/conferences/${c.id}`)).review_count,
    0,
    "Admin does not bypass privacy"
  );
  await bob(`/editions/${e.id}/attendance`, "PUT", { status: "going" });
  assert.equal((await alice(`/users/${b.id}`)).plans.length, 0);
  await alice(`/crew/${a.id}/request`, "POST", undefined, 422);
  await alice(`/crew/${b.id}/request`, "POST");
  await alice(`/crew/${b.id}/request`, "POST");
  assert.equal((await bob("/crew")).incoming.length, 1);
  assert.equal(
    (await alice(`/editions/${e.id}`)).submitted_friends.length,
    0,
    "Pending request grants no access"
  );
  await alice(`/crew/${b.id}/accept`, "POST", undefined, 404);
  // Crossed requests are instant acceptance, not a second pending request.
  assert.equal(
    (await bob(`/crew/${a.id}/request`, "POST")).relationship,
    "friend"
  );
  assert.equal((await bob("/crew")).incoming.length, 0);
  assert.equal((await alice(`/editions/${e.id}`)).submitted_friends.length, 1);
  assert.equal((await alice(`/users/${b.id}`)).plans.length, 1);
  let detail = await alice(`/conferences/${c.id}`);
  assert.equal(detail.review_count, 1);
  assert.equal(detail.tag_counts.covers_travel, 1);
  assert.equal(detail.reviews[0].text, "FRIENDS REVIEW");
  assert.equal((await stranger(`/conferences/${c.id}`)).review_count, 0);
  for (const status of [
    "submitted",
    "accepted",
    "rejected",
    "waitlisted",
    "confirmed",
    "declined",
    "attended",
  ]) {
    await bob(`/submissions/${sub.id}`, "PATCH", { status });
    detail = await alice(`/editions/${e.id}`);
    assert.equal(detail.submitted_friends.length, 1);
    assert.equal(detail.going.length, 1);
    assert.equal(detail.maybe.length, 0);
    assert.ok(!JSON.stringify(detail).includes("SECRET"));
    assert.deepEqual(Object.keys(detail.submitted_friends[0]).sort(), [
      "avatar_url",
      "id",
      "name",
    ]);
  }
  await bob(`/submissions/${sub2.id}`, "PATCH", { status: "rejected" });
  assert.equal(
    (await alice(`/editions/${e.id}`)).submitted_friends.length,
    1,
    "Two submissions still count once"
  );
  await bob(`/submissions/${sub.id}`, "PATCH", { status: "interested" });
  await bob(`/submissions/${sub2.id}`, "PATCH", { status: "interested" });
  assert.equal((await alice(`/editions/${e.id}`)).submitted_friends.length, 0);
  await bob(`/submissions/${sub.id}`, "PATCH", { status: "declined" });
  await bob(`/editions/${e.id}/attendance`, "DELETE", undefined, 204);
  detail = await alice(`/editions/${e.id}`);
  assert.equal(detail.going.length, 0);
  assert.equal(detail.maybe.length, 0);
  assert.equal(detail.submitted_friends.length, 1);
  await alice(`/editions/${e.id}/attendance`, "PUT", { status: "maybe" });
  detail = await alice(`/editions/${e.id}`);
  assert.equal(detail.maybe[0].id, a.id, "Attendance does not require a talk");
  const dashboard = await alice("/dashboard");
  assert.equal(dashboard.open_cfps[0].submitters.length, 1);
  assert.ok(!JSON.stringify(dashboard).includes("SECRET"));
  assert.ok(
    dashboard.recent_activity.every(
      (x) => !["submission_status", "comment"].includes(x.type)
    )
  );
  await alice(`/crew/${b.id}`, "DELETE", undefined, 204);
  assert.equal((await alice(`/editions/${e.id}`)).submitted_friends.length, 0);
  assert.equal((await alice(`/conferences/${c.id}`)).review_count, 0);
  assert.equal((await alice(`/users/${b.id}`)).plans.length, 0);
  await alice(`/crew/${b.id}/request`, "POST");
  await bob(`/crew/${a.id}/accept`, "POST");
  await bob(`/crew/${a.id}/block`, "POST", undefined, 204);
  await alice(avatarPath.slice(4), "GET", undefined, 404);
  assert.ok(!(await alice("/users")).some((u) => u.id === b.id));
  await alice(`/users/${b.id}`, "GET", undefined, 404);
  await alice(`/crew/${b.id}/request`, "POST", undefined, 404);
  assert.equal((await alice(`/editions/${e.id}`)).submitted_friends.length, 0);
  await bob(`/crew/${a.id}/block`, "DELETE", undefined, 204);
  assert.equal((await alice(`/users/${b.id}`)).relationship, "none");
  await alice(`/crew/${b.id}/request`, "POST");
  await bob(`/crew/${a.id}`, "DELETE", undefined, 204);
  assert.equal(
    (await alice("/crew")).outgoing.length,
    0,
    "Decline removes pending request"
  );
  await alice(`/crew/${b.id}/request`, "POST");
  await alice(`/crew/${b.id}`, "DELETE", undefined, 204);
  await admin(`/admin/users/${owner.id}`, "PATCH", { role: "member" }, 409);
  await admin(`/admin/users/${owner.id}`, "PATCH", { suspended: true }, 409);
  await admin(`/admin/users/${a.id}`, "PATCH", { role: "admin" });
  assert.equal((await alice("/me")).user.role, "admin");
  await alice(`/admin/users/${owner.id}`, "PATCH", { role: "member" });
  await admin("/conferences", "POST", { name: "Demoted admin" }, 403);
  await alice(`/admin/users/${owner.id}`, "PATCH", { role: "admin" });
  await alice(`/crew/${b.id}/request`, "POST");
  await bob(`/crew/${a.id}/accept`, "POST");
  const pendingLogin = await anonymous("/auth/request", "POST", {
    email: "bob@example.com",
  });
  await admin(`/admin/users/${b.id}`, "PATCH", { suspended: true });
  await stranger(avatarPath.slice(4), "GET", undefined, 404);
  await bob("/me", "GET", undefined, 401);
  assert.ok(!(await alice("/users")).some((u) => u.id === b.id));
  assert.equal((await alice(`/editions/${e.id}`)).submitted_friends.length, 0);
  await anonymous(
    "/auth/verify",
    "POST",
    { token: pendingLogin.link.split("/").at(-1) },
    401
  );
  assert.deepEqual(
    await anonymous("/auth/request", "POST", { email: "bob@example.com" }),
    { ok: true }
  );
  await admin(`/admin/users/${b.id}`, "PATCH", { suspended: false });
  await bob("/me", "GET", undefined, 401);
  const login = await bob("/auth/request", "POST", {
    email: "BOB@example.com",
  });
  await bob("/auth/verify", "POST", { token: login.link.split("/").at(-1) });
  assert.equal((await bob("/me")).user.id, b.id);
  assert.equal(
    (await alice(`/editions/${e.id}`)).submitted_friends.length,
    1,
    "Suspension retains friendships/data"
  );
  const limited = client();
  for (let i = 0; i < 5; i++)
    await limited("/auth/request", "POST", { email: "throttle@example.com" });
  assert.deepEqual(
    await limited("/auth/request", "POST", { email: "throttle@example.com" }),
    { ok: true }
  );
  const own = await bob(`/editions/${e.id}`);
  assert.equal(own.my_submissions[0].abstract_override, "SECRET OVERRIDE");
  await admin(`/conferences/${c.id}`, "DELETE", undefined, 204);
  await alice(`/editions/${e.id}`, "GET", undefined, 404);
  assert.equal(
    (await bob("/papers"))[0].submissions.length,
    1,
    "Owners retain archived submissions"
  );
  assert.equal(
    (await bob("/papers"))[0].submissions[0].conference.deleted_at !== null,
    true
  );
  await admin(`/conferences/${c.id}/restore`, "POST");
  await bob(`/submissions/${sub.id}`, "DELETE", undefined, 204);
  assert.equal((await alice(`/editions/${e.id}`)).submitted_friends.length, 0);
  await bob(`/papers/${paper.id}`, "DELETE", undefined, 204);
  await bob("/me", "PATCH", { avatar_url: null });
  await bob(avatarPath.slice(4), "GET", undefined, 404);
  for (const secret of [
    "/db/db.sqlite",
    "/db/schema.sql",
    "/db/invite-links/key.bin",
    "/db/avatars/1/avatar.png",
    "/lib/db.php",
    "/config.php",
    "/config.local.php",
  ])
    await anonymous(secret, "GET", undefined, 403);
  await admin("/auth/logout", "POST", undefined, 204);
  await admin("/me", "GET", undefined, 401);
  console.log(
    "API checks passed: verified public signup, onboarding, roles, ownership, friend requests/crossed acceptance, unique submitter privacy, manual attendance, review visibility, unfriend/block, suspension/session revocation, last-admin safeguards, retired endpoints, rate limits, archive preservation, and protected files."
  );
} finally {
  if (server) {
    server.kill("SIGTERM");
    await new Promise((resolve) => server.once("exit", resolve));
  }
  await rm(directory, { recursive: true, force: true });
}
