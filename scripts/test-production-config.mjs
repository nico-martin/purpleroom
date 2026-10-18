import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import {
  productionConfig,
  renderConfig,
} from "./generate-production-config.mjs";

test("profile image runtime storage is protected from Git and FTP deployments", async () => {
  const workflow = await readFile(".github/workflows/deploy.yml", "utf8");
  assert.ok(workflow.includes("--exclude='db/avatars/'"));
  assert.ok(workflow.includes('test ! -d "$bundle/api/db/avatars"'));
  assert.ok(workflow.includes("            api/db/avatars\n"));
  assert.ok(workflow.includes("            api/db/avatars/**"));
  assert.ok(
    (await readFile(".gitignore", "utf8"))
      .split("\n")
      .includes("api/db/avatars/")
  );
});

test("PURPLEROOM_ENV selects runtime mode and local config keeps precedence", async () => {
  const directory = await mkdtemp(join(tmpdir(), "purpleroom-runtime-config-"));
  try {
    const path = join(directory, "config.php");
    await writeFile(path, await readFile("api/config.php", "utf8"));
    function load(value) {
      const result = spawnSync(
        "php",
        [
          "-r",
          "define('GREEN_ROOM', true); echo json_encode(require $argv[1]);",
          path,
        ],
        {
          env: { ...process.env, PURPLEROOM_ENV: value },
          encoding: "utf8",
        }
      );
      assert.equal(result.status, 0, result.stderr);
      return JSON.parse(result.stdout);
    }
    assert.equal(load("dev").env, "dev");
    assert.equal(load("dev").base_url, "http://localhost:5173");
    assert.equal(load("").env, "production");
    assert.equal(load("production").base_url, "https://greenroom.nico.dev");
    await writeFile(
      join(directory, "config.local.php"),
      "<?php return ['env' => 'production', 'base_url' => 'https://example.com'];"
    );
    assert.equal(load("dev").env, "production");
    assert.equal(load("dev").base_url, "https://example.com");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("production defaults disable setup and normalize the origin", () => {
  assert.deepEqual(
    productionConfig({ APP_BASE_URL: "https://greenroom.nico.dev/" }),
    {
      env: "production",
      base_url: "https://greenroom.nico.dev",
      mail_from: "purpleroom <noreply@nico.dev>",
      setup_key: null,
    }
  );
});

test("invalid settings are rejected without exposing their values", () => {
  for (const origin of [
    undefined,
    "http://example.com",
    "https://private:password@example.com",
    "https://example.com/private",
    "https://example.com/?secret=private",
    "https://example.com/#private",
  ]) {
    assert.throws(
      () => productionConfig({ APP_BASE_URL: origin }),
      /APP_BASE_URL/
    );
  }
  for (const mailbox of [
    "not-an-address",
    "mail@example.com\r\nBcc: private@example.com",
    "mail@example.com\0",
  ]) {
    assert.throws(
      () =>
        productionConfig({
          APP_BASE_URL: "https://example.com",
          APP_MAIL_FROM: mailbox,
        }),
      /APP_MAIL_FROM/
    );
  }
  for (const key of ["too-short", "a".repeat(40) + "\n"]) {
    assert.throws(
      () =>
        productionConfig({
          APP_BASE_URL: "https://example.com",
          APP_SETUP_KEY: key,
        }),
      /APP_SETUP_KEY/
    );
  }
});

test("PHP config safely round-trips quotes, backslashes, and Unicode", () => {
  const config = productionConfig({
    APP_BASE_URL: "https://greenroom.nico.dev",
    APP_MAIL_FROM: "Nico's \\ Grüne Room <mail@nico.dev>",
    APP_SETUP_KEY: "test-only-'\\'; echo 'not executed'; //".repeat(2),
  });
  const result = spawnSync(
    "php",
    [
      "-r",
      "echo json_encode(eval(stream_get_contents(STDIN)), JSON_THROW_ON_ERROR);",
    ],
    {
      input: renderConfig(config).replace("<?php\n", ""),
      encoding: "utf8",
    }
  );
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), config);
});

test("CLI generates only a server-side file, with no secret output", async () => {
  const directory = await mkdtemp(join(tmpdir(), "green-room-config-"));
  try {
    const destination = join(directory, "config.local.php");
    const env = {
      ...process.env,
      APP_BASE_URL: "https://greenroom.nico.dev",
      APP_MAIL_FROM: "purpleroom <mail@nico.dev>",
      APP_SETUP_KEY: "a".repeat(64),
    };
    const result = spawnSync(
      process.execPath,
      ["scripts/generate-production-config.mjs", destination],
      { env, encoding: "utf8" }
    );
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, "");
    assert.equal(result.stderr, "");
    assert.equal((await stat(destination)).mode & 0o777, 0o600);
    assert.ok((await readFile(destination, "utf8")).startsWith("<?php\n"));

    // Removing the GitHub secret explicitly disables setup, rather than falling back to a host environment key.
    env.APP_SETUP_KEY = "";
    const disabled = spawnSync(
      process.execPath,
      ["scripts/generate-production-config.mjs", destination],
      { env, encoding: "utf8" }
    );
    assert.equal(disabled.status, 0, disabled.stderr);
    assert.ok(
      (await readFile(destination, "utf8")).includes("'setup_key' => null")
    );

    env.APP_BASE_URL = "invalid-secret-value";
    const invalid = spawnSync(
      process.execPath,
      ["scripts/generate-production-config.mjs", destination],
      { env, encoding: "utf8" }
    );
    assert.equal(invalid.status, 1);
    assert.ok(!invalid.stderr.includes(env.APP_BASE_URL));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
