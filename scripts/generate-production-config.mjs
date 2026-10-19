import { writeFile } from "node:fs/promises";
import { isIP } from "node:net";
import { pathToFileURL } from "node:url";

export function productionConfig(environment) {
  let url;
  try {
    url = new URL(environment.APP_BASE_URL);
  } catch {
    throw new Error("Set APP_BASE_URL to the production HTTPS origin.");
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/"
  ) {
    throw new Error(
      "APP_BASE_URL must be an HTTPS origin without credentials, a path, query, or fragment."
    );
  }

  const mailFrom = environment.APP_MAIL_FROM || "purpleroom <noreply@nico.dev>";
  const address = mailFrom.match(/<([^<>]+)>$/)?.[1] ?? mailFrom;
  if (
    /[\x00-\x1f\x7f]/.test(mailFrom) ||
    !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(address)
  ) {
    throw new Error(
      "APP_MAIL_FROM must be an email address or display-name mailbox without control characters."
    );
  }

  const setupKey = environment.APP_SETUP_KEY || null;
  if (
    setupKey !== null &&
    (setupKey.length < 32 || /[\x00-\x1f\x7f]/.test(setupKey))
  ) {
    throw new Error(
      "APP_SETUP_KEY must contain at least 32 random characters and no control characters, or be unset to disable setup."
    );
  }

  const smtpEnabled = ["SMTP_HOST", "SMTP_PORT", "SMTP_USERNAME", "SMTP_PASSWORD", "SMTP_ENCRYPTION"].some(key => environment[key]);
  let smtp = { smtp_host: null, smtp_port: 587, smtp_username: null, smtp_password: null, smtp_encryption: "tls" };
  if (smtpEnabled) {
    for (const key of ["SMTP_HOST", "SMTP_USERNAME", "SMTP_PASSWORD"]) {
      if (typeof environment[key] !== "string" || !environment[key] || /[\x00-\x1f\x7f]/.test(environment[key]))
        throw new Error(`Set ${key} without control characters when configuring SMTP.`);
    }
    const host = environment.SMTP_HOST;
    const ipv6 = host.startsWith("[") && host.endsWith("]") && isIP(host.slice(1,-1)) === 6;
    if (!ipv6 && !(host.length <= 253 && host.split(".").every(label => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label))))
      throw new Error("SMTP_HOST must be a hostname or IP address, without a scheme, path, credentials, or port.");
    const encryption = environment.SMTP_ENCRYPTION || "tls";
    if (!["tls", "ssl"].includes(encryption)) throw new Error("SMTP_ENCRYPTION must be tls (STARTTLS) or ssl (implicit TLS).");
    const port = environment.SMTP_PORT || (encryption === "ssl" ? "465" : "587");
    if (!/^\d{1,5}$/.test(port) || Number(port) < 1 || Number(port) > 65535) throw new Error("SMTP_PORT must be between 1 and 65535.");
    smtp = {smtp_host:host,smtp_port:Number(port),smtp_username:environment.SMTP_USERNAME,smtp_password:environment.SMTP_PASSWORD,smtp_encryption:encryption};
  }

  return {
    env: "production",
    base_url: url.origin,
    mail_from: mailFrom,
    setup_key: setupKey,
    ...smtp,
  };
}

function phpLiteral(value) {
  if (value === null) return "null";
  if (typeof value === "number") return String(value);
  return "'" + value.replaceAll("\\", "\\\\").replaceAll("'", "\\'") + "'";
}

export function renderConfig(config) {
  return (
    "<?php\ndeclare(strict_types=1);\n\n// Generated from GitHub Actions secrets. Do not edit on the server.\nreturn [\n" +
    Object.entries(config)
      .map(([key, value]) => `    '${key}' => ${phpLiteral(value)},`)
      .join("\n") +
    "\n];\n"
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    const destination = process.argv[2];
    if (!destination)
      throw new Error(
        "Provide the deployment bundle's config.local.php destination."
      );
    const config = productionConfig(process.env);
    await writeFile(destination, renderConfig(config), { mode: 0o600 });
  } catch (error) {
    // Validation errors contain setting names, never their secret values.
    console.error(
      error instanceof Error
        ? error.message
        : "Could not generate production config."
    );
    process.exitCode = 1;
  }
}
