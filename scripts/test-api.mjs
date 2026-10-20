import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { readdirSync } from "node:fs";
import {
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  rmdir,
  symlink,
  unlink,
  writeFile,
} from "node:fs/promises";
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
  const request = async (
    path,
    method = "GET",
    body,
    expected = 200,
    csrf = true
  ) => {
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
  request.cookie = () => cookie;
  return request;
}
async function signup(request, email, name) {
  const before = Number(
    cli("echo one('SELECT COUNT(*) AS n FROM users')['n'];")
  );
  const result = await request("/auth/request", "POST", { email });
  assert.match(result.code, /^[0-9]{6}$/);
  assert.equal(
    Number(cli("echo one('SELECT COUNT(*) AS n FROM users')['n'];")),
    before,
    "Requesting email must not create an account"
  );
  const credentials = { request_id: result.request_id, code: result.code };
  const verified = await request("/auth/verify", "POST", credentials);
  assert.equal(verified.user.role, "member");
  assert.equal(verified.user.profile_complete, 0);
  await request("/users", "GET", undefined, 403);
  await request("/papers", "POST", { title: "Not onboarded" }, 403);
  await request("/me", "PATCH", { name: " " }, 422);
  const complete = await request("/me", "PATCH", { name });
  assert.equal(complete.user.profile_complete, 1);
  await client()("/auth/verify", "POST", credentials, 422);
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
  await admin("/me", "DELETE", { confirmation: "DELETE" }, 409);
  assert.equal(
    (await admin("/me")).user.id,
    owner.id,
    "The last-admin refusal must leave the account intact"
  );
  await anonymous("/me", "DELETE", { confirmation: "DELETE" }, 401);
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
    "/submissions",
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
    {
      name: "JSNation",
      website: "https://jsnation.com",
      tags: [" JavaScript ", "javascript", " Accessibility ", "", "2026"],
    },
    201
  );
  assert.deepEqual(c.tags, ["javascript", "accessibility", "2026"]);
  assert.equal(c.has_open_cfp, false);
  await admin(`/conferences/${c.id}`, "PATCH", { name: "JSNation" });
  assert.deepEqual(
    (await alice(`/conferences/${c.id}`)).tags,
    c.tags,
    "Omitted tags must be retained"
  );
  for (const tags of [
    null,
    "javascript",
    { invalid: true },
    [12],
    ["x".repeat(51)],
    ["a,b"],
    Array.from({ length: 21 }, (_, i) => String(i)),
  ])
    await admin(`/conferences/${c.id}`, "PATCH", { tags }, 422);
  await alice(`/conferences/${c.id}`, "PATCH", { tags: ["changed"] }, 403);
  assert.deepEqual(
    (await admin(`/conferences/${c.id}`, "PATCH", { tags: [] })).tags,
    []
  );
  await admin(`/conferences/${c.id}`, "PATCH", {
    tags: ["javascript", "accessibility"],
  });
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
  assert.equal((await alice(`/conferences/${c.id}`)).has_open_cfp, true);
  const filters = await admin(
    "/conferences",
    "POST",
    { name: "CFP date checks", tags: ["test"] },
    201
  );
  const makeFilterEdition = async (data) =>
    admin("/editions", "POST", { conference_id: filters.id, ...data }, 201);
  const closedEdition = await makeFilterEdition({
    starts_on: future(10),
    cfp_closes_on: future(-1),
  });
  const notYet = await makeFilterEdition({
    starts_on: future(20),
    cfp_opens_on: future(5),
    cfp_closes_on: future(10),
  });
  const unknownDeadline = await makeFilterEdition({ starts_on: future(22) });
  assert.equal((await alice(`/conferences/${filters.id}`)).has_open_cfp, false);
  const deletedOpen = await makeFilterEdition({
    starts_on: future(25),
    cfp_closes_on: future(2),
  });
  assert.equal((await alice(`/conferences/${filters.id}`)).has_open_cfp, true);
  await admin(`/editions/${deletedOpen.id}`, "DELETE", undefined, 204);
  assert.equal(
    (await alice(`/conferences/${filters.id}`)).has_open_cfp,
    false,
    "Deleted editions cannot qualify"
  );
  const laterOpen = await makeFilterEdition({
    starts_on: future(30),
    cfp_opens_on: future(-2),
    cfp_closes_on: future(10),
  });
  const mixed = await alice(`/conferences/${filters.id}`);
  assert.equal(mixed.next_edition.id, closedEdition.id);
  assert.equal(
    mixed.has_open_cfp,
    true,
    "Any edition can have an open CFP, not only the next edition"
  );
  const today = await makeFilterEdition({
    starts_on: future(40),
    cfp_opens_on: future(0),
    cfp_closes_on: future(0),
  });
  await admin(`/editions/${laterOpen.id}`, "DELETE", undefined, 204);
  assert.equal(
    (await alice(`/conferences/${filters.id}`)).has_open_cfp,
    true,
    "Opening and closing today is open"
  );
  await admin(`/editions/${today.id}`, "PATCH", {
    cfp_opens_on: null,
    cfp_closes_on: future(-1),
  });
  assert.equal((await alice(`/conferences/${filters.id}`)).has_open_cfp, false);
  for (const row of [closedEdition, notYet, unknownDeadline, today])
    await admin(`/editions/${row.id}`, "DELETE", undefined, 204);
  await makeFilterEdition({ cfp_closes_on: future(2) });
  const undatedOpen = await alice(`/conferences/${filters.id}`);
  assert.equal(undatedOpen.next_edition, null);
  assert.equal(
    undatedOpen.has_open_cfp,
    true,
    "An undated edition can still have an open CFP"
  );
  await admin(`/conferences/${filters.id}`, "DELETE", undefined, 204);
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
      notes: "SECRET SUBMISSION NOTES",
    },
    201
  );
  const sub2 = await bob(
    "/submissions",
    "POST",
    { paper_id: paper2.id, edition_id: e.id, status: "interested" },
    201
  );
  assert.equal(sub.notes, "SECRET SUBMISSION NOTES");
  assert.equal(sub2.notes, null);
  await bob(
    `/submissions/${sub.id}`,
    "PATCH",
    { notes: { invalid: true } },
    422
  );
  await bob(`/submissions/${sub.id}`, "PATCH", {
    notes: "  A private follow-up\nfor this edition.  ",
  });
  assert.equal(
    (await bob("/submissions")).find((row) => row.id === sub.id).notes,
    "A private follow-up\nfor this edition."
  );
  await bob(`/submissions/${sub.id}`, "PATCH", { status: "submitted" });
  assert.equal(
    (await bob(`/papers/${paper.id}`)).submissions[0].notes,
    "A private follow-up\nfor this edition.",
    "Status-only updates preserve notes"
  );
  assert.equal(
    (await bob(`/papers/${paper.id}`)).notes,
    "SECRET NOTES",
    "Submission notes must not overwrite reusable talk notes"
  );
  const cleared = await bob(`/submissions/${sub.id}`, "PATCH", {
    notes: "   ",
  });
  assert.equal(cleared.notes, null);
  await bob(`/submissions/${sub.id}`, "PATCH", {
    notes: "SECRET SUBMISSION NOTES",
  });
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
      { status: "confirmed", notes: "Cannot overwrite another member's notes" },
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
    { request_id: pendingLogin.request_id, code: pendingLogin.code },
    422
  );
  const suspendedRequest = await anonymous("/auth/request", "POST", {
    email: "bob@example.com",
  });
  assert.equal(suspendedRequest.ok, true);
  assert.match(suspendedRequest.request_id, /^[a-f0-9]{64}$/);
  assert.equal(suspendedRequest.code, undefined);
  await admin(`/admin/users/${b.id}`, "PATCH", { suspended: false });
  await bob("/me", "GET", undefined, 401);
  const login = await bob("/auth/request", "POST", {
    email: "BOB@example.com",
  });
  await bob("/auth/verify", "POST", {
    request_id: login.request_id,
    code: login.code,
  });
  assert.equal((await bob("/me")).user.id, b.id);
  assert.equal(
    (await alice(`/editions/${e.id}`)).submitted_friends.length,
    1,
    "Suspension retains friendships/data"
  );
  const limited = client();
  for (let i = 0; i < 5; i++)
    await limited("/auth/request", "POST", { email: "throttle@example.com" });
  const throttledRequest = await limited("/auth/request", "POST", {
    email: "throttle@example.com",
  });
  assert.equal(throttledRequest.ok, true);
  assert.match(throttledRequest.request_id, /^[a-f0-9]{64}$/);
  assert.equal(throttledRequest.code, undefined);
  const own = await bob(`/editions/${e.id}`);
  const topicEdition = await admin(
    "/editions",
    "POST",
    {
      conference_id: c.id,
      title: "A speaking conversation",
      starts_on: future(45),
    },
    201
  );
  const libraryBefore = (await bob("/papers")).length;
  const topic = await bob(
    "/submissions",
    "POST",
    {
      edition_id: topicEdition.id,
      status: "submitted",
      submitted_on: "2026-01-02",
      abstract_override: "Keep the opportunity context",
      notes: "PRIVATE OPPORTUNITY NOTES",
      owner_id: a.id,
    },
    201
  );
  assert.equal(topic.paper_id, null);
  assert.equal(
    (await bob("/papers")).length,
    libraryBefore,
    "Topic to be agreed must not create a fake talk"
  );
  assert.ok(
    (await bob("/submissions?unassigned=1")).some((row) => row.id === topic.id)
  );
  assert.ok(!(await admin("/submissions")).some((row) => row.id === topic.id));
  assert.ok(
    !(await stranger("/submissions")).some((row) => row.id === topic.id)
  );
  await admin(`/submissions/${topic.id}`, "PATCH", { status: "accepted" }, 403);
  await alice(`/submissions/${topic.id}`, "DELETE", undefined, 403);
  await bob(
    "/submissions",
    "POST",
    { edition_id: topicEdition.id, paper_id: null },
    409
  );
  const aliceTopic = await alice(
    "/submissions",
    "POST",
    { edition_id: topicEdition.id, status: "interested" },
    201
  );
  assert.equal(
    (await alice(`/editions/${topicEdition.id}`)).submitted_friends.length,
    1,
    "A submitted unassigned opportunity counts its owner once"
  );
  assert.equal(
    (await alice(`/editions/${topicEdition.id}`)).my_submissions[0].id,
    aliceTopic.id
  );
  assert.ok(
    !(await admin(`/editions/${topicEdition.id}`)).my_submissions.length
  );
  const foreign = await alice(
    "/papers",
    "POST",
    { title: "Not your proposal" },
    201
  );
  await bob(`/submissions/${topic.id}`, "PATCH", { paper_id: foreign.id }, 404);
  const attachPaper = await bob(
    "/papers",
    "POST",
    { title: "A topic we agreed" },
    201
  );
  const duplicate = await bob(
    "/submissions",
    "POST",
    { paper_id: attachPaper.id, edition_id: topicEdition.id },
    201
  );
  assert.equal(
    (await alice(`/editions/${topicEdition.id}`)).submitted_friends.length,
    1,
    "An unassigned and assigned submission still count once"
  );
  await bob(
    `/submissions/${topic.id}`,
    "PATCH",
    { paper_id: attachPaper.id },
    409
  );
  assert.equal(
    (await bob("/submissions?unassigned=1")).find((row) => row.id === topic.id)
      .status,
    "submitted",
    "Failed conversion must preserve original data"
  );
  await bob(`/submissions/${duplicate.id}`, "DELETE", undefined, 204);
  const attached = await bob(`/submissions/${topic.id}`, "PATCH", {
    paper_id: attachPaper.id,
    owner_id: a.id,
  });
  assert.equal(attached.id, topic.id);
  assert.equal(attached.paper_id, attachPaper.id);
  for (const key of [
    "status",
    "submitted_on",
    "abstract_override",
    "created_at",
    "notes",
  ])
    assert.equal(attached[key], topic[key]);
  assert.ok(
    !(await bob("/submissions?unassigned=1")).some((row) => row.id === topic.id)
  );
  assert.equal(
    (await bob(`/papers/${attachPaper.id}`)).submissions[0].id,
    topic.id
  );
  assert.equal(
    (await bob(`/editions/${topicEdition.id}`)).going.length,
    0,
    "Assigning a talk must not affect attendance"
  );
  await bob(`/submissions/${topic.id}`, "PATCH", {
    paper_id: null,
    status: "accepted",
  });
  await bob(`/papers/${attachPaper.id}`, "DELETE", undefined, 204);
  assert.ok(
    (await bob("/submissions?unassigned=1")).some((row) => row.id === topic.id),
    "Unassigned opportunity does not depend on a library entry"
  );
  await admin(`/editions/${topicEdition.id}`, "DELETE", undefined, 204);
  assert.ok(
    (await bob("/submissions?unassigned=1")).find((row) => row.id === topic.id)
      .edition.deleted_at,
    "Archived opportunities stay accessible to their owner"
  );
  await admin(`/editions/${topicEdition.id}/restore`, "POST");
  await bob(`/submissions/${topic.id}`, "DELETE", undefined, 204);
  await alice(`/submissions/${aliceTopic.id}`, "DELETE", undefined, 204);
  await alice(`/papers/${foreign.id}`, "DELETE", undefined, 204);
  assert.equal(own.my_submissions[0].abstract_override, "SECRET OVERRIDE");
  assert.equal(own.my_submissions[0].notes, "SECRET SUBMISSION NOTES");
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

  // Isolated auth regression checks; normal-flow throttling was exercised above.
  cli("query('DELETE FROM rate_limits');");
  const codeClient = client();
  const requestCode = (email) => codeClient("/auth/request", "POST", { email });
  const credentials = (result) => ({
    request_id: result.request_id,
    code: result.code,
  });
  const firstCode = await requestCode("codes@example.com");
  assert.match(firstCode.code, /^[0-9]{6}$/);
  assert.equal(
    firstCode.link,
    undefined,
    "New requests must not issue browser links"
  );
  const storedCode = JSON.parse(
    cli(
      "echo json_encode(one('SELECT * FROM login_codes WHERE email=?',['codes@example.com']));"
    )
  );
  assert.notEqual(storedCode.request_hash, firstCode.request_id);
  assert.notEqual(storedCode.code_hash, firstCode.code);
  assert.equal(storedCode.attempts, 0);
  const secondCode = await requestCode("CODES@example.com");
  await codeClient("/auth/verify", "POST", credentials(firstCode), 422);
  await codeClient(
    "/auth/verify",
    "POST",
    { ...credentials(secondCode), request_id: randomBytes(32).toString("hex") },
    422
  );
  const wrong = secondCode.code === "000000" ? "000001" : "000000";
  for (let i = 0; i < 5; i++)
    await codeClient(
      "/auth/verify",
      "POST",
      { ...credentials(secondCode), code: wrong },
      422
    );
  await codeClient("/auth/verify", "POST", credentials(secondCode), 422);
  assert.equal(
    Number(
      cli(
        "echo one('SELECT COUNT(*) AS n FROM users WHERE email=?',['codes@example.com'])['n'];"
      )
    ),
    0,
    "Wrong guesses must not create an account"
  );
  const expired = await requestCode("expiry@example.com");
  cli(
    "query('UPDATE login_codes SET expires_at=? WHERE email=?',['2000-01-01T00:00:00Z','expiry@example.com']);"
  );
  await codeClient("/auth/verify", "POST", credentials(expired), 422);
  const leadingZero = await requestCode("leading@example.com");
  cli(
    "query('UPDATE login_codes SET code_hash=? WHERE email=?',[hash('sha256',$argv[1] . ':012345'),'leading@example.com']);",
    [leadingZero.request_id]
  );
  for (const code of [123456, "12345", "1234567", "12x456", null])
    await codeClient(
      "/auth/verify",
      "POST",
      { request_id: leadingZero.request_id, code },
      422
    );
  const signedIn = await codeClient("/auth/verify", "POST", {
    request_id: leadingZero.request_id,
    code: "012345",
  });
  assert.equal(signedIn.user.email, "leading@example.com");
  assert.equal(signedIn.user.role, "member");
  await client()(
    "/auth/verify",
    "POST",
    { request_id: leadingZero.request_id, code: "012345" },
    422
  );
  const concurrent = await requestCode("concurrent@example.com");
  const results = await Promise.all(
    [1, 2].map(() =>
      fetch(origin + "/api/auth/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "green-room",
        },
        body: JSON.stringify(credentials(concurrent)),
      })
    )
  );
  assert.deepEqual(
    results.map((result) => result.status).sort(),
    [200, 422],
    "Only one request can consume a code"
  );
  const legacyToken = randomBytes(32).toString("hex");
  cli(
    "insert('auth_requests',['email'=>'legacy@example.com','token_hash'=>hash('sha256',$argv[1]),'expires_at'=>gmdate('Y-m-d\\TH:i:s\\Z',time()+900)]);",
    [legacyToken]
  );
  assert.equal(
    (await client()("/auth/verify", "POST", { token: legacyToken })).user.email,
    "legacy@example.com"
  );
  await client()("/auth/verify", "POST", { token: legacyToken }, 422);
  cli(
    "query('INSERT OR REPLACE INTO rate_limits(key_hash,window_start,attempts) VALUES(?,?,?)',[hash('sha256','verify-ip:127.0.0.1'),time(),100]);"
  );
  await codeClient("/auth/verify", "POST", credentials(concurrent), 429);
  cli(
    "query('INSERT OR REPLACE INTO rate_limits(key_hash,window_start,attempts) VALUES(?,?,?)',[hash('sha256','auth-ip:127.0.0.1'),time(),30]);"
  );
  const ipLimited = await requestCode("ip-limit@example.com");
  assert.equal(ipLimited.code, undefined);
  assert.match(ipLimited.request_id, /^[a-f0-9]{64}$/);
  assert.equal(
    Number(
      cli(
        "echo one('SELECT COUNT(*) AS n FROM login_codes WHERE email=?',['ip-limit@example.com'])['n'];"
      )
    ),
    0
  );
  // Permanent self-deletion: shared catalog survives, every personal relationship/token goes.
  cli("query('DELETE FROM rate_limits');");
  const departing = client(),
    oldSession = client();
  const deletedUser = await signup(
    departing,
    "delete@example.com",
    "Departing speaker"
  );
  await alice(`/admin/users/${deletedUser.id}`, "PATCH", { role: "admin" });
  const secondLogin = await oldSession("/auth/request", "POST", {
    email: "delete@example.com",
  });
  await oldSession("/auth/verify", "POST", credentials(secondLogin));
  const keepConference = await departing(
    "/conferences",
    "POST",
    { name: "Preserved catalog", tags: ["test"] },
    201
  );
  const keepEdition = await departing(
    "/editions",
    "POST",
    {
      conference_id: keepConference.id,
      title: "Preserved edition",
      starts_on: future(100),
      ends_on: future(101),
      cfp_closes_on: future(5),
      notes: "Shared edition notes",
    },
    201
  );
  const archived = await departing(
    "/conferences",
    "POST",
    { name: "Preserved trash" },
    201
  );
  await departing(`/conferences/${archived.id}`, "DELETE", undefined, 204);
  const personalPaper = await departing(
    "/papers",
    "POST",
    { title: "Delete my proposal", notes: "Delete my notes" },
    201
  );
  await departing(
    "/submissions",
    "POST",
    {
      paper_id: personalPaper.id,
      edition_id: keepEdition.id,
      status: "submitted",
      notes: "Delete submission notes",
    },
    201
  );
  await departing(
    "/submissions",
    "POST",
    {
      edition_id: keepEdition.id,
      status: "submitted",
      notes: "Delete unassigned notes",
    },
    201
  );
  await departing(`/conferences/${keepConference.id}/review`, "PUT", {
    text: "Delete my review",
    tags: ["covers_travel"],
  });
  await departing(`/editions/${keepEdition.id}/attendance`, "PUT", {
    status: "going",
  });
  const preservedPaper = await bob(
    "/papers",
    "POST",
    { title: "Another member keeps this" },
    201
  );
  const preservedSubmission = await bob(
    "/submissions",
    "POST",
    {
      paper_id: preservedPaper.id,
      edition_id: keepEdition.id,
      status: "accepted",
      notes: "Keep this private note",
    },
    201
  );
  await bob(`/conferences/${keepConference.id}/review`, "PUT", {
    text: "Keep another member's review",
    tags: ["covers_travel"],
  });
  await bob(`/editions/${keepEdition.id}/attendance`, "PUT", {
    status: "maybe",
  });
  await departing(`/crew/${b.id}/request`, "POST");
  await bob(`/crew/${deletedUser.id}/accept`, "POST");
  await departing(`/crew/${a.id}/request`, "POST");
  await departing(`/crew/${s.id}/block`, "POST", undefined, 204);
  const pendingDeletionCode = await departing("/auth/request", "POST", {
    email: "delete@example.com",
  });
  const deletionLinkToken = randomBytes(32).toString("hex"),
    legacyDeletionToken = randomBytes(32).toString("hex");
  const historical = JSON.parse(
    cli(
      `
    $id=(int)$argv[1];
    insert('login_tokens',['user_id'=>$id,'token_hash'=>hash('sha256',$argv[2]),'expires_at'=>gmdate('Y-m-d\\TH:i:s\\Z',time()+900)]);
    insert('auth_requests',['email'=>'delete@example.com','token_hash'=>hash('sha256',$argv[3]),'expires_at'=>gmdate('Y-m-d\\TH:i:s\\Z',time()+900)]);
    insert('comments',['user_id'=>$id,'conference_id'=>(int)$argv[4],'text'=>'Retired personal content']);
    $invites=[];
    foreach ([['invited_by'=>$id],['invited_by'=>(int)$argv[5],'accepted_by'=>$id],['invited_by'=>(int)$argv[5],'email'=>'delete@example.com'],['invited_by'=>(int)$argv[5],'email'=>'unrelated@example.com']] as $data) {
      $iid=insert('invites',[...$data,'token_hash'=>bin2hex(random_bytes(32)),'expires_at'=>gmdate('Y-m-d\\TH:i:s\\Z',time()+900)]);
      $invites[]=one('SELECT * FROM invites WHERE id=?',[$iid]);
    }
    update('users',$id,['avatar_url'=>'/api/avatars/'.$id.'/avatar-aaaaaaaaaaaaaaaa.png']);
    echo json_encode($invites);
  `,
      [
        String(deletedUser.id),
        deletionLinkToken,
        legacyDeletionToken,
        String(keepConference.id),
        String(owner.id),
      ]
    )
  );
  const avatarFolder = join(directory, "avatars", String(deletedUser.id));
  await mkdir(avatarFolder, { recursive: true });
  for (const name of [
    "avatar-aaaaaaaaaaaaaaaa.png",
    "avatar-bbbbbbbbbbbbbbbb.svg",
    ".avatar-fixture",
  ])
    await writeFile(join(avatarFolder, name), "personal image bytes");
  const anotherAvatarFolder = join(directory, "avatars", String(b.id));
  await mkdir(anotherAvatarFolder, { recursive: true });
  await writeFile(
    join(anotherAvatarFolder, "avatar-cccccccccccccccc.png"),
    "keep another avatar"
  );
  await mkdir(join(directory, "invite-links"), { recursive: true });
  await writeFile(
    join(directory, "invite-links", "key.bin"),
    "keep shared encryption key"
  );
  const invitePath = (row) =>
    join(directory, "invite-links", `${row.id}-${row.token_hash}.json`);
  for (const row of historical)
    await writeFile(invitePath(row), "encrypted legacy payload");
  const logoFolder = join(directory, "logos", String(keepConference.id));
  await mkdir(logoFolder, { recursive: true });
  const logoPath = join(logoFolder, "preserved-catalog-dddddddddddddddd.png");
  await writeFile(logoPath, "keep the shared conference logo");
  cli(
    "update('conferences',(int)$argv[1],['logo_url'=>'/api/conference-logos/'.$argv[1].'/preserved-catalog-dddddddddddddddd.png']);",
    [String(keepConference.id)]
  );
  const catalogBefore = JSON.parse(
    cli(
      "echo json_encode(['conferences'=>all('SELECT * FROM conferences ORDER BY id'),'editions'=>all('SELECT * FROM editions ORDER BY id')]);"
    )
  );
  await departing("/me", "DELETE", {}, 422);
  await departing("/me", "DELETE", { confirmation: "delete" }, 422);
  await departing("/me", "DELETE", { confirmation: "DELETE" }, 403, false);
  await alice(
    `/users/${deletedUser.id}`,
    "DELETE",
    { confirmation: "DELETE" },
    404
  );
  // A failed transaction must not remove personal data or enqueue/remove files.
  cli(
    "db()->exec('CREATE TRIGGER test_refuse_account_deletion BEFORE DELETE ON users WHEN OLD.id='.(int)$argv[1].' BEGIN SELECT RAISE(ABORT,\"test rollback\"); END;');",
    [String(deletedUser.id)]
  );
  await departing("/me", "DELETE", { confirmation: "DELETE" }, 500);
  assert.equal((await departing("/me")).user.id, deletedUser.id);
  assert.equal((await departing("/papers")).length, 1);
  assert.equal(
    await readFile(join(avatarFolder, "avatar-aaaaaaaaaaaaaaaa.png"), "utf8"),
    "personal image bytes"
  );
  assert.equal(
    Number(
      cli("echo one('SELECT COUNT(*) AS n FROM account_deletion_files')['n'];")
    ),
    0
  );
  cli("db()->exec('DROP TRIGGER test_refuse_account_deletion');");
  // Do not traverse a member-directory symlink, even if private storage is damaged.
  await rename(avatarFolder, avatarFolder + "-saved");
  await symlink(anotherAvatarFolder, avatarFolder);
  await departing("/me", "DELETE", { confirmation: "DELETE" }, 503);
  assert.equal((await departing("/me")).user.id, deletedUser.id);
  await unlink(avatarFolder);
  await rename(avatarFolder + "-saved", avatarFolder);
  // One broken filesystem entry exercises durable post-commit cleanup retry.
  await unlink(invitePath(historical[0]));
  await mkdir(invitePath(historical[0]));
  await departing(
    "/me",
    "DELETE",
    { confirmation: "DELETE", user_id: b.id },
    204
  );
  await departing("/me", "GET", undefined, 401);
  await oldSession("/me", "GET", undefined, 401);
  await bob(`/users/${deletedUser.id}`, "GET", undefined, 404);
  await bob(
    `/avatars/${deletedUser.id}/avatar-aaaaaaaaaaaaaaaa.png`,
    "GET",
    undefined,
    404
  );
  await anonymous(
    "/auth/verify",
    "POST",
    credentials(pendingDeletionCode),
    422
  );
  for (const token of [deletionLinkToken, legacyDeletionToken])
    await anonymous("/auth/verify", "POST", { token }, 422);
  assert.equal(
    (await bob("/me")).user.id,
    b.id,
    "A supplied target ID must not delete another account"
  );
  const catalogAfter = JSON.parse(
    cli(
      "echo json_encode(['conferences'=>all('SELECT * FROM conferences ORDER BY id'),'editions'=>all('SELECT * FROM editions ORDER BY id')]);"
    )
  );
  for (const table of ["conferences", "editions"])
    assert.deepEqual(
      catalogAfter[table],
      catalogBefore[table].map((row) => ({
        ...row,
        created_by: row.created_by === deletedUser.id ? null : row.created_by,
      })),
      `${table} must retain IDs, dates, content, and trash status`
    );
  assert.equal(
    (await bob(`/conferences/${keepConference.id}`)).created_by,
    null
  );
  assert.equal(
    (await bob(`/conferences/${keepConference.id}`)).reviews[0].text,
    "Keep another member's review"
  );
  assert.equal(
    await readFile(logoPath, "utf8"),
    "keep the shared conference logo"
  );
  assert.equal((await bob(`/editions/${keepEdition.id}`)).created_by, null);
  assert.equal(
    (await bob("/papers")).find((row) => row.id === preservedPaper.id)
      .submissions[0].id,
    preservedSubmission.id
  );
  assert.equal(
    (await bob("/papers")).find((row) => row.id === preservedPaper.id)
      .submissions[0].notes,
    "Keep this private note"
  );
  assert.equal((await bob(`/editions/${keepEdition.id}`)).maybe[0].id, b.id);
  assert.equal(
    (await alice("/trash")).conferences.find((row) => row.id === archived.id)
      .created_by,
    null
  );
  assert.ok(!(await bob("/users")).some((row) => row.id === deletedUser.id));
  assert.ok(
    !(await bob("/dashboard")).recent_activity.some(
      (row) => row.user.id === deletedUser.id
    )
  );
  const deletedRows = JSON.parse(
    cli(
      `
    $id=(int)$argv[1];$counts=[];
    foreach(['users'=>'id','papers'=>'owner_id','submissions'=>'owner_id','reviews'=>'user_id','attendance'=>'user_id','comments'=>'user_id','login_tokens'=>'user_id'] as $table=>$field)$counts[$table]=one('SELECT COUNT(*) AS n FROM '.$table.' WHERE '.$field.'=?',[$id])['n'];
    $counts['friendships']=one('SELECT COUNT(*) AS n FROM friendships WHERE user_low=? OR user_high=? OR requested_by=?',[$id,$id,$id])['n'];
    $counts['blocks']=one('SELECT COUNT(*) AS n FROM blocks WHERE user_id=? OR blocked_id=?',[$id,$id])['n'];
    foreach(['login_codes','auth_requests'] as $table)$counts[$table]=one('SELECT COUNT(*) AS n FROM '.$table.' WHERE email=?',['delete@example.com'])['n'];
    echo json_encode($counts);
  `,
      [String(deletedUser.id)]
    )
  );
  assert.ok(
    Object.values(deletedRows).every((count) => count === 0),
    JSON.stringify(deletedRows)
  );
  assert.equal(
    await readFile(join(avatarFolder, "avatar-aaaaaaaaaaaaaaaa.png")).then(
      () => true,
      () => false
    ),
    false
  );
  assert.equal(
    await readFile(join(avatarFolder, "avatar-bbbbbbbbbbbbbbbb.svg")).then(
      () => true,
      () => false
    ),
    false
  );
  assert.equal(
    await readFile(join(avatarFolder, ".avatar-fixture")).then(
      () => true,
      () => false
    ),
    false
  );
  assert.equal(
    await readFile(
      join(anotherAvatarFolder, "avatar-cccccccccccccccc.png"),
      "utf8"
    ),
    "keep another avatar"
  );
  assert.equal(
    await readFile(join(directory, "invite-links", "key.bin"), "utf8"),
    "keep shared encryption key"
  );
  assert.equal(
    await readFile(invitePath(historical[3]), "utf8"),
    "encrypted legacy payload"
  );
  assert.equal(
    Number(
      cli("echo one('SELECT COUNT(*) AS n FROM account_deletion_files')['n'];")
    ),
    1
  );
  await rmdir(invitePath(historical[0]));
  await writeFile(
    invitePath(historical[0]),
    "retry removing this inaccessible payload"
  );
  await alice("/me");
  assert.equal(
    Number(
      cli("echo one('SELECT COUNT(*) AS n FROM account_deletion_files')['n'];")
    ),
    0
  );
  assert.equal(
    await readFile(invitePath(historical[0])).then(
      () => true,
      () => false
    ),
    false
  );
  const freshUser = await signup(
    departing,
    "delete@example.com",
    "Fresh speaker"
  );
  assert.ok(
    freshUser.id > deletedUser.id,
    "Deleted user IDs must never be reused"
  );
  assert.deepEqual(await departing("/papers"), []);
  await oldSession("/me", "GET", undefined, 401);
  assert.deepEqual(
    JSON.parse(cli("echo json_encode(all('PRAGMA foreign_key_check'));")),
    []
  );
  // Two remaining admins deleting concurrently must leave exactly one active admin.
  await alice(`/admin/users/${owner.id}`, "PATCH", { role: "member" });
  cli(
    "insert('users',['name'=>'Suspended admin','email'=>'suspended-admin@example.com','cal_token'=>bin2hex(random_bytes(32)),'role'=>'admin','suspended'=>1]);"
  );
  await alice("/me", "DELETE", { confirmation: "DELETE" }, 409);
  await alice(`/admin/users/${freshUser.id}`, "PATCH", { role: "admin" });
  const deletions = await Promise.all(
    [alice, departing].map((account) =>
      fetch(origin + "/api/me", {
        method: "DELETE",
        headers: {
          Cookie: account.cookie(),
          "Content-Type": "application/json",
          "X-Requested-With": "green-room",
        },
        body: JSON.stringify({ confirmation: "DELETE" }),
      })
    )
  );
  assert.deepEqual(
    deletions.map((response) => response.status).sort(),
    [204, 409]
  );
  assert.equal(
    Number(
      cli(
        "echo one(\"SELECT COUNT(*) AS n FROM users WHERE role='admin' AND suspended=0\")['n'];"
      )
    ),
    1
  );

  // Request quotas: one requester cannot use up an address's whole hourly quota.
  cli("query('DELETE FROM rate_limits');");
  const setLimit = (key, attempts) =>
    cli(
      "query('INSERT OR REPLACE INTO rate_limits(key_hash,window_start,attempts) VALUES(?,?,?)',[hash('sha256',$argv[1]),time(),(int)$argv[2]]);",
      [key, String(attempts)]
    );
  setLimit("auth-email-ip:split@example.com|203.0.113.9", 5);
  assert.match((await requestCode("split@example.com")).code, /^[0-9]{6}$/);
  setLimit("auth-email:split@example.com", 20);
  assert.equal((await requestCode("split@example.com")).code, undefined);

  // Wrong guesses share one budget per address across request IDs, then lock it.
  cli("query('DELETE FROM rate_limits');");
  const failureCount = () =>
    Number(
      cli(
        "echo one('SELECT attempts FROM rate_limits WHERE key_hash=?',[hash('sha256','login-failures:budget@example.com')])['attempts'] ?? 0;"
      )
    );
  const wrongFor = (result) => ({
    ...credentials(result),
    code: result.code === "000000" ? "000001" : "000000",
  });
  const budgetFirst = await requestCode("budget@example.com");
  await codeClient("/auth/verify", "POST", wrongFor(budgetFirst), 422);
  const budgetSecond = await requestCode("BUDGET@example.com");
  await codeClient("/auth/verify", "POST", wrongFor(budgetSecond), 422);
  assert.equal(failureCount(), 2);
  await codeClient("/auth/verify", "POST", credentials(budgetSecond));
  assert.equal(failureCount(), 2, "Correct codes do not use the budget");
  const budgetLocked = await requestCode("budget@example.com");
  setLimit("login-failures:budget@example.com", 19);
  await codeClient("/auth/verify", "POST", wrongFor(budgetLocked), 422);
  await codeClient("/auth/verify", "POST", credentials(budgetLocked), 422);
  const lockedRequest = await requestCode("budget@example.com");
  assert.equal(lockedRequest.ok, true);
  assert.match(lockedRequest.request_id, /^[a-f0-9]{64}$/);
  assert.equal(lockedRequest.code, undefined);

  // Anonymous requests and wrong guesses must not leave session files behind.
  cli("query('DELETE FROM rate_limits');");
  const sessionFiles = () =>
    readdirSync("api/db/sessions").filter((name) => name.startsWith("sess_"))
      .length;
  const raw = (path, method = "GET", cookie, body) =>
    fetch(origin + "/api" + path, {
      method,
      headers: {
        "Content-Type": "application/json",
        "X-Requested-With": "green-room",
        ...(cookie ? { Cookie: cookie } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  const filesBefore = sessionFiles();
  const anonymousMe = await raw("/me");
  assert.equal(anonymousMe.status, 401);
  assert.equal(anonymousMe.headers.get("set-cookie"), null);
  const bogusMe = await raw("/me", "GET", "gr_session=" + "a".repeat(32));
  assert.equal(bogusMe.status, 401);
  assert.match(
    bogusMe.headers.get("set-cookie"),
    /gr_session=;|gr_session=deleted/
  );
  const sessionCode = await requestCode("session@example.com");
  const wrongGuess = await raw(
    "/auth/verify",
    "POST",
    undefined,
    wrongFor(sessionCode)
  );
  assert.equal(wrongGuess.status, 422);
  assert.equal(wrongGuess.headers.get("set-cookie"), null);
  const anonymousLogout = await raw("/auth/logout", "POST");
  assert.equal(anonymousLogout.status, 204);
  assert.equal(anonymousLogout.headers.get("set-cookie"), null);
  assert.equal(sessionFiles(), filesBefore, "No anonymous session files");
  const sessionLogin = await raw(
    "/auth/verify",
    "POST",
    undefined,
    credentials(sessionCode)
  );
  assert.equal(sessionLogin.status, 200);
  assert.equal(sessionFiles(), filesBefore + 1);
  // Zoned deadlines: preserve wall-clock values, derive UTC instants, and share one open-CFP rule.
  const zoneAdmin = deletions[0].status === 409 ? alice : departing;
  const zoneConference = await zoneAdmin(
    "/conferences",
    "POST",
    { name: "Timezone checks" },
    201
  );
  const makeZoned = (data) =>
    zoneAdmin(
      "/editions",
      "POST",
      { conference_id: zoneConference.id, ...data },
      201
    );
  const summer = await makeZoned({
    title: "Summer deadline",
    starts_on: "2027-08-20",
    ends_on: "2027-08-21",
    starts_timezone: "Europe/Zurich",
    ends_timezone: "Europe/Zurich",
    cfp_closes_on: "2027-07-10",
    cfp_closes_timezone: "Europe/Zurich",
  });
  assert.equal(summer.cfp_closes_time, "23:59");
  assert.equal(summer.cfp_closes_at, "2027-07-10T21:59:00Z");
  assert.equal(
    (
      await zoneAdmin(`/editions/${summer.id}`, "PATCH", {
        cfp_closes_at: "2099-01-01T00:00:00Z",
      })
    ).cfp_closes_at,
    summer.cfp_closes_at,
    "Clients must not override server-derived UTC instants"
  );
  assert.equal(
    (
      await zoneAdmin(`/editions/${summer.id}`, "PATCH", {
        notes: "An unrelated edit",
      })
    ).cfp_closes_at,
    summer.cfp_closes_at
  );
  const winter = await zoneAdmin(`/editions/${summer.id}`, "PATCH", {
    cfp_closes_on: "2027-01-10",
  });
  assert.equal(
    winter.cfp_closes_at,
    "2027-01-10T22:59:00Z",
    "DST offsets must follow the deadline date, not the current date"
  );
  for (const data of [
    { cfp_closes_timezone: "Not/AZone" },
    { starts_timezone: "CET" },
    { ends_timezone: 123 },
    { cfp_closes_time: "24:00" },
    { cfp_closes_time: "12:99" },
    {
      cfp_closes_on: "2027-03-28",
      cfp_closes_time: "02:30",
      cfp_closes_timezone: "Europe/Zurich",
    },
    {
      cfp_closes_on: "2027-10-31",
      cfp_closes_time: "02:30",
      cfp_closes_timezone: "Europe/Zurich",
    },
    {
      cfp_opens_on: "2027-07-10",
      cfp_opens_timezone: "America/Los_Angeles",
      cfp_closes_on: "2027-07-10",
      cfp_closes_time: "06:00",
      cfp_closes_timezone: "Europe/Zurich",
    },
  ])
    await zoneAdmin(`/editions/${summer.id}`, "PATCH", data, 422);
  await bob(
    `/editions/${summer.id}`,
    "PATCH",
    { cfp_closes_timezone: "UTC" },
    403
  );
  const crossDate = await zoneAdmin(`/editions/${summer.id}`, "PATCH", {
    cfp_opens_on: "2027-07-11",
    cfp_opens_timezone: "Pacific/Kiritimati",
    cfp_closes_on: "2027-07-10",
    cfp_closes_timezone: "America/Los_Angeles",
    cfp_closes_time: "23:59",
  });
  assert.equal(crossDate.cfp_opens_at, "2027-07-10T10:00:00Z");
  assert.equal(crossDate.cfp_closes_at, "2027-07-11T06:59:00Z");
  await zoneAdmin(`/editions/${summer.id}`, "DELETE", undefined, 204);
  const localFields = (timestamp, zone) => {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: zone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(timestamp));
    const get = (key) => parts.find((part) => part.type === key).value;
    return {
      cfp_closes_on: `${get("year")}-${get("month")}-${get("day")}`,
      cfp_closes_time: `${get("hour")}:${get("minute")}`,
      cfp_closes_timezone: zone,
    };
  };
  const live = await makeZoned({
    title: "Live zoned deadline",
    ...localFields(Date.now() + 3600000, "America/Los_Angeles"),
  });
  assert.equal(
    (await bob(`/conferences/${zoneConference.id}`)).has_open_cfp,
    true
  );
  assert.ok(
    (await bob("/editions?cfp_open=1")).some((row) => row.id === live.id)
  );
  assert.ok(
    (await bob("/dashboard")).open_cfps.some(
      (row) => row.edition.id === live.id
    )
  );
  await zoneAdmin(
    `/editions/${live.id}`,
    "PATCH",
    localFields(Date.now() - 3600000, "America/Los_Angeles")
  );
  assert.equal(
    (await bob(`/conferences/${zoneConference.id}`)).has_open_cfp,
    false,
    "A deadline earlier today must actually close"
  );
  assert.ok(
    !(await bob("/editions?cfp_open=1")).some((row) => row.id === live.id)
  );
  assert.ok(
    !(await bob("/dashboard")).open_cfps.some(
      (row) => row.edition.id === live.id
    )
  );
  const firstInstant = await makeZoned({
    title: "Earlier instant, later local day",
    ...localFields(Date.now() + 3600000, "Pacific/Kiritimati"),
  });
  const secondInstant = await makeZoned({
    title: "Later instant, earlier local day",
    ...localFields(Date.now() + 7200000, "America/Adak"),
  });
  assert.deepEqual(
    (await bob("/dashboard")).open_cfps
      .filter((row) =>
        [firstInstant.id, secondInstant.id].includes(row.edition.id)
      )
      .map((row) => row.edition.id),
    [firstInstant.id, secondInstant.id],
    "Order actual UTC deadlines, not local calendar dates"
  );
  const privateZone = await bob(
    "/submissions",
    "POST",
    {
      edition_id: live.id,
      status: "submitted",
      submitted_timezone: "Pacific/Marquesas",
      notes: "Keep timezone private",
    },
    201
  );
  assert.equal(privateZone.submitted_timezone, "Pacific/Marquesas");
  assert.equal(
    privateZone.submitted_on,
    localFields(Date.now(), "Pacific/Marquesas").cfp_closes_on
  );
  assert.equal(
    (
      await bob(`/submissions/${privateZone.id}`, "PATCH", {
        status: "accepted",
      })
    ).submitted_timezone,
    "Pacific/Marquesas"
  );
  const attachedZoned = await bob(`/submissions/${privateZone.id}`, "PATCH", {
    paper_id: preservedPaper.id,
  });
  assert.equal(
    attachedZoned.submitted_timezone,
    privateZone.submitted_timezone
  );
  assert.equal(attachedZoned.submitted_on, privateZone.submitted_on);
  assert.equal(attachedZoned.status, "accepted");
  assert.equal(attachedZoned.notes, "Keep timezone private");
  assert.ok(
    !JSON.stringify(await zoneAdmin(`/editions/${live.id}`)).includes(
      "submitted_timezone"
    )
  );
  await bob(
    `/submissions/${privateZone.id}`,
    "PATCH",
    { submitted_timezone: "invalid" },
    422
  );
  const legacyDate = await makeZoned({
    title: "Legacy client date",
    cfp_closes_on: future(1),
  });
  assert.equal(legacyDate.cfp_closes_at, null);
  assert.equal(legacyDate.cfp_closes_timezone, null);
  assert.equal(legacyDate.cfp_closes_time, null);
  assert.ok(
    (await bob("/editions?cfp_open=1")).some((row) => row.id === legacyDate.id)
  );
  const boundaryEdition = await makeZoned({
    title: "Exact window boundaries",
    cfp_opens_on: "2030-07-11",
    cfp_opens_timezone: "Pacific/Kiritimati",
    cfp_closes_on: "2030-07-11",
    cfp_closes_timezone: "Pacific/Kiritimati",
  });
  const boundaries = JSON.parse(
    cli(
      `
    require 'api/lib/dates.php';$id=(int)$argv[1];$result=[];
    foreach(['2030-07-10T09:59:59Z','2030-07-10T10:00:00Z','2030-07-11T09:59:00Z','2030-07-11T09:59:01Z'] as $instant) $result[]=(bool)one('SELECT id FROM editions WHERE id=? AND '.cfp_open_sql(),[$id,...cfp_open_params($instant)]);
    $e=one('SELECT * FROM editions WHERE id=?',[$id]);$result[]=cfp_days_left($e,'2030-07-10T12:00:00Z');
    $legacy=one('SELECT * FROM editions WHERE id=?',[(int)$argv[2]]);$result[]=(bool)one('SELECT id FROM editions WHERE id=? AND '.cfp_open_sql(),[$legacy['id'],...cfp_open_params($legacy['cfp_closes_on'].'T23:59:59Z')]);
    echo json_encode($result);
  `,
      [String(boundaryEdition.id), String(legacyDate.id)]
    )
  );
  assert.deepEqual(
    boundaries,
    [false, true, true, false, 0, true],
    "Opening/closing instants and badges must respect local midnight, with the old full-day fallback retained for legacy deadlines"
  );
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
