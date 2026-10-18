import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const directory = await mkdtemp(join(tmpdir(), "green-room-editions-"));
const env = {
  ...process.env,
  PURPLEROOM_ENV: "dev",
  GREEN_ROOM_DB: join(directory, "db.sqlite"),
};
const origin = "http://127.0.0.1:8020";
let server;
let cookie = "";
let log = "";
function php(code, args = []) {
  const result = spawnSync("php", ["-r", code, ...args], {
    env,
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout;
}
const bootstrap =
  "define('GREEN_ROOM', true); $config = require 'api/config.php'; require 'api/lib/db.php';";
function columns() {
  return JSON.parse(
    php(bootstrap + " echo json_encode(all('PRAGMA table_info(editions)'));")
  );
}
async function request(path, method = "GET", body, expected = 200) {
  const response = await fetch(origin + "/api" + path, {
    method,
    headers: {
      Cookie: cookie,
      "Content-Type": "application/json",
      "X-Requested-With": "green-room",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (response.headers.has("set-cookie"))
    cookie = response.headers.get("set-cookie").split(";")[0];
  const text = await response.text();
  assert.equal(response.status, expected, `${method} ${path}: ${text}\n${log}`);
  return response.headers.get("content-type")?.includes("application/json") &&
    text
    ? JSON.parse(text)
    : text;
}
const future = (days) =>
  new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
const year = new Date().getUTCFullYear() + 1;
const berlinTitle = `DevConf Berlin ${String(year).slice(-2)}`;
const londonTitle = `DevConf London ${year}`;
try {
  const token = randomBytes(32).toString("hex");
  const fixture = JSON.parse(
    php(
      bootstrap +
        `
    db()->exec(file_get_contents('api/db/schema.sql'));
    insert('schema_migrations', ['version' => 1, 'applied_at' => now()]);
    $uid = insert('users', ['name' => 'Existing speaker', 'email' => 'mail@nico.dev', 'cal_token' => bin2hex(random_bytes(32))]);
    $other = insert('users', ['name' => 'Existing friend', 'email' => 'legacy-friend@example.com', 'cal_token' => bin2hex(random_bytes(32))]);
    $cid = insert('conferences', ['name' => 'DevConf', 'created_by' => $uid]);
    $archive = insert('conferences', ['name' => 'ArchivedConf', 'created_by' => $uid, 'deleted_at' => now()]);
    $berlin = insert('editions', ['conference_id' => $cid, 'year' => (int)substr($argv[2],0,4), 'city' => 'Berlin', 'country' => 'DE', 'starts_on' => $argv[2], 'ends_on' => $argv[2], 'cfp_closes_on' => $argv[3], 'notes' => 'Keep this note.', 'created_by' => $uid]);
    $london = insert('editions', ['conference_id' => $cid, 'year' => (int)substr($argv[4],0,4), 'city' => 'London', 'country' => 'GB', 'starts_on' => $argv[4], 'ends_on' => $argv[4], 'cfp_closes_on' => $argv[3], 'created_by' => $uid]);
    insert('editions', ['conference_id' => $archive, 'year' => 2025, 'created_by' => $uid, 'deleted_at' => now()]);
    $paper = insert('papers', ['owner_id' => $uid, 'title' => 'Keep my talk', 'abstract' => 'Private abstract']);
    insert('submissions', ['paper_id' => $paper, 'edition_id' => $berlin, 'status' => 'confirmed']);
    insert('attendance', ['edition_id' => $london, 'user_id' => $uid, 'status' => 'going']);
    insert('reviews', ['conference_id'=>$cid,'user_id'=>$other,'tags'=>'["covers_travel"]','text'=>'Preserve this friends-only review']);
    insert('comments', ['conference_id'=>$cid,'user_id'=>$other,'text'=>'Preserve this retired comment']);
    insert('invites', ['invited_by'=>$uid,'token_hash'=>hash('sha256','legacy-invite'),'expires_at'=>gmdate('Y-m-d\TH:i:s\Z',time()+86400)]);
    insert('login_tokens', ['user_id' => $uid, 'token_hash' => hash('sha256', $argv[1]), 'expires_at' => gmdate('Y-m-d\\TH:i:s\\Z', time()+900)]);
    echo json_encode(['conference' => $cid, 'berlin' => $berlin, 'london' => $london, 'editions' => all('SELECT * FROM editions ORDER BY id'), 'users'=>all('SELECT * FROM users ORDER BY id'), 'reviews'=>all('SELECT * FROM reviews'), 'comments'=>all('SELECT * FROM comments'), 'invites'=>all('SELECT * FROM invites')]);
  `,
      [token, `${year}-05-20`, future(5), `${year}-06-20`]
    )
  );
  assert.ok(
    !columns().some((column) => column.name === "title"),
    "Fixture must represent the deployed v1 schema"
  );
  server = spawn(
    "php",
    ["-S", "127.0.0.1:8020", "-t", ".", "api/dev-router.php"],
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
  assert.ok(
    !columns().some((column) => column.name === "title"),
    "Health must not silently initialize or migrate a database"
  );
  await request("/auth/verify", "POST", { token });
  const preserved = JSON.parse(
    php(
      bootstrap +
        "echo json_encode(['users'=>all('SELECT * FROM users ORDER BY id'),'reviews'=>all('SELECT * FROM reviews'),'comments'=>all('SELECT * FROM comments'),'invites'=>all('SELECT * FROM invites'),'friends'=>all('SELECT * FROM friendships')]);"
    )
  );
  assert.deepEqual(
    preserved.users.map((user, index) =>
      Object.fromEntries(
        Object.keys(fixture.users[index]).map((key) => [key, user[key]])
      )
    ),
    fixture.users
  );
  assert.deepEqual(
    preserved.users.map((user) => user.role),
    ["admin", "member"]
  );
  assert.equal(
    preserved.friends.length,
    0,
    "Migration must not manufacture friendships"
  );
  for (const table of ["reviews", "comments", "invites"])
    assert.deepEqual(preserved[table], fixture[table]);
  assert.equal(
    (await request(`/conferences/${fixture.conference}`)).review_count,
    0,
    "Legacy reviews become friends-only without deleting records"
  );
  assert.equal(
    (await request(`/editions/${fixture.berlin}`)).going.length,
    0,
    "Do not migrate submission-derived plans into manual attendance"
  );
  assert.ok(
    columns().some((column) => column.name === "title"),
    "Existing installations must upgrade without CLI access"
  );
  const migrated = JSON.parse(
    php(
      bootstrap +
        " echo json_encode(all('SELECT * FROM editions ORDER BY id'));"
    )
  );
  assert.deepEqual(
    migrated.map(({ title, ...rest }) => rest),
    fixture.editions,
    "Migration must preserve every existing field and edition ID"
  );
  assert.deepEqual(
    migrated.map((edition) => edition.title),
    ["DevConf", "DevConf", "ArchivedConf"]
  );
  assert.equal(
    JSON.parse(
      php(
        bootstrap +
          " echo json_encode(all('SELECT version FROM schema_migrations WHERE version=2'));"
      )
    ).length,
    1
  );
  assert.equal((await request("/papers"))[0].abstract, "Private abstract");
  assert.equal(
    (await request(`/editions/${fixture.berlin}`)).my_submissions.length,
    1
  );
  assert.equal(
    (await request(`/editions/${fixture.london}`)).attendance.length,
    1
  );

  await request(`/editions/${fixture.berlin}`, "PATCH", {
    title: berlinTitle,
  });
  await request(`/editions/${fixture.london}`, "PATCH", {
    title: londonTitle,
  });
  const third = await request(
    "/editions",
    "POST",
    {
      conference_id: fixture.conference,
      title: "DevConf London Autumn",
      starts_on: `${year}-09-01`,
      city: "London",
      country: "GB",
    },
    201
  );
  const editions = (await request(`/conferences/${fixture.conference}`))
    .editions;
  assert.equal(editions.filter((edition) => edition.year === year).length, 3);
  assert.equal(
    third.year,
    year,
    "Compatibility year must be derived from the first day without being supplied"
  );
  assert.equal(new Set(editions.map((edition) => edition.id)).size, 3);
  assert.ok(
    editions.some((edition) => edition.title === berlinTitle) &&
      editions.some((edition) => edition.title === londonTitle)
  );
  const earlyActivity = (await request("/dashboard")).recent_activity;
  assert.ok(
    earlyActivity.some((activity) => activity.summary.includes(berlinTitle))
  );
  assert.ok(
    earlyActivity.every(
      (activity) => !activity.summary.includes(`${berlinTitle} ${year}`)
    ),
    "Activity must use titles without year suffixes"
  );
  for (const title of ["", "  ", null, [], "x".repeat(501)])
    await request(`/editions/${fixture.berlin}`, "PATCH", { title }, 422);
  await request(
    "/editions",
    "POST",
    { conference_id: fixture.conference, title: "" },
    422
  );
  const defaulted = await request(
    "/editions",
    "POST",
    { conference_id: fixture.conference },
    201
  );
  assert.equal(
    defaulted.title,
    "DevConf",
    "Older clients may omit title and must get the parent name"
  );
  assert.equal(
    defaulted.year,
    new Date().getUTCFullYear(),
    "An undated edition still needs no year input"
  );
  const conflicting = await request(
    "/editions",
    "POST",
    {
      conference_id: fixture.conference,
      title: "Dates are authoritative",
      year: 1999,
      starts_on: `${year}-11-01`,
    },
    201
  );
  assert.equal(conflicting.year, year);
  const endOnly = await request(
    "/editions",
    "POST",
    {
      conference_id: fixture.conference,
      title: "End-only edition",
      ends_on: `${year}-12-01`,
    },
    201
  );
  assert.equal(endOnly.year, year);
  const legacy = await request(
    "/editions",
    "POST",
    { conference_id: fixture.conference, year: year - 1 },
    201
  );
  assert.equal(
    legacy.year,
    year - 1,
    "Legacy clients may still supply metadata when dates are unknown"
  );
  const other = await request(
    "/conferences",
    "POST",
    { name: "Another conference" },
    201
  );
  assert.equal(
    (
      await request(`/editions/${defaulted.id}`, "PATCH", {
        conference_id: other.id,
      })
    ).title,
    other.name
  );
  await request(`/editions/${defaulted.id}`, "PATCH", {
    title: "Keep my custom title",
  });
  assert.equal(
    (
      await request(`/editions/${defaulted.id}`, "PATCH", {
        conference_id: fixture.conference,
      })
    ).title,
    "Keep my custom title"
  );

  const dashboard = await request("/dashboard");
  assert.equal(
    dashboard.open_cfps.find((item) => item.edition.id === fixture.berlin)
      .edition.title,
    berlinTitle
  );
  const me = await request("/me");
  assert.equal(me.cal_url, undefined);
  await request("/cal/legacy.ics", "GET", undefined, 404);
  const rescheduled = await request(`/editions/${fixture.berlin}`, "PATCH", {
    starts_on: `${year + 1}-05-20`,
    ends_on: `${year + 1}-05-21`,
  });
  assert.equal(rescheduled.year, year + 1);
  assert.equal(
    rescheduled.title,
    berlinTitle,
    "Changing dates must never rewrite the title"
  );
  const ordered = (await request(`/conferences/${fixture.conference}`))
    .editions;
  assert.equal(
    ordered[0].id,
    fixture.berlin,
    "Edition ordering must follow actual dates, not the old year metadata"
  );
  await request(`/editions/${third.id}`, "DELETE", undefined, 204);
  assert.equal(
    (await request("/trash")).editions.find(
      (edition) => edition.id === third.id
    ).title,
    third.title
  );
  await request(`/editions/${third.id}/restore`, "POST");
  assert.equal((await request(`/editions/${third.id}`)).title, third.title);
  const migration = spawnSync("php", ["api/db/migrate.php"], {
    env,
    encoding: "utf8",
  });
  assert.equal(migration.status, 0, migration.stderr);
  assert.equal(
    JSON.parse(
      php(
        bootstrap +
          " echo json_encode(all('SELECT version FROM schema_migrations WHERE version=2'));"
      )
    ).length,
    1
  );
  console.log(
    "Edition checks passed: automatic v1 upgrade, preserved data, same-year editions, title defaults/validation, calendar retirement, activity, restore, and idempotent migration."
  );
} finally {
  if (server) {
    server.kill("SIGTERM");
    await new Promise((resolve) => server.once("exit", resolve));
  }
  await rm(directory, { recursive: true, force: true });
}
