import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createSecureContext,
  createServer as createTLSServer,
  TLSSocket,
} from "node:tls";

const directory = await mkdtemp(join(tmpdir(), "purpleroom-mail-"));
const capture = join(directory, "php-mail.eml"),
  recorder = join(directory, "sendmail.mjs");
const quote = (value) => "'" + value.replaceAll("'", "'\\''") + "'";
const sendmailSetting =
  "sendmail_path=" + quote(process.execPath) + " " + quote(recorder);
const code = "012345";
const baseConfig = {
  env: "production",
  mail_from: "Nico's purpleroom <sender@example.com>",
  smtp_host: "127.0.0.1",
  smtp_username: "fixture-user",
  smtp_password: "fixture-password",
  smtp_encryption: "tls",
};
async function php(config, options = {}) {
  const child = spawn(
    "php",
    [
      ...(options.ini ?? ["-d", sendmailSetting]),
      "-r",
      `define('GREEN_ROOM',true); require 'api/lib/mail.php'; $input=json_decode(stream_get_contents(STDIN),true); $config=$input['config']; try { send_login_mail($input['email'],$input['code']); echo json_encode(['ok'=>true]); } catch (MailDeliveryException $e) { echo json_encode(['ok'=>false,'error'=>$e->getMessage()]); }`,
    ],
    {
      env: { ...process.env, MAIL_CAPTURE: capture, ...options.env },
      stdio: ["pipe", "pipe", "pipe"],
    }
  );
  let stdout = "",
    stderr = "";
  child.stdout.on("data", (data) => {
    stdout += data;
  });
  child.stderr.on("data", (data) => {
    stderr += data;
  });
  child.stdin.end(
    JSON.stringify({
      config,
      email: options.email ?? "member@example.com",
      code: options.code ?? code,
    })
  );
  const [status] = await once(child, "close");
  assert.equal(status, 0, stderr);
  return { result: JSON.parse(stdout), stderr };
}
function parts(message) {
  const boundary = message.match(/boundary="([^"]+)"/)?.[1];
  assert.ok(boundary);
  const result = {};
  for (const part of message.split("--" + boundary)) {
    const type = part.match(/Content-Type: text\/(plain|html);/i)?.[1];
    if (type) {
      const encoded = part
        .split(/\r?\n\r?\n/)
        .slice(1)
        .join("\n\n")
        .trim();
      result[type] = Buffer.from(encoded.replace(/\s/g, ""), "base64").toString(
        "utf8"
      );
    }
  }
  return result;
}
async function fixture({
  implicit = false,
  tls = true,
  rejectAuth = false,
  key,
  cert,
}) {
  const messages = [],
    auth = [],
    envelopes = [],
    commands = [];
  const sockets = new Set();
  const secureContext = createSecureContext({ key, cert });
  function attach(socket, secure = false, greeting = true) {
    sockets.add(socket);
    socket.on("error", () => {});
    socket.on("close", () => sockets.delete(socket));
    if (greeting) socket.write("220 fixture.example ESMTP\r\n");
    let buffer = "",
      dataMode = false,
      waitingAuth = false;
    socket.on("data", function receive(chunk) {
      buffer += chunk.toString("utf8");
      while (buffer) {
        if (dataMode) {
          const end = buffer.indexOf("\r\n.\r\n");
          if (end < 0) return;
          messages.push(buffer.slice(0, end).replace(/\r\n\.\./g, "\r\n."));
          buffer = buffer.slice(end + 5);
          dataMode = false;
          socket.write("250 Message accepted\r\n");
          continue;
        }
        const end = buffer.indexOf("\r\n");
        if (end < 0) return;
        const line = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        if (waitingAuth) {
          waitingAuth = false;
          auth.push({
            secure,
            value: Buffer.from(line, "base64").toString("utf8"),
          });
          socket.write(
            rejectAuth
              ? "535 Authentication rejected\r\n"
              : "235 Authenticated\r\n"
          );
          continue;
        }
        commands.push(line.split(" ")[0]);
        if (/^(EHLO|HELO)/.test(line))
          socket.write(
            "250-fixture.example\r\n" +
              (!secure && tls ? "250-STARTTLS\r\n" : "") +
              "250 AUTH PLAIN\r\n"
          );
        else if (line === "STARTTLS" && tls) {
          socket.write("220 Begin TLS\r\n");
          socket.removeListener("data", receive);
          const encrypted = new TLSSocket(socket, {
            isServer: true,
            secureContext,
          });
          attach(encrypted, true, false);
          return;
        } else if (line.startsWith("AUTH PLAIN")) {
          const payload = line.slice("AUTH PLAIN".length).trim();
          if (payload) {
            auth.push({
              secure,
              value: Buffer.from(payload, "base64").toString("utf8"),
            });
            socket.write(
              rejectAuth
                ? "535 Authentication rejected\r\n"
                : "235 Authenticated\r\n"
            );
          } else {
            waitingAuth = true;
            socket.write("334 \r\n");
          }
        } else if (
          line.startsWith("MAIL FROM:") ||
          line.startsWith("RCPT TO:")
        ) {
          envelopes.push(line);
          socket.write("250 OK\r\n");
        } else if (line === "DATA") {
          dataMode = true;
          socket.write("354 End with dot\r\n");
        } else if (line === "QUIT") {
          socket.end("221 Bye\r\n");
        } else socket.write("250 OK\r\n");
      }
    });
  }
  const server = implicit
    ? createTLSServer({ key, cert }, (socket) => attach(socket, true))
    : createServer((socket) => attach(socket));
  server.on("tlsClientError", () => {});
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  return {
    port: server.address().port,
    messages,
    auth,
    envelopes,
    commands,
    close: async () => {
      for (const socket of sockets) socket.destroy();
      await new Promise((resolve) => server.close(resolve));
    },
  };
}
try {
  await writeFile(
    recorder,
    "import {readFileSync,writeFileSync} from 'node:fs';writeFileSync(process.env.MAIL_CAPTURE,readFileSync(0));"
  );
  const keyFile = join(directory, "key.pem"),
    certFile = join(directory, "cert.pem");
  const certResult = spawnSync(
    "openssl",
    [
      "req",
      "-x509",
      "-newkey",
      "rsa:2048",
      "-nodes",
      "-keyout",
      keyFile,
      "-out",
      certFile,
      "-days",
      "1",
      "-subj",
      "/CN=localhost",
      "-addext",
      "subjectAltName=DNS:localhost,IP:127.0.0.1",
      "-addext",
      "basicConstraints=critical,CA:TRUE",
    ],
    { encoding: "utf8" }
  );
  assert.equal(
    certResult.status,
    0,
    "Could not create the isolated SMTP TLS fixture certificate."
  );
  const key = await readFile(keyFile),
    cert = await readFile(certFile);
  for (const implicit of [false, true]) {
    const smtp = await fixture({ key, cert, implicit });
    try {
      const sent = await php({
        ...baseConfig,
        smtp_port: smtp.port,
        smtp_encryption: implicit ? "ssl" : "tls",
        smtp_ca_file: certFile,
      });
      assert.equal(sent.result.ok, true, JSON.stringify(sent.result));
      assert.equal(sent.stderr, "");
      assert.equal(smtp.messages.length, 1);
      assert.equal(smtp.auth.length, 1);
      assert.equal(smtp.auth[0].secure, true);
      assert.equal(smtp.auth[0].value, "\0fixture-user\0fixture-password");
      assert.ok(
        smtp.envelopes.some((line) =>
          line.startsWith("MAIL FROM:<sender@example.com>")
        )
      );
      assert.ok(
        smtp.envelopes.some((line) =>
          line.startsWith("RCPT TO:<member@example.com>")
        )
      );
      const content = parts(smtp.messages[0]);
      assert.ok(content.plain.includes("\n" + code + "\n"));
      assert.ok(content.html.includes(">" + code + "</p>"));
      assert.ok(!content.html.includes("/auth/"));
      assert.ok(!content.plain.includes("/auth/"));
      for (const body of [content.plain, content.html]) {
        assert.ok(body.includes("Paste this code into the login screen in the browser where you requested it."));
        assert.ok(body.includes("can only be used once. Do not share it."));
        assert.ok(body.includes("If you did not request this code, you can ignore this email."));
        assert.ok(!body.includes("where speakers swap notes"));
        assert.ok(!/https?:\/\//i.test(body), "Sign-in emails must not contain unrelated links");
      }
      assert.ok(!/<a\b|<img\b|display\s*:\s*none|visibility\s*:\s*hidden/i.test(content.html));
      assert.ok(content.html.includes("#663399"));
      assert.ok(content.html.includes("15 minutes"));
      assert.ok(!content.html.includes("<img"));
      assert.ok(smtp.messages[0].includes("multipart/alternative"));
      assert.ok(
        smtp.messages[0].includes("Subject: Your Purple Room sign-in code")
      );
    } finally {
      await smtp.close();
    }
  }
  for (const testCase of ["untrusted", "no-tls", "bad-auth"]) {
    const smtp = await fixture({
      key,
      cert,
      tls: testCase !== "no-tls",
      rejectAuth: testCase === "bad-auth",
    });
    try {
      const sent = await php({
        ...baseConfig,
        smtp_port: smtp.port,
        ...(testCase === "untrusted" ? {} : { smtp_ca_file: certFile }),
      });
      assert.equal(sent.result.ok, false, testCase + " must fail securely");
      assert.equal(smtp.messages.length, 0);
      if (testCase !== "bad-auth")
        assert.equal(
          smtp.auth.length,
          0,
          "Credentials must not be sent before verified TLS"
        );
      assert.ok(!JSON.stringify(sent).includes("fixture-password"));
      assert.ok(!JSON.stringify(sent).includes(code));
    } finally {
      await smtp.close();
    }
  }
  assert.equal(
    await readFile(capture).then(
      () => true,
      () => false
    ),
    false,
    "Configured SMTP must never silently fall back to PHP mail"
  );
  const sent = await php({
    env: "production",
    mail_from: baseConfig.mail_from,
    smtp_host: null,
  });
  assert.equal(sent.result.ok, true);
  const content = parts(await readFile(capture, "utf8"));
  assert.ok(content.html.includes(">" + code + "</p>"));
  assert.ok(content.plain.includes(code));
  for (const invalidCode of ["12345", "1234567", "<script>", "123\r\n456"])
    assert.equal(
      (await php(baseConfig, { code: invalidCode })).result.ok,
      false
    );
  const invalid = await php({
    ...baseConfig,
    mail_from: "sender@example.com\r\nBcc: attacker@example.com",
  });
  assert.equal(invalid.result.ok, false);
  await rm(capture);
  const smtp = await fixture({ key, cert });
  let api;
  try {
    const env = {
      ...process.env,
      PURPLEROOM_ENV: "production",
      GREEN_ROOM_DB: join(directory, "auth.sqlite"),
      SMTP_HOST: "127.0.0.1",
      SMTP_PORT: String(smtp.port),
      SMTP_USERNAME: baseConfig.smtp_username,
      SMTP_PASSWORD: baseConfig.smtp_password,
      SMTP_ENCRYPTION: "tls",
      MAIL_CAPTURE: capture,
    };
    const migration = spawnSync("php", ["api/db/migrate.php"], {
      env,
      encoding: "utf8",
    });
    assert.equal(migration.status, 0, migration.stderr);
    const seed = spawnSync(
      "php",
      [
        "-r",
        "define('GREEN_ROOM',true); $config=require 'api/config.php'; require 'api/lib/db.php'; insert('users',['name'=>'Existing member','email'=>'existing@example.com','cal_token'=>bin2hex(random_bytes(32))]);",
      ],
      { env, encoding: "utf8" }
    );
    assert.equal(seed.status, 0, seed.stderr);
    api = spawn(
      "php",
      [
        "-d",
        sendmailSetting,
        "-S",
        "127.0.0.1:8022",
        "-t",
        ".",
        "api/dev-router.php",
      ],
      { env, stdio: ["ignore", "ignore", "pipe"] }
    );
    let apiLog = "";
    api.stderr.on("data", (data) => {
      apiLog += data;
    });
    let started = false;
    for (let attempt = 0; attempt < 50; attempt++) {
      try {
        if ((await fetch("http://127.0.0.1:8022/api/health")).ok) {
          started = true;
          break;
        }
      } catch {
        /* starting */
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    assert.ok(started, "Mail failure API fixture could not start");
    for (const email of ["existing@example.com", "new@example.com"]) {
      const response = await fetch("http://127.0.0.1:8022/api/auth/request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "green-room",
        },
        body: JSON.stringify({ email }),
      });
      assert.equal(response.status, 200);
      const result = await response.json();
      assert.deepEqual(Object.keys(result).sort(), ["ok", "request_id"]);
      assert.equal(result.ok, true);
      assert.match(result.request_id, /^[a-f0-9]{64}$/);
    }
    const pending = spawnSync(
      "php",
      [
        "-r",
        "define('GREEN_ROOM',true); $config=require 'api/config.php'; require 'api/lib/db.php'; echo one('SELECT COUNT(*) AS n FROM login_codes')['n'];",
      ],
      { env, encoding: "utf8" }
    );
    assert.equal(pending.status, 0, pending.stderr);
    assert.equal(
      pending.stdout,
      "0",
      "Failed delivery must discard unusable pending codes"
    );
    assert.ok(!/https?:\/\/\S+\/auth\/[a-f0-9]{64}/.test(apiLog));
    assert.ok(!apiLog.includes(baseConfig.smtp_password));
    assert.equal(smtp.messages.length, 0);
    assert.equal(smtp.auth.length, 0);
    assert.equal(
      await readFile(capture).then(
        () => true,
        () => false
      ),
      false,
      "API must not downgrade failed SMTP delivery to PHP mail"
    );
  } finally {
    if (api) {
      api.kill("SIGTERM");
      await once(api, "exit");
    }
    await smtp.close();
  }
  // A successful production delivery must not return or log the emailed secret either.
  let productionApi;
  try {
    const env = {
      ...process.env,
      PURPLEROOM_ENV: "production",
      GREEN_ROOM_DB: join(directory, "auth.sqlite"),
      SMTP_HOST: "",
      SMTP_USERNAME: "",
      SMTP_PASSWORD: "",
      MAIL_CAPTURE: capture,
    };
    productionApi = spawn(
      "php",
      [
        "-d",
        sendmailSetting,
        "-S",
        "127.0.0.1:8022",
        "-t",
        ".",
        "api/dev-router.php",
      ],
      { env, stdio: ["ignore", "ignore", "pipe"] }
    );
    let productionLog = "";
    productionApi.stderr.on("data", (chunk) => {
      productionLog += chunk;
    });
    let started = false;
    for (let i = 0; i < 50; i++) {
      try {
        if ((await fetch("http://127.0.0.1:8022/api/health")).ok) {
          started = true;
          break;
        }
      } catch {
        /* starting */
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    assert.ok(started);
    const request = await fetch("http://127.0.0.1:8022/api/auth/request", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Requested-With": "green-room",
      },
      body: JSON.stringify({ email: "delivered@example.com" }),
    });
    assert.equal(request.status, 200);
    const result = await request.json();
    assert.deepEqual(Object.keys(result).sort(), ["ok", "request_id"]);
    const delivered = parts(await readFile(capture, "utf8"));
    const emailedCode = delivered.plain.match(/\n([0-9]{6})\n/)?.[1];
    assert.ok(emailedCode, "Production delivery must include a six-digit code");
    assert.ok(
      !productionLog.includes(emailedCode),
      "Production logs must not contain the code"
    );
    const verify = await fetch("http://127.0.0.1:8022/api/auth/verify", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Requested-With": "green-room",
      },
      body: JSON.stringify({
        request_id: result.request_id,
        code: emailedCode,
      }),
    });
    assert.equal(verify.status, 200);
    assert.equal((await verify.json()).user.email, "delivered@example.com");
  } finally {
    if (productionApi) {
      productionApi.kill("SIGTERM");
      await once(productionApi, "exit");
    }
  }
  console.log(
    "Mail checks passed: branded HTML/plain codes, leading zeroes, authenticated STARTTLS/implicit TLS, certificate verification, no plaintext downgrade, safe SMTP failures, and PHP mail fallback. No external mail was sent."
  );
} finally {
  await rm(directory, { recursive: true, force: true });
}
