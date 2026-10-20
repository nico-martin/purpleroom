import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const directory = await mkdtemp(join(tmpdir(), "purpleroom-speakers-"));
const env = {
  ...process.env,
  PURPLEROOM_ENV: "dev",
  GREEN_ROOM_DB: join(directory, "test.sqlite"),
};
const origin = "http://127.0.0.1:8024";
let server;
let log = "";
function cli(code) {
  const result = spawnSync(
    "php",
    [
      "-r",
      "define('GREEN_ROOM',true); $config=require 'api/config.php'; require 'api/lib/db.php'; " +
        code,
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
    const response = await fetch(
      origin + (path.startsWith("/api/") ? path : "/api" + path),
      {
        method,
        headers: {
          Cookie: cookie,
          ...(body instanceof FormData
            ? {}
            : { "Content-Type": "application/json" }),
          ...(csrf ? { "X-Requested-With": "green-room" } : {}),
        },
        body:
          body instanceof FormData
            ? body
            : body === undefined
              ? undefined
              : JSON.stringify(body),
      }
    );
    if (response.headers.has("set-cookie"))
      cookie = response.headers.get("set-cookie").split(";")[0];
    const bytes = Buffer.from(await response.arrayBuffer());
    assert.ok(
      (Array.isArray(expected) ? expected : [expected]).includes(
        response.status
      ),
      `${method} ${path}: expected ${expected}, got ${response.status}: ${bytes.toString()}\n${log}`
    );
    assert.match(response.headers.get("cache-control"), /no-store/);
    if (response.headers.get("content-type")?.startsWith("image/")) {
      assert.equal(response.headers.get("x-content-type-options"), "nosniff");
      assert.match(response.headers.get("content-security-policy"), /sandbox/);
      if (path.endsWith("/download"))
        assert.match(
          response.headers.get("content-disposition"),
          /^attachment;/
        );
      return bytes;
    }
    if (expected === 429)
      assert.equal(response.headers.get("retry-after"), "60");
    return bytes.length ? JSON.parse(bytes) : null;
  };
  return request;
}
async function signin(request, email, name) {
  const auth = await request("/auth/request", "POST", { email });
  const verified = await request("/auth/verify", "POST", {
    request_id: auth.request_id,
    code: auth.code,
  });
  if (!verified.user.profile_complete)
    return (await request("/me", "PATCH", { name })).user;
  return verified.user;
}
async function speakerHtml(username = "alice-speaker") {
  const response = await fetch(origin + "/u/" + username);
  assert.equal(response.status, 200);
  assert.equal(response.headers.has("set-cookie"), false);
  assert.match(response.headers.get("cache-control"), /no-store/);
  assert.match(response.headers.get("content-type"), /text\/html/);
  return response.text();
}
try {
  // Upgrade a populated v10 database. Existing identities/data stay unchanged and opt-out.
  cli(
    `db()->exec(file_get_contents('api/db/schema.sql')); insert('schema_migrations',['version'=>1,'applied_at'=>now()]); foreach(glob('api/db/migrations/*.sql') as $file) { $v=(int)basename($file); if($v>=11)continue; db()->exec(file_get_contents($file)); insert('schema_migrations',['version'=>$v,'applied_at'=>now()]); } insert('users',['email'=>'legacy@speaker.example','name'=>'Legacy Speaker','role'=>'admin','profile_complete'=>1,'cal_token'=>'retained-legacy-token']);`
  );
  const legacy = JSON.parse(
    cli("echo json_encode(one('SELECT * FROM users WHERE id=1'));")
  );
  cli(
    "require 'api/lib/migrations.php'; run_database_migrations(); run_database_migrations();"
  );
  const upgraded = JSON.parse(
    cli("echo json_encode(one('SELECT * FROM users WHERE id=1'));")
  );
  assert.equal(upgraded.username, null);
  delete upgraded.username;
  assert.deepEqual(upgraded, legacy);
  assert.equal(
    cli("echo one('SELECT COUNT(*) AS n FROM speaker_information')['n'];"),
    "0"
  );
  assert.equal(
    cli(
      "echo one('SELECT COUNT(*) AS n FROM schema_migrations WHERE version=11')['n'];"
    ),
    "1"
  );
  assert.equal(cli("echo json_encode(all('PRAGMA foreign_key_check'));"), "[]");
  const pictureUpgrade = JSON.parse(
    cli(
      `$config['database']=dirname($config['database']).'/picture-upgrade.sqlite';db()->exec(file_get_contents('api/db/schema.sql'));insert('schema_migrations',['version'=>1,'applied_at'=>now()]);foreach(glob('api/db/migrations/*.sql') as $file){$v=(int)basename($file);if($v>11)continue;db()->exec(file_get_contents($file));insert('schema_migrations',['version'=>$v,'applied_at'=>now()]);}insert('users',['email'=>'old-photo@example.com','name'=>'Old Photo','cal_token'=>'retained']);insert('speaker_pictures',['id'=>77,'user_id'=>1,'label'=>'Retained photo','credit'=>'Original credit','filename'=>'avatar-aaaaaaaaaaaaaaaa.png']);insert('speaker_information',['user_id'=>1,'speaker_id'=>'spk_retained','published'=>'{"pictures":[{"id":77}]}','revision'=>'retained-revision']);$before=one('SELECT * FROM speaker_pictures WHERE id=77');require 'api/lib/migrations.php';run_database_migrations();run_database_migrations();echo json_encode(['before'=>$before,'after'=>one('SELECT * FROM speaker_pictures WHERE id=77'),'info'=>one('SELECT * FROM speaker_information'),'applied'=>one('SELECT COUNT(*) AS n FROM schema_migrations WHERE version=12')['n']]);`
    )
  );
  assert.equal(pictureUpgrade.after.variants, "{}");
  assert.match(pictureUpgrade.after.public_token, /^[a-f0-9]{48}$/);
  delete pictureUpgrade.after.public_token;
  delete pictureUpgrade.after.variants;
  assert.deepEqual(pictureUpgrade.after, pictureUpgrade.before);
  assert.equal(pictureUpgrade.info.published, '{"pictures":[{"id":77}]}');
  assert.equal(pictureUpgrade.info.revision, "retained-revision");
  assert.equal(pictureUpgrade.applied, 1);

  server = spawn(
    "php",
    ["-S", "127.0.0.1:8024", "-t", ".", "api/dev-router.php"],
    { env, stdio: ["ignore", "ignore", "pipe"] }
  );
  server.stderr.on("data", (chunk) => {
    log += chunk;
  });
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      if ((await fetch(origin + "/api/health")).ok) break;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  const anon = client(),
    owner = client(),
    other = client(),
    admin = client();
  const alice = await signin(owner, "alice@speaker.example", "Alice");
  const bob = await signin(other, "bob@speaker.example", "Bob");
  await signin(admin, "legacy@speaker.example", "Legacy Speaker");
  assert.equal((await owner("/speaker")).published, false);
  assert.equal((await owner("/speaker")).sharing, null);
  assert.equal((await speakerHtml()).includes("og:image"), false);
  await owner("/speaker/publication", "PUT", { publish_all: true }, 422);
  await anon("/speaker/publication", "PUT", { publish_all: true }, 401);
  await anon("/speaker", "GET", undefined, 401);
  await anon("/speaker", "PUT", {}, 403, false);
  await anon("/public/speakers/alice-speaker", "GET", undefined, 404);
  for (const username of [
    "EXAMPLE",
    "two words",
    "trailing-",
    "-leading",
    "two--dashes",
    "ab",
    "abc",
    "üser",
    "a".repeat(41),
    42,
  ]) {
    await owner("/me", "PATCH", { username }, 422);
  }
  await anon(
    "/speaker/username-availability?username=free-name",
    "GET",
    undefined,
    401
  );
  await owner(
    "/speaker/username-availability?username=abc",
    "GET",
    undefined,
    422
  );
  await owner(
    "/speaker/username-availability?username[]=bad",
    "GET",
    undefined,
    422
  );
  for (const username of [
    "purple-room",
    "purpleroom",
    "example",
    "e-x-a-m-p-l-e",
    "team",
  ]) {
    assert.deepEqual(
      await owner(`/speaker/username-availability?username=${username}`),
      { username, available: false }
    );
    const unavailable = await owner("/me", "PATCH", { username }, 409);
    assert.deepEqual(unavailable.error, {
      code: "username_taken",
      message: "This username is already taken.",
      fields: { username: "taken" },
    });
  }
  assert.deepEqual(
    await owner("/speaker/username-availability?username=niko"),
    { username: "niko", available: true }
  );
  await other("/me", "PATCH", { username: "niko" });
  assert.deepEqual(
    await owner("/speaker/username-availability?username=niko"),
    { username: "niko", available: false }
  );
  assert.deepEqual(
    await other("/speaker/username-availability?username=niko"),
    { username: "niko", available: true }
  );
  const racedClaim = await owner("/me", "PATCH", { username: "niko" }, 409);
  assert.equal(
    racedClaim.error.code,
    "username_taken",
    "Availability does not reserve the name; saving still rechecks atomically"
  );
  await other("/me", "PATCH", { username: null });
  cli(
    `query('INSERT OR REPLACE INTO rate_limits(key_hash,window_start,attempts) VALUES(?,?,?)',[hash('sha256','username-availability:${alice.id}'),time(),120]);`
  );
  await owner(
    "/speaker/username-availability?username=free-name",
    "GET",
    undefined,
    429
  );
  cli(
    `query('DELETE FROM rate_limits WHERE key_hash=?',[hash('sha256','username-availability:${alice.id}')]);`
  );
  await owner("/me", "PATCH", {
    username: "alice-speaker",
    homepage_url: "https://alice.example",
    github_url: "https://github.com/alice",
  });
  await other("/me", "PATCH", { username: "alice-speaker" }, 409);
  assert.equal((await other("/me")).user.username, null);
  assert.equal(
    (await owner("/speaker")).published,
    false,
    "Claiming a name never publishes"
  );
  await anon("/public/speakers/alice-speaker", "GET", undefined, 404);
  const claims = await Promise.all([
    owner("/me", "PATCH", { username: "race-speaker" }, [200, 409]),
    other("/me", "PATCH", { username: "race-speaker" }, [200, 409]),
  ]);
  assert.equal(
    claims.filter((result) => result.user?.username === "race-speaker").length,
    1
  );
  assert.equal(
    claims.filter((result) => result.error?.code === "username_taken").length,
    1
  );
  await other("/me", "PATCH", { username: null });
  await owner("/me", "PATCH", { username: "alice-speaker" });
  const draft = {
    tagline: "Public tagline",
    company: "Speaker company",
    job_title: "Engineer",
    contact_email: "contact@alice.example",
    bios: [
      { label: "Short", text: "Short biography" },
      { label: "Deutsch", text: "German biography" },
    ],
    appearances: [
      {
        kind: "recording",
        title: "Deliberately public talk",
        url: "https://video.example/talk",
        description: "Watch this",
      },
    ],
    email: "must-not-copy@example.com",
    published: true,
  };
  await owner(
    "/speaker",
    "PUT",
    { ...draft, bios: [{ label: "", text: "invalid" }] },
    422
  );
  await owner(
    "/speaker",
    "PUT",
    {
      ...draft,
      appearances: [{ ...draft.appearances[0], url: "javascript:alert(1)" }],
    },
    422
  );
  const saved = await owner("/speaker", "PUT", draft);
  assert.equal(saved.published, false);
  assert.equal(saved.draft.email, undefined);
  await owner(
    "/papers",
    "POST",
    { title: "PRIVATE_PROPOSAL_NOT_PUBLIC", notes: "PRIVATE_PROPOSAL_NOTES" },
    201
  );
  assert.equal((await admin("/speaker")).draft.bios.length, 0);
  assert.equal((await other("/speaker")).draft.bios.length, 0);
  const member = await admin(`/users/${alice.id}`);
  assert.equal(member.user.tagline, undefined);
  assert.equal(member.user.username, undefined);
  assert.equal(member.user.email, undefined);
  await owner(
    "/speaker/pictures",
    "POST",
    {
      label: "Rejected SSRF",
      source_url: "http://127.0.0.1:8024/api/me",
      credit: "",
    },
    422
  );
  await owner(
    "/speaker/pictures",
    "POST",
    {
      label: "No credentials",
      source_url: "https://user:pass@example.com/p.png",
    },
    422
  );
  // Deterministic import fixture exercises the shared validation/storage boundary without real network.
  const pictureId = Number(
    cli(
      `require 'api/lib/http.php'; require 'api/lib/remote.php'; require 'api/lib/logos.php'; require 'api/lib/profiles.php'; $user=one('SELECT * FROM users WHERE id=${alice.id}'); $asset=prepare_avatar('https://fixture.example/photo.png',$user,fn()=>['body'=>base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aAt8AAAAASUVORK5CYII=')]); $path=store_avatar(${alice.id},$asset); echo insert('speaker_pictures',['user_id'=>${alice.id},'label'=>'Approved portrait','credit'=>'Photo by Example; credit required','filename'=>basename($path)]);`
    )
  );
  const pictures = (await owner("/speaker")).pictures;
  assert.equal(pictures.length, 1);
  assert.deepEqual(
    Object.keys(pictures[0].variants),
    ["full"],
    "Legacy originals remain available without read-time resizes"
  );
  const photo = (width, height) =>
    Buffer.from(
      cli(
        `$image=imagecreatetruecolor(${width},${height}); imagefill($image,0,0,imagecolorallocate($image,102,51,153)); ob_start();imagepng($image);$bytes=ob_get_clean();imagedestroy($image);echo base64_encode($bytes);`
      ),
      "base64"
    );
  const upload = (bytes, label = "Resized portrait") => {
    const data = new FormData();
    data.append("label", label);
    data.append("credit", "Photo credit");
    data.append(
      "picture",
      new Blob([bytes], { type: "image/png" }),
      "portrait.png"
    );
    return data;
  };
  await owner("/speaker/pictures", "POST", upload(photo(1999, 1000)), 422);
  await owner(
    "/speaker/pictures",
    "POST",
    upload(Buffer.from("not an image")),
    422
  );
  await owner(
    "/speaker/pictures",
    "POST",
    upload(Buffer.alloc(6 * 1024 * 1024)),
    413
  );
  await owner(
    "/speaker/pictures",
    "POST",
    upload(photo(2000, 1000)),
    403,
    false
  );
  const originalPhoto = photo(3000, 2000);
  const uploaded = await owner(
    "/speaker/pictures",
    "POST",
    upload(originalPhoto),
    201
  );
  const resized = uploaded.pictures.find((p) => p.label === "Resized portrait");
  assert.deepEqual(Object.keys(resized.variants), [
    "s",
    "m",
    "l",
    "xl",
    "full",
  ]);
  assert.deepEqual(
    await owner(resized.variants.full.url),
    originalPhoto,
    "Full preserves the original bytes"
  );
  await anon("/speaker-pictures", "GET", undefined, 404);
  await anon("/speaker-pictures/1", "GET", undefined, 404);
  await anon(`/speaker-pictures/${"0".repeat(48)}`, "GET", undefined, 404);
  const anonymousImage = await fetch(origin + resized.url);
  assert.equal(anonymousImage.status, 200);
  assert.equal(anonymousImage.headers.has("set-cookie"), false);
  assert.deepEqual(
    Buffer.from(await anonymousImage.arrayBuffer()),
    originalPhoto
  );
  for (const [size, width] of Object.entries({
    s: 400,
    m: 720,
    l: 1080,
    xl: 1900,
    full: 3000,
  })) {
    const variant = resized.variants[size];
    const bytes = await owner(variant.download_url);
    assert.equal(variant.width, width);
    assert.equal(variant.height, Math.round((2000 * width) / 3000));
    assert.equal(variant.file_size, bytes.length);
    assert.deepEqual(
      JSON.parse(
        cli(
          `$d=getimagesizefromstring(base64_decode('${bytes.toString("base64")}'));echo json_encode([$d[0],$d[1]]);`
        )
      ),
      [variant.width, variant.height]
    );
    assert.match(
      variant.url,
      /^\/api\/speaker-pictures\/[a-f0-9]{48}(?:\/sizes\/[a-z]+)?$/
    );
    assert.deepEqual(await admin(variant.url), bytes);
    assert.deepEqual(await other(variant.url), bytes);
    assert.deepEqual(await anon(variant.url), bytes);
  }
  await owner(
    `/speaker/pictures/${resized.id}/sizes/unknown`,
    "GET",
    undefined,
    404
  );
  const boundary = await owner(
    "/speaker/pictures",
    "POST",
    upload(photo(2000, 3000), "Portrait aspect"),
    201
  );
  assert.equal(
    boundary.pictures.find((p) => p.label === "Portrait aspect").variants.s
      .height,
    600
  );
  assert.deepEqual((await owner("/speaker")).branding, {
    header_image: null,
    profile_url: null,
  });
  await anon("/speaker/branding/header", "POST", upload(photo(1600, 400)), 401);
  await owner("/speaker/branding/header", "POST", upload(photo(799, 400)), 422);
  await owner(
    "/speaker/branding/header",
    "POST",
    upload(Buffer.from("invalid")),
    422
  );
  await owner(
    "/speaker/branding/header",
    "POST",
    upload(Buffer.alloc(6 * 1024 * 1024)),
    413
  );
  await owner(
    "/speaker/branding/header",
    "POST",
    upload(photo(1600, 400)),
    403,
    false
  );
  const branded = await owner(
    "/speaker/branding/header",
    "POST",
    upload(photo(1600, 900))
  );
  const header = branded.branding.header_image;
  assert.match(header.url, /^\/api\/speaker\/branding-assets\/[a-f0-9]{48}$/);
  const coverBytes = await owner(header.url);
  assert.deepEqual(
    JSON.parse(
      cli(
        `$d=getimagesizefromstring(base64_decode('${coverBytes.toString("base64")}'));echo json_encode([$d[0],$d[1]]);`
      )
    ),
    [1600, 400]
  );
  await other(header.url, "GET", undefined, 404);
  await admin(header.url, "GET", undefined, 404);
  await anon(header.url, "GET", undefined, 401);
  const publicCoverPath = header.url.replace(
    "/speaker/branding-assets/",
    "/speaker-branding/"
  );
  await anon(publicCoverPath, "GET", undefined, 404);
  assert.equal(
    branded.pictures.length,
    boundary.pictures.length,
    "Covers stay separate from the speaker gallery"
  );
  assert.equal(branded.published, false);
  assert.deepEqual(
    (await owner("/speaker", "PUT", draft)).branding,
    branded.branding,
    "Text edits retain image choices"
  );
  cli(
    `query('UPDATE users SET avatar_url=? WHERE id=?',['/api/avatars/${alice.id}/' . one('SELECT filename FROM speaker_pictures WHERE id=?',[${pictureId}])['filename'],${alice.id}]);`
  );
  assert.match(
    (await owner("/speaker")).branding.profile_url,
    /^\/api\/avatars\//
  );
  await owner(
    "/speaker/pictures",
    "POST",
    upload(
      Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg" width="3000" height="2000"><rect width="3000" height="2000" /></svg>'
      )
    ),
    422
  );
  const jpeg = Buffer.from(
    cli(
      `$i=imagecreatetruecolor(1800,2400);ob_start();imagejpeg($i);$j=ob_get_clean();imagedestroy($i);$t="II".pack('vV',42,8).pack('v',1).pack('vvVv',0x0112,3,1,6)."\\0\\0".pack('V',0);$e="Exif\\0\\0".$t;echo base64_encode(substr($j,0,2)."\\xff\\xe1".pack('n',strlen($e)+2).$e.substr($j,2));`
    ),
    "base64"
  );
  const oriented = await owner(
    "/speaker/pictures",
    "POST",
    upload(jpeg, "Oriented JPEG"),
    201
  );
  const jpegPicture = oriented.pictures.find(
    (p) => p.label === "Oriented JPEG"
  );
  assert.equal(jpegPicture.variants.full.width, 2400);
  assert.equal(jpegPicture.variants.full.height, 1800);
  assert.equal(jpegPicture.variants.s.width, 400);
  assert.equal(jpegPicture.variants.s.height, 300);
  assert.equal(jpegPicture.variants.s.mime_type, "image/jpeg");
  assert.deepEqual(await owner(jpegPicture.variants.full.url), jpeg);
  assert.equal(
    cli(
      `require 'api/lib/http.php';require 'api/lib/remote.php';require 'api/lib/logos.php';require 'api/lib/profiles.php';require 'api/lib/speaker-pictures.php';ini_set('memory_limit','16M');try{prepare_speaker_picture(base64_decode('${originalPhoto.toString("base64")}'));echo 'unexpected';}catch(SpeakerPictureException $e){echo str_contains($e->getMessage(),'memory')?'bounded':'wrong error';}`
    ),
    "bounded"
  );
  assert.equal(
    (await owner("/speaker")).published,
    false,
    "Uploading never publishes"
  );
  await owner(`/speaker/pictures/${pictureId}/download`);
  for (const request of [other, admin]) {
    await request(`/speaker/pictures/${pictureId}`, "GET", undefined, 404);
    await request(`/speaker/pictures/${pictureId}`, "DELETE", undefined, 404);
  }
  await anon(`/speaker/pictures/${pictureId}`, "GET", undefined, 401);
  await other("/me", "PATCH", { username: "bob-speaker" });
  assert.deepEqual(
    (await other("/speaker/preview", "POST")).profile.pictures,
    []
  );
  await owner("/speaker/publication", "PUT", {}, 422);
  // An old partial-selection client must not accidentally consent to publishing everything.
  await owner(
    "/speaker/publication",
    "PUT",
    { selection: { fields: ["tagline"] }, preview_hash: "old-client" },
    422
  );
  await owner("/speaker/publication", "PUT", { publish_all: "true" }, 422);
  // Direct publication works without any preview, with all speaker fields server-allowlisted.
  await owner("/speaker/publication", "PUT", {
    publish_all: true,
    email: "never-copy@example.com",
    user_id: bob.id,
  });
  assert.equal(
    (await anon("/public/speakers/alice-speaker")).company,
    draft.company
  );
  await owner("/speaker/publication", "DELETE");
  await anon(publicCoverPath, "GET", undefined, 404);
  const preview = await owner("/speaker/preview", "POST");
  assert.deepEqual(preview.profile.bios, draft.bios);
  assert.equal(
    (await owner("/speaker")).published,
    false,
    "Preview is not consent"
  );
  await anon("/public/speakers/alice-speaker", "GET", undefined, 404);
  await owner("/speaker/publication", "PUT", { publish_all: true }, 403, false);
  await owner("/speaker/publication", "PUT", { publish_all: true });
  let kit = await anon("/public/speakers/alice-speaker");
  assert.match(kit.speaker_id, /^spk_[a-f0-9]{32}$/);
  assert.equal(kit.tagline, draft.tagline);
  assert.deepEqual(kit.bios, draft.bios);
  assert.deepEqual(kit.appearances, draft.appearances);
  assert.equal(kit.company, draft.company);
  assert.equal(kit.job_title, draft.job_title);
  assert.equal(kit.contact_email, draft.contact_email);
  assert.equal(kit.links.length, 2);
  assert.equal(kit.header_image.id, header.id);
  assert.match(kit.profile_image.url, /\/api\/speaker-branding\/[a-f0-9]{48}$/);
  assert.deepEqual(
    await anon(new URL(kit.header_image.url).pathname),
    coverBytes
  );
  assert.deepEqual(
    await anon(new URL(kit.profile_image.url).pathname),
    await owner(`/speaker/pictures/${pictureId}`)
  );
  assert.equal(JSON.stringify(kit).includes("/api/avatars/"), false);
  const originalPortraitPath = new URL(kit.profile_image.url).pathname;
  cli(
    `query('UPDATE users SET avatar_url=? WHERE id=?',['/api/avatars/${alice.id}/' . one('SELECT filename FROM speaker_pictures WHERE id=?',[${resized.id}])['filename'],${alice.id}]);`
  );
  assert.equal(
    (await anon("/public/speakers/alice-speaker")).profile_image.url,
    kit.profile_image.url,
    "Account-picture changes do not alter publication"
  );
  await owner("/speaker/publication", "PUT", { publish_all: true });
  kit = await anon("/public/speakers/alice-speaker");
  assert.notEqual(
    new URL(kit.profile_image.url).pathname,
    originalPortraitPath
  );
  await anon(originalPortraitPath, "GET", undefined, 404);
  await owner("/speaker/branding/header", "DELETE");
  assert.equal(
    (await anon("/public/speakers/alice-speaker")).header_image.id,
    header.id,
    "Saving image roles does not update a publication"
  );
  await owner("/speaker/branding/header", "POST", upload(photo(1600, 900)));
  for (const forbidden of [
    "email",
    "id",
    "role",
    "crew",
    "submissions",
    "papers",
    "reviews",
    "avatar_url",
  ])
    assert.equal(kit[forbidden], undefined, forbidden);
  assert.equal(JSON.stringify(kit).includes("/api/speaker/"), false);
  assert.equal(JSON.stringify(kit).includes("PRIVATE_PROPOSAL"), false);
  assert.equal(kit.pictures[0].credit, "Photo by Example; credit required");
  let media = new URL(kit.pictures[0].download_url).pathname;
  await anon(media);
  const publicVariants = kit.pictures.find((p) => p.id === resized.id).variants;
  const publicSmall = new URL(publicVariants.s.download_url).pathname;
  assert.equal((await anon(publicSmall)).length, publicVariants.s.file_size);
  const originalPublication = cli(
    `echo base64_encode(one('SELECT published FROM speaker_information WHERE user_id=${alice.id}')['published']);`
  );
  cli(
    `$row=one('SELECT published FROM speaker_information WHERE user_id=${alice.id}');$kit=json_decode($row['published'],true);foreach($kit['pictures'] as &$picture)if($picture['id']===${resized.id})unset($picture['variants']);unset($picture);query('UPDATE speaker_information SET published=? WHERE user_id=?',[json_encode($kit),${alice.id}]);`
  );
  await anon(publicSmall);
  await anon(
    new URL(kit.pictures.find((p) => p.id === resized.id).url).pathname
  );
  cli(
    `query('UPDATE speaker_information SET published=? WHERE user_id=?',[base64_decode('${originalPublication}'),${alice.id}]);`
  );
  assert.equal(JSON.stringify(kit).includes('"filename"'), false);
  const schema = JSON.parse(
    await readFile("public/speaker-openapi.json", "utf8")
  );
  const allowed = Object.keys(schema.components.schemas.Speaker.properties);
  const sharing = kit.sharing;
  assert.equal(new URL(sharing.image_url).origin, "https://shareable.nico.dev");
  assert.equal(
    new URL(sharing.image_url).searchParams.get("url"),
    kit.profile_url
  );
  assert.equal(
    new URL(sharing.twitter_image_url).searchParams.get("format"),
    "twitter"
  );
  assert.deepEqual((await owner("/speaker")).sharing, sharing);
  const html = await speakerHtml();
  assert.match(html, /property="og:image"/);
  assert.match(html, /name="twitter:card" content="summary_large_image"/);
  assert.ok(html.includes(sharing.image_url.replaceAll("&", "&amp;")));
  assert.equal(html.includes("PRIVATE_PROPOSAL"), false);
  assert.equal(
    (await speakerHtml("missing-speaker")).includes("og:image"),
    false
  );
  const savedSnapshot = cli(
    `echo base64_encode(one('SELECT published FROM speaker_information WHERE user_id=${alice.id}')['published']);`
  );
  cli(
    `$row=one('SELECT published FROM speaker_information WHERE user_id=${alice.id}');$snapshot=json_decode($row['published'],true);$snapshot['name']='<script>alert("xss")</script>';$snapshot['tagline']='"/><img src=x onerror=alert(1)>' ;query('UPDATE speaker_information SET published=? WHERE user_id=?',[json_encode($snapshot),${alice.id}]);`
  );
  const escaped = await speakerHtml();
  assert.ok(escaped.includes("&lt;script&gt;"));
  assert.equal(escaped.includes("<script>alert"), false);
  assert.equal(escaped.includes("<img src=x"), false);
  cli(
    `query('UPDATE speaker_information SET published=? WHERE user_id=?',[base64_decode('${savedSnapshot}'),${alice.id}]);`
  );
  for (const key of Object.keys(kit))
    assert.ok(allowed.includes(key), `Undocumented field ${key}`);
  for (const key of schema.components.schemas.Speaker.required)
    assert.ok(key in kit);
  for (const [key, value] of Object.entries(
    schema.components.schemas.Speaker.properties
  ))
    if (key in kit) {
      const actual =
        kit[key] === null
          ? "null"
          : Array.isArray(kit[key])
            ? "array"
            : typeof kit[key] === "number"
              ? "integer"
              : typeof kit[key];
      const types = value.anyOf
        ? value.anyOf.map((option) =>
            option.$ref
              ? option.$ref
                  .slice(2)
                  .split("/")
                  .reduce((node, part) => node[part], schema).type
              : option.type
          )
        : [value.type];
      assert.ok(
        types.includes(actual),
        `${key}: ${actual} does not match the documented type`
      );
    }
  await owner("/speaker", "PUT", { ...draft, tagline: "New private tagline" });
  assert.deepEqual((await owner("/speaker")).sharing, sharing);
  assert.equal((await speakerHtml()).includes("New private tagline"), false);
  assert.equal(
    (await anon("/public/speakers/alice-speaker")).tagline,
    "Public tagline"
  );
  assert.equal(
    (await owner("/speaker/preview", "POST")).profile.tagline,
    "New private tagline"
  );
  await owner("/speaker/publication", "PUT", { publish_all: true });
  await anon(media);
  await anon(publicSmall);
  kit = await anon("/public/speakers/alice-speaker");
  assert.notEqual(kit.sharing.image_url, sharing.image_url);
  const stableId = kit.speaker_id;
  media = new URL(kit.pictures[0].url).pathname;
  await owner("/me", "PATCH", { name: "Changed private display name" });
  assert.equal((await anon("/public/speakers/alice-speaker")).name, "Alice");
  // Blocking protects social content, not the deliberately open-web snapshot.
  cli(
    `insert('blocks',['user_id'=>${bob.id},'blocked_id'=>${alice.id},'created_at'=>now()]);`
  );
  await other(`/users/${alice.id}`, "GET", undefined, 404);
  await other("/public/speakers/alice-speaker");
  cli(
    `query('UPDATE users SET suspended=1,session_version=session_version+1 WHERE id=?',[${alice.id}]);`
  );
  await anon("/public/speakers/alice-speaker", "GET", undefined, 404);
  assert.equal((await speakerHtml()).includes("og:image"), false);
  await other("/speaker/username-availability?username=alice-speaker").then(
    (result) =>
      assert.equal(
        result.available,
        false,
        "Suspended accounts retain their claims"
      )
  );
  await anon(media, "GET", undefined, 404);
  const suspendedSmall = new URL(
    kit.pictures.find((p) => p.id === resized.id).variants.s.url
  ).pathname;
  await anon(suspendedSmall, "GET", undefined, 404);
  await anon(publicCoverPath, "GET", undefined, 404);
  await anon(new URL(kit.profile_image.url).pathname, "GET", undefined, 404);
  cli(`query('UPDATE users SET suspended=0 WHERE id=?',[${alice.id}]);`);
  await signin(owner, "alice@speaker.example", "Alice");
  await anon("/public/speakers/alice-speaker");
  await owner("/speaker/publication", "DELETE");
  await anon(publicCoverPath, "GET", undefined, 404);
  assert.equal((await owner("/speaker")).published, false);
  await anon("/public/speakers/alice-speaker", "GET", undefined, 404);
  await anon(media);
  await anon(suspendedSmall);
  await owner("/speaker/publication", "PUT", { publish_all: true });
  await owner("/me", "PATCH", { username: "new-alice" });
  await anon("/public/speakers/alice-speaker", "GET", undefined, 404);
  await anon("/public/speakers/new-alice", "GET", undefined, 404);
  const consent = await owner("/speaker/preview", "POST");
  assert.equal(consent.profile.speaker_id, stableId);
  await owner("/speaker/publication", "PUT", { publish_all: true });
  assert.equal(
    (await anon("/public/speakers/new-alice")).contact_email,
    draft.contact_email
  );
  await owner(`/speaker/pictures/${pictureId}`, "DELETE");
  assert.equal((await owner("/speaker")).branding.header_image.id, header.id);
  await anon(media, "GET", undefined, 404);
  await anon(pictures[0].url, "GET", undefined, 404);
  await anon("/public/speakers/new-alice", "GET", undefined, 404);
  await owner(`/speaker/pictures/${pictureId}`, "GET", undefined, 404);
  assert.equal(
    cli(
      `echo one('SELECT COUNT(*) AS n FROM speaker_pictures WHERE id=${pictureId}')['n'];`
    ),
    "0"
  );
  // Account deletion cascades drafts/claims/publication and queues retained imported images.
  const remainingFiles = JSON.parse(
    cli(
      `echo json_encode(glob(dirname($config['database']).'/avatars/${alice.id}/*'));`
    )
  );
  assert.ok(
    remainingFiles.length >= 6,
    "Originals and generated files remain covered by durable account cleanup"
  );
  await owner("/me", "DELETE", { confirmation: "DELETE" }, 204);
  await anon(publicCoverPath, "GET", undefined, 404);
  assert.equal(
    cli(
      `echo one('SELECT COUNT(*) AS n FROM speaker_branding_assets WHERE user_id=?',[${alice.id}])['n'];`
    ),
    "0"
  );
  await anon(publicSmall, "GET", undefined, 404);
  assert.equal(
    cli(
      `echo one('SELECT COUNT(*) AS n FROM speaker_information WHERE user_id=${alice.id}')['n'];`
    ),
    "0"
  );
  assert.equal(
    cli(
      `echo json_encode(glob(dirname($config['database']).'/avatars/${alice.id}/*'));`
    ),
    "[]"
  );
  // Budget is shared across not-found and media requests and errors stay predictable.
  cli("query('DELETE FROM rate_limits');");
  const sessionCheck = await fetch(origin + "/api/public/speakers/missing");
  assert.equal(sessionCheck.headers.has("set-cookie"), false);
  for (let i = 1; i < 120; i++)
    await anon("/public/speakers/missing", "GET", undefined, 404);
  const limited = await anon(
    "/public/speakers/missing/media/missing/1",
    "GET",
    undefined,
    429
  );
  assert.equal(limited.error.code, "rate_limited");
  assert.deepEqual(limited.error.fields, {});
  console.log(
    "Speaker checks passed: populated upgrade/idempotency, username validation/uniqueness, private toolkit/media ownership, direct publish-all consent without preview, allowlisted snapshots, public media revocation, suspension, deletion and rate limits."
  );
} finally {
  if (server) {
    server.kill("SIGTERM");
    await new Promise((resolve) => server.once("exit", resolve));
  }
  await rm(directory, { recursive: true, force: true });
}
